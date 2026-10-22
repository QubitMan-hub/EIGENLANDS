import { PALETTE } from '@eigenlands/shared';

const pal = PALETTE.map((h) => {
  const n = parseInt(h.slice(1), 16);
  const f = (v: number) => (v / 255).toFixed(4);
  return `vec3(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}).join(',');

/** Surface height (art px, + up) of each ground class; PATH depends on its paving style. Mirrored in terrain.ts. */
export const GROUND_Z = { water: -7, grass: 0, sand: -2, dirt: -2, road: -1, plaza: 0, soil: -2, floor: 0, wall: 0 } as const;

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
 * Block-tile terrain painter. Every tile is an isometric block (a 32x16 diamond top) whose surface height depends
 * on its ground class: water sits 7px down, sand / dirt / tilled soil 2px, roads 1px, grass and paving at 0. Each
 * screen art-pixel marches a short vertical ray (one step per pixel, front to back) through those heights, so it
 * lands either on a tile's top face or on one of the two camera-facing side faces (left = lit, right = shaded).
 * Tops are painted from the palette with clustered, dither-free detail (leafy grass clumps, cracked dirt, cobbles,
 * the ring-laid plaza, furrows, planks, layered water with ripple lines); sides show soil / sand strata / stone
 * courses under an overhanging grass lip, and a cyan foam line where a bank meets the water.
 *
 * Tile texel: r = ground class, g = biome * 32 + quantum flux (0..31), b = paving style (1 road, 2 plaza, 3 shrine),
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
uniform vec4 uShrine;       // spawn shrine centre (tiles) + radius
uniform vec3 uWind;         // world wind: direction xy + strength 0..1 (same field the swaying plants follow)

const vec3 PAL[48] = vec3[48](${pal});

const int B_MEADOW = 0, B_FOREST = 1, B_AUTUMN = 2, B_TAIGA = 3, B_SWAMP = 4, B_DESERT = 5, B_ENCHANTED = 6, B_CORRUPT = 7;
const int DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, SOIL = 5, SOILWET = 6, FLOOR = 7, WALLC = 8;
const int INK=0, NIGHT=1, SLATE=2, STEEL=3, MIST=4, FOG=5, PALE=6, WHITE=7;
const int G0=8, G1=9, G2=10, G3=11, G4=12, G5=13, G6=14, G7=15;
const int E0=16, E1=17, E2=18, E3=19, E4=20, E5=21, E6=22, E7=23;
const int W0=24, W1=25, W2=26, W3=27, W4=28, W5=29, W6=30, W7=31;
const int R0=32, R1=33, R2=34, R3=35, R4=36, R5=37, R6=38, R7=39;
const int Q0=40, Q1=41, Q2=42, Q3=43, Q4=44, Q5=45, Q6=46, Q7=47;

const float Z_WATER = ${GROUND_Z.water}.0;
const int STEPS = 9;          // ray samples from z = 0 down to z = -8

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
// two rotated octaves: breaks the axis-aligned look of a single value-noise lattice
float fbm(vec2 p) {
  vec2 r = vec2(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8);
  return vnoise(p) * 0.55 + vnoise(r * 2.1 + 17.3) * 0.3 + vnoise(r.yx * 4.3 - 5.1) * 0.15;
}
vec3 P(int i) { return PAL[clamp(i, 0, 47)]; }
ivec2 cellOf(ivec2 p, ivec2 size) { return ivec2(floor(vec2(p) / vec2(size))); }
vec2 isoToTile(vec2 iso) { return vec2(iso.y / 16.0 + iso.x / 32.0, iso.y / 16.0 - iso.x / 32.0); }

// ───────── tiles ─────────
vec4 tileAt(ivec2 t) { int hi = int(uWinSize) - 1; return texelFetch(uTiles, clamp(t - ivec2(uWin), ivec2(0), ivec2(hi)), 0); }
int clsOf(vec4 t) { return int(t.r * 255.0 + 0.5); }
int styleOf(vec4 t) { return int(t.b * 255.0 + 0.5); }
float sdfOf(vec4 t) { return (t.a * 255.0 - 128.0) / 12.0; }
bool isWater(int c) { return c == WATER || c == DEEP; }
float heightOf(vec4 t) {
  int c = clsOf(t);
  if (c == WATER || c == DEEP) return Z_WATER;
  if (c == SAND) return ${GROUND_Z.sand}.0;
  if (c == SOIL || c == SOILWET) return ${GROUND_Z.soil}.0;
  if (c == PATH) { int s = styleOf(t); return s >= 2 ? ${GROUND_Z.plaza}.0 : s == 1 ? ${GROUND_Z.road}.0 : ${GROUND_Z.dirt}.0; }
  return 0.0;
}
float sdfAt(vec2 tf) {
  vec2 u = tf - 0.5;
  ivec2 b = ivec2(floor(u));
  vec2 f = u - floor(u);
  float a = sdfOf(tileAt(b)), c = sdfOf(tileAt(b + ivec2(1, 0))), d = sdfOf(tileAt(b + ivec2(0, 1))), e = sdfOf(tileAt(b + ivec2(1, 1)));
  return mix(mix(a, c, f.x), mix(d, e, f.x), f.y);
}
int biomeOf(vec4 t) { return int(t.g * 255.0 + 0.5) / 32; }
float fluxOf(vec4 t) { return float(int(t.g * 255.0 + 0.5) % 32) / 31.0; }
float fluxAt(vec2 tf) {
  vec2 u = tf - 0.5;
  ivec2 b = ivec2(floor(u));
  vec2 f = u - floor(u);
  return mix(mix(fluxOf(tileAt(b)), fluxOf(tileAt(b + ivec2(1, 0))), f.x), mix(fluxOf(tileAt(b + ivec2(0, 1))), fluxOf(tileAt(b + ivec2(1, 1))), f.x), f.y);
}
// biome under a pixel, sampled with a little jitter so borders interlock like real ecotones
int biomeAtPx(vec2 tf, ivec2 ip) {
  vec2 j = (vec2(vnoise(tf * 0.7), vnoise(tf * 0.7 + 9.0)) - 0.5) * 1.3 + (vec2(vnoise(tf * 2.3 + 4.0), vnoise(tf * 2.3 - 4.0)) - 0.5) * 0.5;
  return biomeOf(tileAt(ivec2(floor(tf + j))));
}
// effective season of a biome: the tundra is always snowed in, Amberwood always in autumn colour
int seasonOf(int b, int s) { return b == B_TAIGA ? 3 : b == B_AUTUMN ? 2 : s; }

// quantum phase colour for rare glints: cyan -> lilac -> pink
int phaseCol(float h, float t) {
  float ph = fract(t * 0.11 * uMotion + h * 3.7);
  return ph < 0.34 ? Q7 : ph < 0.67 ? Q4 : Q6;
}

// ───────── grass ─────────
// tone set for a patch: base, clump body, clump highlight, shade, deep shade
struct Tones { int base; int body; int hi; int sh; int dk; };
Tones grassTones(int s, bool lush) {
  Tones T;
  if (s == 3) { T.base = PALE; T.body = PALE; T.hi = WHITE; T.sh = FOG; T.dk = MIST; return T; }
  if (s == 2) {
    if (lush) { T.base = G5; T.body = G5; T.hi = R6; T.sh = G4; T.dk = G3; }
    else { T.base = G2; T.body = G4; T.hi = R5; T.sh = G1; T.dk = G1; }
    return T;
  }
  if (lush) { T.base = G6; T.body = G6; T.hi = G7; T.sh = G5; T.dk = G4; }
  else { T.base = G3; T.body = G5; T.hi = G6; T.sh = G2; T.dk = G2; }
  if (s == 0 && !lush) { T.base = G4; T.body = G5; T.hi = G6; T.sh = G3; T.dk = G3; }
  return T;
}

// leafy clumps on a jittered grid (world-anchored screen px): lit top-left crown, dark underside, no outline.
// Clumps overlap front-to-back; big scales them (dense turf uses big leafy ones, meadows small tufty ones).
int clumpPix(ivec2 ip, float dens, float big, Tones T, out bool hit) {
  hit = false;
  ivec2 CS = ivec2(int(7.0 + 4.0 * big), int(4.0 + 3.0 * big));
  ivec2 c0 = cellOf(ip, CS);
  float bestY = -1e9;
  int col = -1;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = c0 + ivec2(i, j);
    if (hashk(c, 1) > dens) continue;
    vec2 ctr = vec2(c * CS) + vec2(hashk(c, 2), hashk(c, 3)) * vec2(CS);
    float rx = (1.8 + hashk(c, 4) * 1.6) * (0.8 + big * 0.9), ry = rx * (0.55 + hashk(c, 5) * 0.15);
    vec2 q = (vec2(ip) + 0.5 - ctr);
    vec2 n = q / vec2(rx, ry);
    float dd = dot(n, n);
    // jagged leaf rim: a per-pixel wobble so the silhouette reads as leaves, plus a notch on top
    float wob = (hashi(ip + c * 3) - 0.5) * 0.7;
    if (dd < 1.0 + wob && ctr.y > bestY) {
      bestY = ctr.y;
      float lit = -(n.x * 0.5 + n.y * 0.9) + (hashi(ip * 2 + c) - 0.5) * 0.35;
      col = lit > 0.45 ? T.hi : lit < -0.6 ? T.sh : T.body;
    }
  }
  if (col >= 0) hit = true;
  return col;
}

// small 3-blade tuft (^) in a darker tone, base at b
int tuftPix(ivec2 p, ivec2 b, int c, int cHi) {
  int dx = p.x - b.x, up = b.y - p.y;
  if (up < 0 || up > 2) return -1;
  if (up == 0 && abs(dx) <= 1) return c;
  if (up == 1 && (dx == -1 || dx == 1)) return c;
  if (up == 2 && (dx == -2 || dx == 1)) return cHi;
  return -1;
}

int flowerPix(ivec2 p, ivec2 b, float kind) {
  int dx = p.x - b.x, dy = p.y - b.y;
  int petal, centre;
  if (kind < 0.3) { petal = R3; centre = R6; }
  else if (kind < 0.5) { petal = R6; centre = R4; }
  else if (kind < 0.7) { petal = Q5; centre = Q6; }
  else if (kind < 0.85) { petal = WHITE; centre = R6; }
  else { petal = Q4; centre = WHITE; }
  if (dx == 0 && dy == 0) return centre;
  if ((abs(dx) == 1 && dy == 0) || (dx == 0 && dy == -1)) return petal;
  if (dx == 0 && dy == 1) return G3;
  return -1;
}

Tones biomeTones(int b, int s, bool lush) {
  Tones T = grassTones(s, lush);
  if (b == B_SWAMP) {          // fen: deep moss with peaty hollows
    if (lush) { T.base = G2; T.body = G2; T.hi = G4; T.sh = G1; T.dk = G0; }
    else { T.base = G1; T.body = G2; T.hi = G3; T.sh = G0; T.dk = NIGHT; }
  } else if (b == B_ENCHANTED) {   // glade: cool teal turf with luminous tips
    if (lush) { T.base = G3; T.body = W3; T.hi = Q7; T.sh = G2; T.dk = Q1; }
    else { T.base = G2; T.body = W2; T.hi = W5; T.sh = G1; T.dk = Q0; }
  } else if (b == B_CORRUPT) {     // wastes: ashen slate earth bruised violet, with sickly tufts
    if (lush) { T.base = Q0; T.body = Q1; T.hi = Q2; T.sh = NIGHT; T.dk = INK; }
    else { T.base = SLATE; T.body = Q0; T.hi = STEEL; T.sh = NIGHT; T.dk = INK; }
  } else if (b == B_FOREST && !lush && s != 3) { T.base = G2; T.body = G3; T.hi = G5; T.sh = G1; T.dk = G1; }  // shaded woodland floor
  else if (b == B_DESERT) { T.base = E5; T.body = G5; T.hi = G6; T.sh = E4; T.dk = E3; }   // oasis scrub
  return T;
}

// snowfield: soft drifts (bone white with cool blue-grey hollows), wind-sculpted ridges, dead grass poking through
int snowTop(ivec2 ip, vec2 tf, float t) {
  vec2 wp = vec2(ip);
  float n = vnoise(wp * 0.03) * 0.7 + vnoise(wp * 0.09 + 7.0) * 0.3;
  // bright powder, faintly icy mid-tones, cool blue-grey hollows only in the deepest drift shadows
  int c = n > 0.5 ? WHITE : n > 0.24 ? W7 : PALE;
  float ridge = sin(wp.x * 0.16 + wp.y * 0.34 + vnoise(wp * 0.05) * 5.0);
  if (ridge > 0.9 && n > 0.3) c = WHITE;
  else if (ridge < -0.94) c = n > 0.5 ? W7 : PALE;                // wind-carved drift edges
  ivec2 cc = cellOf(ip, ivec2(9, 6));
  if (hashk(cc, 61) < 0.18) {
    ivec2 q = ip - (cc * ivec2(9, 6) + ivec2(int(hashk(cc, 62) * 7.0), int(hashk(cc, 63) * 4.0)));
    if ((q.x == 0 && q.y >= -2 && q.y <= 0) || (q.x == 2 && q.y >= -1 && q.y <= 0)) return q.y == -2 ? E4 : MIST;
  }
  if (hashi(ip + ivec2(3, 1)) > 0.996 && fract(hashi(ip) * 7.0 + t * 0.35 * uMotion) < 0.35) return W7;   // ice glitter
  return c;
}

int grassTop(ivec2 ip, vec2 tf, int s, float flux, float t, int b) {
  vec2 wp = vec2(ip);
  if (s == 3) return snowTop(ip, tf, t);
  // large soft regions of sunlit lime meadow vs. deeper leafy turf
  float lushN = fbm(tf * 0.2 + 3.0);
  bool lush = lushN > (s == 0 ? 0.46 : 0.55);
  Tones T = biomeTones(b, s, lush);
  int c = T.base;
  float dn = fbm(tf * 0.5 + 50.0);
  float dens = lush ? 0.12 + 0.25 * smoothstep(0.4, 0.8, dn) : 0.8 + 0.2 * dn;
  float big = lush ? 0.0 : 0.35 + 0.65 * smoothstep(0.3, 0.75, fbm(tf * 0.35 + 70.0));
  if (s == 3) { dens *= 0.35; big = 0.0; }
  bool hit;
  int cl = clumpPix(ip, dens, big, T, hit);
  if (hit) return cl;
  if (lush) {
    // meadow: soft lighter/darker patches and fine tufts
    float pn = vnoise(wp * 0.08 + 31.0) * 0.75 + hashi(ip / 2) * 0.25;
    if (pn > 0.74) c = T.hi;
    else if (pn < 0.2) c = T.sh;
  }
  ivec2 TC = ivec2(6, 4);
  ivec2 tc = cellOf(ip, TC);
  for (int j = 0; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cc = tc + ivec2(i, j);
    if (hashk(cc, 6) > (lush ? 0.2 : 0.25)) continue;
    ivec2 b = cc * TC + ivec2(int(hashk(cc, 7) * 5.0), int(hashk(cc, 8) * 3.0));
    int r = tuftPix(ip, b, lush ? T.sh : T.body, lush ? T.dk : T.hi);
    if (r >= 0) return r;
  }
  // flowers (spring/summer), fallen leaves (autumn), glitter (winter)
  if (s <= 1 && b != B_CORRUPT && b != B_SWAMP) {
    float fd = smoothstep(0.6, 0.85, vnoise(tf * 0.4 + 90.0)) * (s == 0 ? 0.6 : 0.35) * (b == B_ENCHANTED ? 1.6 : 1.0);
    ivec2 FC = ivec2(11, 7);
    ivec2 f0 = cellOf(ip, FC);
    for (int j = 1; j >= 0; j--) for (int i = -1; i <= 1; i++) {
      ivec2 cc = f0 + ivec2(i, j);
      if (hashk(cc, 9) > fd) continue;
      ivec2 b = cc * FC + ivec2(1 + int(hashk(cc, 10) * float(FC.x - 2)), 1 + int(hashk(cc, 11) * float(FC.y - 2)));
      int r = flowerPix(ip, b, fract(vnoise(vec2(cc) * 0.2) * 2.3 + hashk(cc, 12) * 0.2));
      if (r >= 0) return r;
    }
  } else if (s == 2) {
    ivec2 LC = ivec2(8, 6);
    ivec2 cc = cellOf(ip, LC);
    if (hashk(cc, 13) < 0.22) {
      ivec2 q = ip - (cc * LC + ivec2(int(hashk(cc, 14) * 6.0), int(hashk(cc, 15) * 5.0)));
      int lc = hashk(cc, 16) < 0.5 ? R3 : R4;
      if (q.y == 0 && (q.x == 0 || q.x == 1)) return q.x == 0 ? lc : lc + 1;
      if (q.y == 1 && q.x == 1) return R1;
    }
  } else if (hashi(ip + ivec2(3, 1)) > 0.994 && fract(hashi(ip) * 7.0 + t * 0.35 * uMotion) < 0.35) return WHITE;
  // quantum meadow: rare phase glints
  float glint = b == B_ENCHANTED ? 0.02 : b == B_CORRUPT ? 0.01 : 0.005 * flux;
  if (flux > 0.2 || b >= B_ENCHANTED) {
    float tw = fract(hashk(ip, 17) * 5.0 + t * 0.3 * uMotion);
    if (hashk(ip, 18) > 1.0 - glint && tw < 0.4) return b == B_CORRUPT ? (hashk(ip, 19) < 0.5 ? Q5 : Q3) : phaseCol(hashk(ip, 19), t);
  }
  // fen: still puddles of black water among the moss
  if (b == B_SWAMP) {
    float pd = vnoise(wp * 0.045 + 13.0);
    if (pd > 0.7) return pd > 0.76 ? W0 : (hashi(ip) > 0.5 ? G0 : W1);
  }
  // wastes: cracked ground
  if (b == B_CORRUPT && abs(vnoise(wp * 0.07 + 5.0) - 0.5) < 0.018) return NIGHT;
  return c;
}

// ───────── sand / dirt / soil ─────────
int sandTop(ivec2 ip, float sdf, int s) {
  vec2 wp = vec2(ip);
  int c = E6;
  float n = vnoise(wp * 0.035) * 0.7 + vnoise(wp * 0.12) * 0.3;
  if (n > 0.64) c = E7;
  else if (n < 0.22) c = E5;
  // long wind ripples across the dunes, lit on one flank
  float dr = sin(wp.x * 0.3 + wp.y * 0.62 + vnoise(wp * 0.04) * 7.0);
  if (dr > 0.92 && sdf < -1.5) c = c == E5 ? E6 : E7; else if (dr < -0.9 && sdf < -1.5) c = c == E7 ? E6 : E5;
  float rip = sin(wp.x * 0.42 + wp.y * 0.95 + vnoise(wp * 0.07) * 6.0);
  if (rip > 0.975 && n > 0.4) c = E7; else if (rip < -0.985) c = E5;
  if (sdf > -0.75) c = sdf > -0.35 ? E4 : E5;            // wet sand along the waterline
  ivec2 cc = cellOf(ip, ivec2(10, 7));
  if (hashk(cc, 20) < 0.2) {
    ivec2 q = ip - (cc * ivec2(10, 7) + ivec2(int(hashk(cc, 21) * 8.0), int(hashk(cc, 22) * 5.0)));
    if (q == ivec2(0)) return hashk(cc, 23) < 0.5 ? PALE : R6;
    if (q == ivec2(1, 0)) return FOG;
    if (q == ivec2(0, 1) || q == ivec2(1, 1)) return E4;
  }
  if (s == 3 && n > 0.45 && sdf < -0.6) c = n > 0.6 ? WHITE : PALE;
  return c;
}

int dirtTop(ivec2 ip, int s) {
  vec2 wp = vec2(ip);
  int c = E4;
  float n = vnoise(wp * 0.07 + 5.0);
  if (n > 0.64) c = E5;
  else if (n < 0.24) c = E3;
  // dry cracks: thin warped iso-lines
  float cr = abs(vnoise(wp * vec2(0.11, 0.2) + 40.0) - 0.5);
  if (cr < 0.022) c = E3;
  if (cr < 0.022 && hashi(ip) > 0.6) c = E2;
  // pebbles: lit top-left, shaded below
  ivec2 cc = cellOf(ip, ivec2(8, 5));
  if (hashk(cc, 30) < 0.28) {
    ivec2 q = ip - (cc * ivec2(8, 5) + ivec2(int(hashk(cc, 31) * 6.0), int(hashk(cc, 32) * 3.0)));
    if (q == ivec2(0)) return E6;
    if (q == ivec2(1, 0)) return E5;
    if (q == ivec2(0, 1) || q == ivec2(1, 1)) return E2;
  }
  if (s == 3 && vnoise(wp * 0.08) > 0.58) c = vnoise(wp * 0.3) > 0.5 ? WHITE : PALE;
  return c;
}

int soilTop(ivec2 ip, vec2 tf, bool wet, int s) {
  vec2 wp = vec2(ip);
  // furrows run along the tile x axis: rows of rounded ridges
  float row = tf.y * 4.0 + vnoise(wp * 0.08) * 0.18;
  float fr = fract(row);
  int c;
  if (wet) c = fr < 0.22 ? E1 : fr < 0.5 ? R0 : fr < 0.8 ? E2 : R0;
  else c = fr < 0.22 ? R0 : fr < 0.45 ? R1 : fr < 0.8 ? R1 : E3;
  if (!wet && fr > 0.3 && fr < 0.45 && hashi(ip) > 0.55) c = E4;     // lit clods on the ridge
  if (wet && fr < 0.22 && hashi(ip + ivec2(9, 2)) > 0.82) c = W2;    // a glint of standing water
  if (s == 3 && !wet && fr > 0.25 && fr < 0.5 && hashi(ip) > 0.35) c = PALE;
  return c;
}

// ───────── paving ─────────
int cobbleTop(ivec2 ip, vec2 tf) {
  vec2 g = tf * vec2(2.7, 2.7);
  vec2 gi = floor(g);
  float f1 = 9.0, f2 = 9.0;
  ivec2 id1 = ivec2(0);
  vec2 p1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cell = ivec2(gi) + ivec2(i, j);
    vec2 pt = vec2(cell) + 0.5 + 0.32 * (vec2(hashi(cell), hashi(cell + ivec2(31, 17))) - 0.5) * 2.0;
    float dist = distance(g, pt);
    if (dist < f1) { f2 = f1; f1 = dist; id1 = cell; p1 = pt; } else if (dist < f2) f2 = dist;
  }
  float edge = (f2 - f1) * 6.0;
  if (edge < 0.55) return STEEL;
  vec2 rel = g - p1;
  float lit = -(rel.x + rel.y);                // tile -x/-y = screen up: lit from the top-left
  bool warm = hashi(id1 + ivec2(2, 3)) < 0.1;
  float v = 0.45 + lit * 1.1 + (hashi(id1 + ivec2(5, 9)) - 0.5) * 0.35;
  if (edge < 1.3) v -= 0.4;
  if (warm) return v > 0.75 ? E5 : v > 0.3 ? E4 : E3;
  return v > 0.8 ? PALE : v > 0.3 ? FOG : MIST;
}

// ring-laid paving around a centre (the town plaza and the spawn shrine)
int ringTop(ivec2 ip, vec2 tf, vec4 C, float t, bool shrine) {
  vec2 rel = tf - C.xy;
  float r = length(rel);
  float R = C.z;
  float a = atan(rel.y, rel.x);
  if (r > R - 0.45) {
    float segs = floor(6.2831 * R / 0.7);
    float spx = fract((a / 6.2831 + 0.5) * segs) * 6.2831 * R / segs * 16.0;
    if (spx < 1.0) return STEEL;
    float lv = (r - (R - 0.45)) / 0.45;
    return lv < 0.35 ? PALE : lv < 0.8 ? FOG : MIST;
  }
  float rw = shrine ? 0.36 : 0.52;
  float ri = floor(r / rw);
  float rpx = fract(r / rw) * rw * 16.0;
  float circ = 6.2831 * max(r, 0.25);
  float nseg = max(5.0, floor(circ / 0.5));
  float sa = (a / 6.2831 + 0.5) * nseg + ri * 0.5;
  float spx = fract(sa) * circ / nseg * 16.0;
  int ring = int(ri);
  if (shrine) {
    // the qubit glyph: a glowing Bloch circle with its state arrow, slowly pulsing
    float pulse = 0.5 + 0.5 * sin(t * 1.6 * uMotion + r * 3.0);
    if (abs(r - 1.55) < 0.07) return pulse > 0.5 ? Q7 : W6;
    vec2 dir = vec2(0.7071, 0.7071);
    float along = dot(rel, dir), across = abs(rel.x * dir.y - rel.y * dir.x);
    if (along > 0.0 && along < 1.4 && across < 0.06) return pulse > 0.5 ? Q6 : Q5;
    if (r < 0.14) return WHITE;
  }
  if (rpx < 1.0 || spx < 1.0) return shrine ? STEEL : MIST;
  float sh = hashi(ivec2(ring * 131 + int(floor(sa)), ring));
  bool lit = rpx < 2.0 || spx < 2.0;
  if (!shrine && ring == 4 && rpx < rw * 16.0 * 0.62) return lit ? Q4 : (sh > 0.5 ? Q3 : Q2);
  bool cream = shrine ? (ring % 2 == 0) : (ring % 4 != 2 && ring != 4);
  if (cream) return lit ? E7 : sh > 0.66 ? E5 : E6;
  return lit ? PALE : sh > 0.6 ? MIST : FOG;
}

int floorTop(vec2 tf) {
  vec2 wp = tf * 16.0;
  float rowF = wp.y / 5.0;
  int row = int(floor(rowF));
  float off = float(int(hashi(ivec2(0, row)) * 24.0));
  float px = mod(wp.x + off, 24.0);
  if (fract(rowF) * 5.0 < 1.0 || px < 1.0) return E2;
  float sh = hashi(ivec2(int(floor((wp.x + off) / 24.0)), row));
  if (fract(rowF) * 5.0 < 2.0) return sh > 0.5 ? E5 : E4;
  return sh > 0.7 ? E4 : E3;
}

// ───────── water ─────────
int waterTop(ivec2 ip, vec2 tf, float sdf, bool deep, float t, int s, int b) {
  float tt = t * uMotion;
  vec2 wp = vec2(ip);
  // layered depth bands with soft, wobbling contours (deep navy far out, slate-blue shelves near the banks)
  float depth = sdf + (deep ? 1.6 : 0.0) + 0.55 * (vnoise(wp * 0.05 + vec2(tt * 0.05, 0.0)) - 0.5);
  int c = depth < 0.6 ? W3 : depth < 1.5 ? W2 : depth < 3.6 ? W1 : W0;
  // ripple lines: long, gently slanted streaks (along the iso axes) on a jittered grid; they drift and fade
  ivec2 RC = ivec2(18, 7);
  int drift = int(floor(tt * 1.5));
  ivec2 ipd = ip + ivec2(drift, 0);
  ivec2 rc0 = cellOf(ipd, RC);
  for (int j = 0; j <= 1; j++) for (int i = -1; i <= 0; i++) {
    ivec2 cc = rc0 + ivec2(i, j);
    float h = hashk(cc, 40);
    if (h > 0.6) continue;
    float ph = fract(h * 7.0 + tt * 0.2);
    if (ph > 0.8) continue;
    ivec2 b = cc * RC + ivec2(int(hashk(cc, 41) * 8.0), int(hashk(cc, 42) * 5.0));
    ivec2 q = ipd - b;
    int len = 6 + int(h * 14.0);
    int dir = hashk(cc, 45) < 0.5 ? 1 : -1;
    int yy = (dir > 0 ? q.x : (len - 1 - q.x)) / 4;            // 1px rise every 4px: a flat, wavy streak
    if (q.x >= 0 && q.x < len && q.y == yy) c = depth < 1.4 ? W4 : depth < 2.8 ? W3 : W2;
    else if (q.x >= 1 && q.x < len - 1 && q.y == yy + 1) c = depth < 0.55 ? W2 : max(c - 1, W0);
  }
  if (hashk(ip, 43) > 0.9975 && fract(hashk(ip, 44) * 3.0 + tt * 0.5) < 0.2) c = W6;   // sparkles
  if (b == B_SWAMP) c = c >= W4 ? G3 : c == W3 ? G1 : c == W2 ? G0 : NIGHT;           // tannin-dark fen water
  else if (b == B_CORRUPT) c = c >= W4 ? Q3 : c == W3 ? Q1 : c == W2 ? Q0 : INK;     // ink-black, violet glints
  else if (b == B_ENCHANTED && c >= W3) c = c >= W4 ? Q7 : W4;                       // glowing glade pools
  if (s == 3 && sdf < 1.3 + 0.5 * vnoise(wp * 0.05)) {
    // frozen shallows with cracks
    float cr = abs(vnoise(wp * 0.09 + 40.0) - 0.5);
    if (cr < 0.02) return W4;
    float v = vnoise(wp * 0.05 + 70.0);
    return v > 0.62 ? W7 : v > 0.3 ? W6 : W5;
  }
  return c;
}

// ───────── side faces ─────────
// k: 0 earth (under grass/dirt/soil), 1 sand, 2 stone; left = lit face; d = px below the top edge; H = face height
int sideEarth(ivec2 ip, bool left, int d) {
  vec2 wp = vec2(ip);
  float n = vnoise(wp * vec2(0.22, 0.5) + (left ? 3.0 : 9.0));
  int c = left ? E1 : E0;
  if (n > 0.62) c = left ? E2 : E1;
  if (left && n > 0.8) c = R0;
  if (hashi(ip) > 0.93) c = left ? E2 : E1;                // grit
  if (n < 0.18) c = left ? E0 : INK + 1;
  return c;
}
int sideSand(ivec2 ip, bool left, int d) {
  float n = vnoise(vec2(ip) * vec2(0.15, 0.6) + 7.0);
  int c = left ? E5 : E4;
  if ((d % 3) == 2) c = left ? E4 : E3;                     // strata
  if (n > 0.7) c = left ? E6 : E5;
  return c;
}
int sideStone(ivec2 ip, vec2 tf, bool left, int d) {
  float u = (left ? tf.x : tf.y) * 16.0;
  int row = (d - 1) / 4;
  float off = row % 2 == 1 ? 5.0 : 0.0;
  if ((d - 1) % 4 == 3 || mod(floor(u + off), 10.0) < 1.0) return left ? STEEL : SLATE;
  float sh = hashi(ivec2(int(floor((u + off) / 10.0)), row + 7));
  if ((d - 1) % 4 == 0) return left ? FOG : MIST;
  return left ? (sh > 0.6 ? FOG : MIST) : (sh > 0.6 ? MIST : STEEL);
}

void main() {
  vec2 sp = floor(vUV * uRes);
  vec2 iso = uIso + sp + 0.5;
  float t = uTime;
  int s = int(uSeason + 0.5);

  // ── march: front-most surface first. At z the ray sits over ground position (iso.x, iso.y + z).
  ivec2 prevT = ivec2(-2147483);
  float prevH = 99.0;
  ivec2 T0 = ivec2(0);
  vec4 X0 = vec4(0.0);
  vec2 tfHit = vec2(0.0);
  float hHit = 0.0;
  int face = 0;      // 0 top, 1 left (+y) side, 2 right (+x) side
  int dPx = 0;
  for (int k = 0; k < STEPS; k++) {
    float z = -float(k);
    vec2 tf = isoToTile(vec2(iso.x, iso.y + z));
    ivec2 tt = ivec2(floor(tf));
    vec4 X = tileAt(tt);
    float h = heightOf(X);
    if (h >= z - 0.001) {
      T0 = tt; X0 = X; hHit = h; tfHit = tf;
      if (h < z + 0.5 || tt == prevT) { face = 0; tfHit = isoToTile(vec2(iso.x, iso.y + h)); }
      else {
        dPx = int(h - z + 0.5);
        bool crossX = prevT.x != tt.x, crossY = prevT.y != tt.y;
        if (crossX && crossY) { vec2 f = fract(tf); face = f.x > f.y ? 2 : 1; }
        else face = crossX ? 2 : 1;
      }
      break;
    }
    prevT = tt; prevH = h;
  }

  int cls = clsOf(X0);
  int style = styleOf(X0);
  // world-anchored pixel grid of the hit surface (patterns stay glued to the ground at any height)
  ivec2 ip = ivec2(floor(iso.x), int(floor(iso.y + hHit)));
  vec2 fr = fract(tfHit);
  int c;

  int bio = biomeAtPx(tfHit, ip);
  int sb = seasonOf(bio, s);
  if (face == 0) {
    float sdf = sdfAt(tfHit);
    if (isWater(cls)) {
      c = waterTop(ip, tfHit, sdf, cls == DEEP, t, sb, bio);
    } else if (cls == GRASS) {
      c = grassTop(ip, tfHit, sb, fluxAt(tfHit), t, bio);
      // wind gusts ripple across the meadow as travelling lighter bands
      if (uMotion > 0.5 && sb != 3 && c >= G3 && c < G7) {
        vec2 wd = normalize(uWind.xy + 1e-4);
        float ph = dot(tfHit, wd) * 0.72 - t * (0.6 + 1.6 * uWind.z) + 1.7 * sin(dot(tfHit, vec2(-wd.y, wd.x)) * 0.32);
        float band = smoothstep(0.78, 0.97, 0.5 + 0.5 * sin(ph)) * smoothstep(0.08, 0.5, uWind.z);
        if (hashi(ip) < band * 0.85) c += 1;
      }
    } else if (cls == SAND) {
      c = sandTop(ip, sdf, sb);
    } else if (cls == PATH) {
      if (style == 2 && distance(tfHit, uPlaza.xy) < uPlaza.z) c = ringTop(ip, tfHit, uPlaza, t, false);
      else if (style == 3 && distance(tfHit, uShrine.xy) < uShrine.z) c = ringTop(ip, tfHit, uShrine, t, true);
      else if (style >= 1) c = cobbleTop(ip, tfHit);
      else c = dirtTop(ip, sb);
    } else if (cls == SOIL || cls == SOILWET) {
      c = soilTop(ip, tfHit, cls == SOILWET, sb);
    } else if (cls == FLOOR) {
      c = floorTop(tfHit);
    } else {
      c = (hashi(ip / 3) > 0.5) ? MIST : STEEL;
    }
    // block edges: the foot of a taller neighbour behind gets a contact shadow; a lower one leaves a lit lip
    float hxm = heightOf(tileAt(T0 - ivec2(1, 0))), hym = heightOf(tileAt(T0 - ivec2(0, 1)));
    float ex = fr.x * 16.0, ey = fr.y * 16.0;       // vertical px from the back-left / back-right edges
    bool water = isWater(cls);
    if ((hxm > hHit + 0.5 && ex < 1.0) || (hym > hHit + 0.5 && ey < 1.0)) {
      if (water) {
        // foam where the bank meets the water: bright cyan line that breaks up and breathes
        float br = vnoise(vec2(ip) * 0.35 + vec2(t * 0.6 * uMotion, 0.0));
        c = br > 0.3 ? W6 : W5;
        if (sb == 3) c = W7;
      } else c = (cls == GRASS) ? (sb == 3 ? FOG : G2) : (cls == SAND ? E4 : (cls == PATH && style >= 1 ? STEEL : E2));
    } else if (water && ((hxm > hHit + 0.5 && ex < 2.5) || (hym > hHit + 0.5 && ey < 2.5))) {
      c = sb == 3 ? W6 : W4;                          // glow halo just off the foam
    } else if (!water && ((hxm < hHit - 0.5 && ex < 1.0) || (hym < hHit - 0.5 && ey < 1.0))) {
      if (cls == GRASS) c = sb == 3 ? WHITE : (sb == 2 ? G5 : G6);
      else if (cls == SAND) c = E7;
      else if (cls == PATH && style == 0) c = E5;
    }
  } else {
    bool left = face == 1;
    // neighbour in front of this face: its surface is where the face ends
    ivec2 Nt = T0 + (left ? ivec2(0, 1) : ivec2(1, 0));
    vec4 NX = tileAt(Nt);
    float hN = heightOf(NX);
    int H = int(hHit - hN + 0.5);
    bool toWater = isWater(clsOf(NX));
    int k = (cls == SAND) ? 1 : (cls == FLOOR || cls == WALLC || (cls == PATH && style >= 1)) ? 2 : 0;
    if (k == 1) c = sideSand(ip, left, dPx);
    else if (k == 2) c = sideStone(ip, tfHit, left, dPx);
    else c = sideEarth(ip, left, dPx);
    // overhanging lip on top: grass blades, a dirt rim, snow
    float u = left ? tfHit.x : tfHit.y;
    int col = int(floor(u * 16.0));
    if (cls == GRASS) {
      float hang = hashi(ivec2(col, T0.x * 7 + T0.y * 13));
      int lip = 1 + (hang > 0.45 ? 1 : 0) + (hang > 0.85 ? 1 : 0);
      if (dPx <= lip) {
        if (sb == 3) c = dPx == 1 ? WHITE : PALE;
        else if (sb == 2) c = dPx == 1 ? (left ? G4 : G3) : (left ? G3 : G2);
        else if (bio == B_CORRUPT) c = dPx == 1 ? (left ? Q1 : Q0) : (left ? Q0 : NIGHT);
        else if (bio == B_SWAMP) c = dPx == 1 ? (left ? G2 : G1) : (left ? G1 : G0);
        else if (bio == B_ENCHANTED) c = dPx == 1 ? (left ? W3 : W2) : (left ? G2 : G1);
        else c = dPx == 1 ? (left ? G4 : G3) : (left ? G3 : G2);
        if (dPx == lip && dPx > 1) c = left ? G2 : G1;
      }
    } else if (cls == PATH && style == 0 && dPx == 1) c = left ? E3 : E2;
    else if (cls == SOIL || cls == SOILWET) { if (dPx == 1) c = left ? R1 : R0; }
    else if (cls == SAND && dPx == 1) c = left ? E6 : E5;
    // the waterline at the foot of a bank: cyan foam, a glow above it
    if (toWater) {
      float br = vnoise(vec2(ip) * 0.4 + vec2(t * 0.7 * uMotion, 3.0));
      float rise = 0.5 + 0.5 * sin(t * 1.4 * uMotion + u * 9.0);
      if (dPx >= H) c = sb == 3 ? W7 : (br > 0.35 ? W6 : W5);
      else if (dPx == H - 1 && (br > 0.55 || rise > 0.8)) c = sb == 3 ? W6 : W5;
      else if (dPx == H - 2 && H > 3) c = k == 1 ? (left ? E3 : E2) : (k == 2 ? (left ? STEEL : SLATE) : (left ? E0 : NIGHT));  // wet, darker band
    } else if (dPx >= H && H > 1) {
      c = k == 1 ? (left ? E3 : E2) : (k == 2 ? (left ? STEEL : SLATE) : (left ? E1 : E0));   // contact shadow at the foot
    }
  }
  vec3 col3 = P(c);

  // drifting cloud shadows (soft, never in winter overcast)
  float cloud = vnoise(tfHit * 0.1 + vec2(37.0, 11.0) + vec2(t * 0.012, t * 0.005) * uMotion);
  if (cloud > 0.68 && s != 3) col3 *= 0.9;

  fragColor = vec4(col3, 1.0);
}`;
