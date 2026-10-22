import { PALETTE } from '@eigenlands/shared';

const pal = PALETTE.map((h) => {
  const n = parseInt(h.slice(1), 16);
  const f = (v: number) => (v / 255).toFixed(4);
  return `vec3(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}).join(',');

export const TERRAIN_VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

/**
 * Terrain painter. Every screen art-pixel is inverse-projected into the world; the four nearest tile centres form a
 * dual grid whose class borders are warped by noise (organic, never square). Each ground class is then *painted*
 * from fixed palette ramps: calm low-contrast bases with hand-placed-looking detail stamped on a jittered screen grid
 * (grass tufts, flowers, pebbles, fallen leaves), patterned paving (cobbles, a ring-laid plaza, the shrine glyph),
 * furrowed soil, plank floors and water with a depth gradient, banks, rolling foam, glints and ice.
 *
 * Tile texel: r = ground class, g = quantum flux (0..1), b = paving style (1 road, 2 plaza, 3 shrine),
 *             a = signed distance to the shoreline in tiles (128 + 12*d; + inside water, - on land).
 */
export const TERRAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uTiles;
uniform vec2 uWin;          // tile coordinates of the window's top-left texel
uniform float uWinSize;     // window size in tiles
uniform vec2 uIso;          // iso art-pixel position of the render target's (0,0)
uniform vec2 uRes;          // render target size in art pixels
uniform float uTime;
uniform float uSeason;      // 0 spring, 1 summer, 2 autumn, 3 winter
uniform float uMotion;      // 1 = animate, 0 = reduced motion
uniform vec4 uPlaza;        // town plaza centre (tiles) + radius
uniform vec3 uWind;         // wind direction (tile axes) + strength; mirrors shared/wind.ts gust
uniform vec4 uShrine;       // spawn shrine centre (tiles) + radius

const vec3 PAL[48] = vec3[48](${pal});
const int BAYER[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);

const int DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, SOIL = 5, SOILWET = 6, FLOOR = 7, WALLC = 8;
// palette indices
const int INK=0, NIGHT=1, SLATE=2, STEEL=3, MIST=4, FOG=5, PALE=6, WHITE=7;
const int G0=8, G1=9, G2=10, G3=11, G4=12, G5=13, G6=14, G7=15;
const int E0=16, E1=17, E2=18, E3=19, E4=20, E5=21, E6=22, E7=23;
const int W0=24, W1=25, W2=26, W3=27, W4=28, W5=29, W6=30, W7=31;
const int R0=32, R1=33, R2=34, R3=35, R4=36, R5=37, R6=38, R7=39;
const int Q0=40, Q1=41, Q2=42, Q3=43, Q4=44, Q5=45, Q6=46, Q7=47;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hashi(ivec2 p) { return float(pcg(uint(p.x) * 1973u ^ pcg(uint(p.y) + 9277u))) / 4294967295.0; }
float hashk(ivec2 p, int k) { return hashi(p + ivec2(k * 7919, k * 3571)); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hashi(ii), b = hashi(ii + ivec2(1, 0)), c = hashi(ii + ivec2(0, 1)), d = hashi(ii + ivec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float bayer(ivec2 p) { return (float(BAYER[(p.x & 3) + (p.y & 3) * 4]) + 0.5) / 16.0; }
vec3 P(int i) { return PAL[clamp(i, 0, 47)]; }
// pick from an explicit dark->light ramp; dithering only inside a narrow seam so surfaces stay calm and flat
int ramp(int r[5], int n, float v, float d) {
  float x = clamp(v, 0.0, 0.999) * float(n - 1);
  float lo = floor(x);
  int i = int(lo) + (smoothstep(0.3, 0.7, x - lo) > d ? 1 : 0);
  return r[clamp(i, 0, n - 1)];
}
ivec2 cellOf(ivec2 p, ivec2 size) { return ivec2(floor(vec2(p) / vec2(size))); }
vec2 isoToTile(vec2 iso) { return vec2(iso.y / 16.0 + iso.x / 32.0, iso.y / 16.0 - iso.x / 32.0); }

// ───────── tile window + dual-grid classification ─────────
vec4 tileTex(ivec2 t) { int hi = int(uWinSize) - 1; return texelFetch(uTiles, clamp(t, ivec2(0), ivec2(hi)), 0); }
int clsOf(vec4 t) { return int(t.r * 255.0 + 0.5); }
float sdfOf(vec4 t) { return (t.a * 255.0 - 128.0) / 12.0; }
bool isWater(int c) { return c == WATER || c == DEEP; }

struct Ground { int best; int other; float margin; vec4 near; float sdf; float flux; };

Ground classify(vec2 tf) {
  Ground g;
  vec2 wpf = tf * 16.0;
  vec2 u = tf - 0.5;
  vec2 fl = floor(u);
  vec2 f = u - fl;
  ivec2 t00 = ivec2(fl - uWin);
  vec4 T0 = tileTex(t00), T1 = tileTex(t00 + ivec2(1, 0)), T2 = tileTex(t00 + ivec2(0, 1)), T3 = tileTex(t00 + ivec2(1, 1));
  int c[4];
  c[0] = clsOf(T0); c[1] = clsOf(T1); c[2] = clsOf(T2); c[3] = clsOf(T3);
  float w[4];
  w[0] = (1.0 - f.x) * (1.0 - f.y); w[1] = f.x * (1.0 - f.y); w[2] = (1.0 - f.x) * f.y; w[3] = f.x * f.y;
  float sc[4];
  for (int j = 0; j < 4; j++) {
    float s = 0.0;
    for (int k = 0; k < 4; k++) if (c[k] == c[j]) s += w[k];
    // water and paving get calmer borders than grass/soil
    float amp = (c[j] == PATH || c[j] == FLOOR || c[j] == WALLC) ? 0.16 : 0.3;
    s += amp * (vnoise(wpf * 0.105 + float(c[j]) * 13.7) - 0.5) * 2.0 * (1.0 - s);
    sc[j] = s;
  }
  int bj = 0;
  for (int j = 1; j < 4; j++) if (sc[j] > sc[bj]) bj = j;
  g.best = c[bj];
  float second = -1.0;
  g.other = g.best;
  for (int j = 0; j < 4; j++) if (c[j] != g.best && sc[j] > second) { second = sc[j]; g.other = c[j]; }
  g.margin = second < 0.0 ? 1.0 : sc[bj] - second;
  g.near = f.x > 0.5 ? (f.y > 0.5 ? T3 : T1) : (f.y > 0.5 ? T2 : T0);
  g.sdf = mix(mix(sdfOf(T0), sdfOf(T1), f.x), mix(sdfOf(T2), sdfOf(T3), f.x), f.y);
  g.flux = mix(mix(T0.g, T1.g, f.x), mix(T2.g, T3.g, f.x), f.y);
  return g;
}

// ───────── grass ─────────
// quantum phase colour: cyan -> lilac -> pink cycling slowly ("phase-shifting" tips)
int phaseCol(float h, float t) {
  float ph = fract(t * 0.11 * uMotion + h * 3.7);
  return ph < 0.34 ? Q7 : ph < 0.67 ? Q4 : Q6;
}

// one grass tuft: 3 diverging blades from base b. -1 none, -2 contact shadow under the tuft
int tuftPix(ivec2 p, ivec2 b, float h, int s, float flux, float t) {
  int dx = p.x - b.x;
  int up = b.y - p.y;
  if (dx < -3 || dx > 3 || up < -1 || up > 6) return -1;
  if (up == -1) return (dx >= -1 && dx <= 1) ? -2 : -1;
  for (int k = 0; k < 3; k++) {
    float hk = 2.0 + floor(fract(h * (7.0 + float(k) * 3.1)) * 2.99) + (k == 1 ? 1.0 : 0.0);
    if (float(up) >= hk) continue;
    float lean = float(k - 1) * (0.8 + fract(h * 17.0) * 0.9);
    int x = (k - 1) + int(floor(lean * float(up) / hk + 0.5));
    if (dx != x) continue;
    float tt = float(up) / hk;
    int lvl = tt > 0.62 ? 2 : tt > 0.25 ? 1 : 0;
    bool tip = float(up) >= hk - 1.0;
    if (tip && flux > 0.12 && h < flux * 0.9) return phaseCol(h, t);
    if (s == 3) { int r[3] = int[3](E2, E3, E4); return r[clamp(lvl + (k == 0 ? 1 : 0) - (k == 2 ? 1 : 0), 0, 2)]; }
    if (s == 2) {
      if (k == 0) { int r[3] = int[3](G4, E5, E6); return r[lvl]; }
      if (k == 1) { int r[3] = int[3](G3, G4, E5); return r[lvl]; }
      int r[3] = int[3](E2, E3, G4); return r[lvl];
    }
    int sh = s == 0 ? 1 : 0;
    if (k == 0) { int r[3] = int[3](G4, G5, G6); return r[lvl] + sh; }
    if (k == 1) { int r[3] = int[3](G3, G4, G5); return r[lvl] + sh; }
    int r[3] = int[3](G2, G3, G4); return r[lvl] + sh;
  }
  return -1;
}

// small flower: petals left/right/top, centre, a leaf below
int flowerPix(ivec2 p, ivec2 b, float kind) {
  int dx = p.x - b.x, dy = p.y - b.y;
  int petal, centre;
  if (kind < 0.25) { petal = WHITE; centre = R6; }
  else if (kind < 0.45) { petal = R6; centre = R5; }
  else if (kind < 0.65) { petal = Q6; centre = WHITE; }
  else if (kind < 0.82) { petal = W5; centre = WHITE; }
  else { petal = R3; centre = R6; }
  if (dx == 0 && dy == 0) return centre;
  if ((abs(dx) == 1 && dy == 0) || (dx == 0 && dy == -1)) return petal;
  if (dx == 0 && dy == 1) return G2;
  if (dx == 1 && dy == 1) return G3;
  return -1;
}

int grassPixel(ivec2 ip, vec2 wp, int s, float flux, float t, float d, float edgePx) {
  // calm base: three tones in big soft patches
  float big = vnoise(wp * 0.014 + 3.0);
  float mid = vnoise(wp * 0.055 + 17.0);
  float v = 0.5 + 0.62 * (big - 0.5) + 0.3 * (mid - 0.5);
  int base;
  if (s == 3) {
    int r[5] = int[5](W6, PALE, WHITE, WHITE, WHITE);
    base = ramp(r, 3, v * 1.15 - 0.05, d);
  } else if (s == 2) {
    int r[5] = int[5](G3, G4, E5, E5, E5);
    base = ramp(r, 3, v, d);
  } else if (s == 0) {
    int r[5] = int[5](G4, G5, G6, G6, G6);
    base = ramp(r, 3, v * 0.95, d);
  } else {
    int r[5] = int[5](G3, G4, G5, G5, G5);
    base = ramp(r, 3, v, d);
  }
  if (edgePx < 3.0) return base;

  // detail layer 1: grass tufts on a jittered screen grid, clumped by a low-frequency density field
  float dens = (s == 3 ? 0.12 : 0.18) + (s == 3 ? 0.2 : 0.55) * smoothstep(0.3, 0.75, vnoise(wp * 0.04 + 50.0));
  ivec2 TC = ivec2(9, 6);
  ivec2 c0 = cellOf(ip, TC);
  for (int j = 1; j >= 0; j--) for (int i = -1; i <= 1; i++) {
    ivec2 c = c0 + ivec2(i, j);
    float h = hashk(c, 1);
    if (h > dens) continue;
    ivec2 b = c * TC + ivec2(int(hashk(c, 2) * float(TC.x)), int(hashk(c, 3) * float(TC.y)));
    int r = tuftPix(ip, b, h / max(dens, 0.01), s, flux, t);
    if (r == -2) return s == 3 ? W6 : base - 1;
    if (r >= 0) return r;
  }
  // detail layer 2: flowers (spring/summer), fallen leaves (autumn), sparkle (winter)
  if (s <= 1) {
    float fd = smoothstep(0.55, 0.8, vnoise(wp * 0.03 + 90.0)) * (s == 0 ? 0.7 : 0.4);
    ivec2 FC = ivec2(11, 8);
    ivec2 f0 = cellOf(ip, FC);
    for (int j = 1; j >= 0; j--) for (int i = -1; i <= 1; i++) {
      ivec2 c = f0 + ivec2(i, j);
      if (hashk(c, 4) > fd) continue;
      ivec2 b = c * FC + ivec2(1 + int(hashk(c, 5) * float(FC.x - 2)), 1 + int(hashk(c, 6) * float(FC.y - 2)));
      float kind = vnoise(vec2(c) * 0.21 + 7.0);
      kind = fract(kind * 2.3 + hashk(c, 7) * 0.25);
      int r = flowerPix(ip, b, kind);
      if (r >= 0) return r;
    }
  } else if (s == 2) {
    ivec2 LC = ivec2(8, 6);
    ivec2 c = cellOf(ip, LC);
    float ld = 0.08 + 0.25 * smoothstep(0.4, 0.8, vnoise(wp * 0.03 + 21.0));
    if (hashk(c, 8) < ld) {
      ivec2 b = c * LC + ivec2(int(hashk(c, 9) * 6.0), int(hashk(c, 10) * 5.0));
      ivec2 q = ip - b;
      float k = hashk(c, 11);
      int lc = k < 0.4 ? R3 : k < 0.75 ? R4 : E5;
      if (q.y == 0 && (q.x == 0 || q.x == 1)) return q.x == 0 ? lc : lc + 1;
      if (q.y == 1 && q.x == 1) return lc - 1;
    }
  } else {
    float tw = fract(hashi(ip) * 7.0 + t * 0.35 * uMotion);
    if (hashi(ip + ivec2(3, 1)) > 0.993 && tw < 0.35) return WHITE;
  }
  // quantum meadow: tiny phase glints
  if (flux > 0.2) {
    float tw = fract(hashk(ip, 12) * 5.0 + t * 0.3 * uMotion);
    if (hashk(ip, 13) > 1.0 - 0.004 * flux && tw < 0.4) return phaseCol(hashk(ip, 14), t);
  }
  return base;
}

// ───────── sand ─────────
int sandPixel(ivec2 ip, vec2 wp, float sdf, float d, int s, float edgePx, int other) {
  float n = vnoise(wp * 0.06);
  float v = 0.55 + 0.3 * (n - 0.5);
  int r[5] = int[5](E4, E5, E6, E6, E6);
  int base = ramp(r, 3, v, d);
  // wet band near the waterline
  float wet = smoothstep(-0.9, -0.15, sdf);
  if (wet > 0.0) { int rw[5] = int[5](E3, E4, E5, E5, E5); if (wet > 0.75 || (wet > 0.4 && d < 0.5)) base = ramp(rw, 2, 0.6 - wet * 0.6, d); }
  float rip = sin(wp.x * 0.42 + wp.y * 0.95 + vnoise(wp * 0.07) * 6.0);
  if (rip > 0.93 && wet < 0.2) base = E7;
  else if (rip < -0.96 && wet < 0.2) base = E4;
  // shells and pebbles
  ivec2 c = cellOf(ip, ivec2(10, 7));
  if (hashk(c, 20) < 0.18) {
    ivec2 b = c * ivec2(10, 7) + ivec2(int(hashk(c, 21) * 8.0), int(hashk(c, 22) * 5.0));
    ivec2 q = ip - b;
    float k = hashk(c, 23);
    if (q == ivec2(0)) return k < 0.5 ? PALE : R5;
    if (q == ivec2(1, 0)) return k < 0.5 ? FOG : R4;
    if (q == ivec2(1, 1) || q == ivec2(0, 1)) return E4;
  }
  // dune grass where sand meets grass
  if (other == GRASS && edgePx < 8.0 && s != 3) {
    ivec2 tc = cellOf(ip, ivec2(7, 5));
    if (hashk(tc, 24) < 0.5) {
      ivec2 b = tc * ivec2(7, 5) + ivec2(int(hashk(tc, 25) * 6.0), int(hashk(tc, 26) * 4.0));
      int tp = tuftPix(ip, b, hashk(tc, 27), 2, 0.0, 0.0);
      if (tp >= 0) return tp;
    }
  }
  if (s == 3 && v > 0.52 && wet < 0.3) base = (d < 0.5 ? PALE : WHITE);
  return base;
}

// ───────── paths ─────────
int dirtPixel(ivec2 ip, vec2 wp, float d, float edgePx) {
  float n = vnoise(wp * 0.08 + 5.0);
  float v = 0.45 + 0.35 * (n - 0.5) + clamp((edgePx - 2.0) * 0.06, 0.0, 0.2);
  int r[5] = int[5](E2, E3, E4, E4, E4);
  int base = ramp(r, 3, v, d);
  if (edgePx < 1.5) return E2;
  // worn ruts and pebbles
  ivec2 c = cellOf(ip, ivec2(7, 5));
  if (hashk(c, 30) < 0.3) {
    ivec2 b = c * ivec2(7, 5) + ivec2(int(hashk(c, 31) * 5.0), int(hashk(c, 32) * 4.0));
    ivec2 q = ip - b;
    if (q == ivec2(0)) return FOG;
    if (q == ivec2(1, 0)) return hashk(c, 33) < 0.5 ? MIST : FOG;
    if (q == ivec2(0, 1) || q == ivec2(1, 1)) return E1;
  }
  return base;
}

int cobblePixel(ivec2 ip, vec2 wp, float d) {
  vec2 g = wp / vec2(7.5, 6.0);
  vec2 gi = floor(g);
  float f1 = 9.0, f2 = 9.0;
  ivec2 id1 = ivec2(0);
  vec2 p1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cell = ivec2(gi) + ivec2(i, j);
    vec2 pt = vec2(cell) + 0.5 + 0.34 * vec2(hashi(cell) - 0.5, hashi(cell + ivec2(31, 17)) - 0.5) * 2.0;
    float dist = distance(g, pt);
    if (dist < f1) { f2 = f1; f1 = dist; id1 = cell; p1 = pt; } else if (dist < f2) f2 = dist;
  }
  float edge = (f2 - f1) * 7.0;
  if (edge < 0.8) return E2;
  float sh = hashi(id1 + ivec2(5, 9));
  vec2 rel = g - p1;                         // lit from the top-left (in screen terms: -x-y in world)
  float lit = -(rel.x + rel.y) * 0.9;
  bool grey = hashi(id1 + ivec2(2, 3)) < 0.35;
  int warm[5] = int[5](E3, E4, E5, E6, E7);
  int cool[5] = int[5](STEEL, MIST, FOG, PALE, PALE);
  float v = 0.38 + 0.28 * sh + lit * 0.5;
  if (edge < 1.7) v -= 0.25;
  return grey ? ramp(cool, 4, v, d) : ramp(warm, 4, v, d);
}

// ring-laid paving around a centre (the town plaza and the spawn shrine)
int ringPixel(ivec2 ip, vec2 tf, vec4 C, float d, float t, bool shrine) {
  vec2 rel = tf - C.xy;
  float r = length(rel);
  float R = C.z;
  float a = atan(rel.y, rel.x);
  float wpR = r * 16.0;
  // outer curb
  if (r > R - 0.45) {
    float segs = floor(6.2831 * R / 0.7);
    float sa = (a / 6.2831 + 0.5) * segs;
    float spx = fract(sa) * 6.2831 * R / segs * 16.0;
    if (spx < 1.0 || (R - r) * 16.0 < 1.0) return SLATE;
    float lv = (r - (R - 0.45)) / 0.45;
    return lv < 0.3 ? FOG : lv < 0.75 ? MIST : STEEL;
  }
  float rw = shrine ? 0.36 : 0.52;
  float ri = floor(r / rw);
  float rf = fract(r / rw);
  float circ = 6.2831 * max(r, 0.25);
  float nseg = max(5.0, floor(circ / 0.5));
  float sa = (a / 6.2831 + 0.5) * nseg + ri * 0.5;
  float sf = fract(sa);
  float rpx = rf * rw * 16.0;
  float spx = sf * circ / nseg * 16.0;
  int ring = int(ri);
  if (shrine) {
    // the qubit glyph: a glowing Bloch circle with its state arrow, pulsing through the phase colours
    float pulse = 0.5 + 0.5 * sin(t * 1.6 * uMotion + r * 3.0);
    if (abs(r - 1.55) < 0.07) return pulse > 0.5 ? Q7 : Q4;
    float ang = 0.785;
    vec2 dir = vec2(cos(ang), sin(ang));
    float along = dot(rel, dir), across = abs(rel.x * dir.y - rel.y * dir.x);
    if (along > 0.0 && along < 1.4 && across < 0.06) return pulse > 0.5 ? Q6 : Q5;
    if (r < 0.14) return WHITE;
  }
  if (rpx < 1.0 || spx < 1.0) return shrine ? SLATE : E2;
  float sh = hashi(ivec2(ring * 131 + int(floor(sa)), ring));
  float lit = (rpx < 2.0 || spx < 2.0) ? 0.18 : 0.0;
  // decorative bands: cream rings, grey rings and one inlaid quantum ring
  if (!shrine && ring == 4 && rpx < rw * 16.0 * 0.62) { int q[5] = int[5](Q1, Q2, Q3, Q4, Q4); return ramp(q, 4, 0.35 + 0.4 * sh + lit, d); }
  bool cream = shrine ? (ring % 2 == 0) : (ring % 4 != 2 && ring != 4);
  int warm[5] = int[5](E4, E5, E6, E7, E7);
  int cool[5] = int[5](MIST, FOG, PALE, WHITE, WHITE);
  float v = 0.3 + 0.35 * sh + lit;
  return cream ? ramp(warm, 4, v, d) : ramp(cool, 4, v, d);
}

// ───────── soil / floors ─────────
int soilPixel(ivec2 ip, vec2 wp, bool wet, float d) {
  float row = wp.y / 4.0 + vnoise(wp * 0.07) * 0.25;
  float fr = fract(row);
  float clod = hashi(ip);
  int lv = fr < 0.18 ? 3 : fr < 0.5 ? 2 : fr < 0.75 ? 1 : 0;
  if (clod > 0.93 && lv > 0) lv += 1;
  int dry[5] = int[5](E1, E2, E3, E4, E5);
  int dmp[5] = int[5](E0, E1, E1, E2, E3);
  int c = wet ? dmp[clamp(lv, 0, 4)] : dry[clamp(lv, 0, 4)];
  if (wet && lv == 3 && hashi(ip + ivec2(9, 2)) > 0.85) c = W2;   // a glint of standing water
  return c;
}

int floorPixel(vec2 wp, float d) {
  float rowF = wp.y / 5.0;
  int row = int(floor(rowF));
  float off = float(int(hashi(ivec2(0, row)) * 24.0));
  float px = mod(wp.x + off, 24.0);
  if (fract(rowF) * 5.0 < 1.0 || px < 1.0) return E1;
  float sh = hashi(ivec2(int(floor((wp.x + off) / 24.0)), row));
  float grain = vnoise(vec2(wp.x * 0.3, wp.y * 2.0));
  int r[5] = int[5](E2, E3, E4, E5, E5);
  float v = 0.3 + 0.4 * sh + 0.25 * (grain - 0.5) + (fract(rowF) * 5.0 < 2.0 ? 0.15 : 0.0);
  return ramp(r, 4, v, d);
}

int wallGround(vec2 wp, float d) {
  int r[5] = int[5](SLATE, STEEL, MIST, MIST, MIST);
  return ramp(r, 3, 0.5 + 0.3 * (vnoise(wp * 0.2) - 0.5), d);
}

// ───────── water ─────────
int waterPixel(ivec2 ip, vec2 wp, float sdf, bool deep, float t, float d, int s, float edgePx) {
  float tt = t * uMotion;
  float depth = clamp(sdf, 0.0, 6.0) + (deep ? 1.5 : 0.0) + 0.6 * (vnoise(wp * 0.04 + tt * 0.03) - 0.5);
  int r[5] = int[5](W1, W2, W3, W4, W5);
  int base = ramp(r, 5, 1.0 - depth / 5.0, d);
  if (depth > 4.2 && d < 0.5) base = W0 + 1;
  // slow sky reflection streaks
  float sky = vnoise(vec2(wp.x * 0.02 + wp.y * 0.02, wp.y * 0.09 - wp.x * 0.03) + vec2(tt * 0.04, 0.0));
  if (sky > 0.72 && depth > 0.8) base = min(base + 1, W5);
  // glinting wave dashes on a jittered grid
  ivec2 WC = ivec2(12, 6);
  ivec2 c = cellOf(ip, WC);
  float h = hashk(c, 40);
  float ph = fract(h * 9.0 + tt * (0.18 + 0.1 * h));
  if (ph < 0.55) {
    ivec2 b = c * WC + ivec2(int(hashk(c, 41) * 8.0), int(hashk(c, 42) * 5.0));
    int len = 2 + int(h * 3.0);
    int shift = int(floor(ph * 4.0));
    ivec2 q = ip - b;
    if (q.y == 0 && q.x >= shift && q.x < shift + len) base = depth < 1.2 ? W7 : W6;
    else if (q.y == 1 && q.x >= shift + 1 && q.x < shift + len - 1) base = max(base - 1, W1);
  }
  // sun sparkles
  if (hashk(ip, 43) > 0.9975 && fract(hashk(ip, 44) * 3.0 + tt * 0.5) < 0.2 && depth > 0.6) base = WHITE;
  // shoreline: rolling foam lines and a broken white edge
  if (sdf < 1.1) {
    float wave = fract(sdf * 1.25 - tt * 0.22 + vnoise(wp * 0.12) * 0.35);
    float breakup = vnoise(wp * 0.35 + vec2(tt * 0.4, 0.0));
    if (wave < 0.07 && breakup > 0.42 && sdf > 0.15) base = W6;
    if (edgePx < 2.2 + 1.2 * sin(tt * 1.3 + wp.x * 0.15) && breakup > 0.25) base = edgePx < 1.2 ? WHITE : W7;
  }
  if (s == 3) {
    // frozen shallows with cracks; open dark water further out
    if (sdf < 1.4 + 0.5 * vnoise(wp * 0.05)) {
      float cr = abs(vnoise(wp * 0.09 + 40.0) - 0.5);
      if (cr < 0.02) return W3;
      int ice[5] = int[5](W5, W6, PALE, WHITE, WHITE);
      return ramp(ice, 4, 0.55 + 0.4 * (vnoise(wp * 0.05 + 70.0) - 0.5) + (hashi(ip) > 0.995 ? 0.5 : 0.0), d);
    }
  }
  return base;
}

int bankPixel(int k, int land, int s) {
  if (k == 1) return land == SAND ? E3 : (s == 3 ? MIST : E1);
  if (k == 2) return land == SAND ? E2 : (s == 3 ? STEEL : E0);
  return -1;
}

void main() {
  vec2 sp = floor(vUV * uRes);
  vec2 iso = uIso + sp + 0.5;
  vec2 tf = isoToTile(iso);
  vec2 wpf = tf * 16.0;
  ivec2 ip = ivec2(floor(uIso + sp));
  float d = bayer(ip);
  float t = uTime;
  int s = int(uSeason + 0.5);

  Ground g = classify(tf);
  float fw = fwidth(g.margin);
  float edgePx = g.other == g.best ? 99.0 : g.margin / max(fw, 0.0005);
  int style = int(g.near.b * 255.0 + 0.5);

  int c;
  if (isWater(g.best)) {
    c = waterPixel(ip, wpf, g.sdf, g.best == DEEP, t, d, s, isWater(g.other) ? 99.0 : edgePx);
    // banks: land sits a little above the water, so the strip just below a shore shows earth
    if (g.sdf < 1.5 && !(s == 3 && g.sdf < 1.4)) {
      for (int k = 1; k <= 3; k++) {
        Ground g2 = classify(isoToTile(iso - vec2(0.0, float(k))));
        if (!isWater(g2.best)) {
          int b = bankPixel(k, g2.best, s);
          if (b >= 0) c = b; else if (c > W1 && c <= W7) c -= 1;
          break;
        }
      }
    }
  } else if (g.best == GRASS) {
    c = grassPixel(ip, wpf, s, g.flux, t, d, edgePx);
    // wind gusts ripple across the meadow as travelling lighter bands (same field the swaying plants follow)
    if (uMotion > 0.5 && s != 3 && edgePx > 3.0 && c >= G3 && c < G6) {
      vec2 wd = normalize(uWind.xy + 1e-4);
      float ph = dot(tf, wd) * 0.72 - t * (0.6 + 1.6 * uWind.z) + 1.7 * sin(dot(tf, vec2(-wd.y, wd.x)) * 0.32);
      float band = smoothstep(0.78, 0.97, 0.5 + 0.5 * sin(ph)) * smoothstep(0.08, 0.5, uWind.z);
      if (d < band * 0.85) c += 1;
    }
    if (g.other != GRASS && edgePx < 2.6) {
      // a lit lip and a dark outline where turf meets anything else
      if (edgePx < 1.1) c = s == 3 ? FOG : (isWater(g.other) ? G2 : G2);
      else c = s == 3 ? WHITE : (s == 2 ? E6 : (s == 0 ? G6 : G5));
    }
  } else if (g.best == SAND) {
    c = sandPixel(ip, wpf, g.sdf, d, s, edgePx, g.other);
  } else if (g.best == PATH) {
    if (style == 2 && distance(tf, uPlaza.xy) < uPlaza.z) c = ringPixel(ip, tf, uPlaza, d, t, false);
    else if (style == 3 && distance(tf, uShrine.xy) < uShrine.z) c = ringPixel(ip, tf, uShrine, d, t, true);
    else if (style >= 1) { c = cobblePixel(ip, wpf, d); if (g.other != PATH && edgePx < 1.6) c = SLATE; }
    else c = dirtPixel(ip, wpf, d, g.other != PATH ? edgePx : 99.0);
    if (s == 3 && style == 0 && vnoise(wpf * 0.08) > 0.6) c = d < 0.5 ? PALE : WHITE;
  } else if (g.best == SOIL || g.best == SOILWET) {
    c = soilPixel(ip, wpf, g.best == SOILWET, d);
    if (g.other != g.best && edgePx < 1.5) c = E0 + 1;
    if (s == 3 && g.best == SOIL && hashi(ip) > 0.7 && fract(wpf.y / 4.0) < 0.4) c = PALE;
  } else if (g.best == FLOOR) {
    c = floorPixel(wpf, d);
  } else {
    c = wallGround(wpf, d);
  }
  vec3 col = P(c);

  // drifting cloud shadows (soft, dithered, never in winter overcast)
  float cloud = vnoise(wpf * 0.006 + vec2(t * 0.012, t * 0.005) * uMotion);
  if (cloud > 0.64 && s != 3) col *= (cloud > 0.7 || d > 0.5) ? 0.86 : 1.0;

  fragColor = vec4(col, 1.0);
}`;
