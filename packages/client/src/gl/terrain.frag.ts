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
 * Terrain ("interference painting"): each 16px tile carries a ground class. The fragment shader treats the
 * four nearest tile centres as a dual grid, warps the borders with noise so edges are organic (never square),
 * then paints every pixel from fixed 48-colour palette ramps with ordered dithering.
 */
export const TERRAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uTiles;   // 34x34 RGBA8 incl. 1-tile border: r=ground class, g=flux, b=tile hash
uniform vec2 uChunk;        // chunk origin in world pixels
uniform float uTime;
uniform float uSeason;      // 0 spring, 1 summer, 2 autumn, 3 winter
uniform float uMotion;      // 1 = animate, 0 = reduced motion

const vec3 PAL[48] = vec3[48](${pal});
const int BAYER[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);

// classes
const int DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, SOIL = 5, SOILWET = 6, FLOOR = 7, WALLC = 8;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hashi(ivec2 p) {
  return float(pcg(uint(p.x) * 1973u ^ pcg(uint(p.y) + 9277u))) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hashi(ii), b = hashi(ii + ivec2(1, 0)), c = hashi(ii + ivec2(0, 1)), d = hashi(ii + ivec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float bayer(ivec2 p) {
  ivec2 q = ivec2(p.x & 3, p.y & 3);
  return (float(BAYER[q.x + q.y * 4]) + 0.5) / 16.0;
}
// pick palette index from a ramp [base, base+len) with ordered dithering
int ramp(int base, int len, float t, float d) {
  float x = clamp(t, 0.0, 1.0) * float(len - 1);
  float lo = floor(x);
  float fr = smoothstep(0.38, 0.62, x - lo);   // flat bands, dithering only in a narrow seam
  return base + int(lo) + (fr > d ? 1 : 0);
}
vec3 P(int i) { return PAL[clamp(i, 0, 47)]; }

int cls(ivec2 t) { return int(texelFetch(uTiles, t, 0).r * 255.0 + 0.5); }

bool isWater(int c) { return c == WATER || c == DEEP; }

vec3 grassColor(vec2 wp, ivec2 ip, float flux, float t, float d) {
  float big = vnoise(wp * 0.022);
  float mid = vnoise(wp * 0.11 + 31.0);
  float sweep = vnoise(wp * vec2(0.03, 0.045) + vec2(t * 0.32 * uMotion, t * 0.05 * uMotion));
  float v = 0.42 * big + 0.28 * mid + 0.30 * sweep;
  float blade = hashi(ip);
  int s = int(uSeason + 0.5);
  vec3 c;
  if (s == 0) {            // spring: fresh, light
    c = P(ramp(10, 5, v * 1.15 + 0.1, d));
  } else if (s == 1) {     // summer: deep and lush
    c = P(ramp(9, 5, v * 1.1 + 0.02, d));
  } else if (s == 2) {     // autumn: green turf fading to straw, with russet patches
    float x = clamp(v * 1.25 - 0.05, 0.0, 1.0) * 4.0;
    float lo = floor(x);
    float fr = smoothstep(0.38, 0.62, x - lo);
    int k = int(lo) + (fr > d ? 1 : 0);
    int AU[5] = int[5](10, 11, 12, 21, 22);          // g2 g3 g4 | e5 e6
    c = P(AU[clamp(k, 0, 4)]);
    if (blade > 0.992) c = P(36);
  } else {                 // winter: snow with exposed turf
    if (v < 0.30 && blade < 0.55) c = P(ramp(10, 2, v * 3.0, d));
    else c = P(ramp(5, 3, v * 1.3 + 0.25, d));
  }
  // blades and speckle
  if (s != 3) {
    if (blade > 0.982) c = P(s == 2 ? 22 : 14);
    else if (blade < 0.012) c = P(s == 2 ? 19 : 10);
  } else if (blade > 0.992) c = P(7);
  // quantum flux: faint iridescent shimmer in flux-rich meadows
  if (flux > 0.04) {
    float tw = 0.5 + 0.5 * sin(t * 1.3 * uMotion + vnoise(wp * 0.2) * 9.0);
    if (blade > 0.985 - 0.012 * tw * flux) c = P(47);
    else if (hashi(ip + ivec2(7, 3)) > 0.9 && tw > 0.6) c = P(s == 3 ? 29 : 13);
  }
  return c;
}

vec3 sandColor(vec2 wp, ivec2 ip, float wet, float d) {
  float n = vnoise(wp * 0.07);
  float rip = sin(wp.x * 0.55 + wp.y * 0.95 + vnoise(wp * 0.09) * 7.0);
  float v = 0.55 + 0.35 * (n - 0.5) - wet * 0.55;
  int idx = ramp(21, 3, v, d);
  vec3 c = P(idx);
  if (rip > 0.96 && wet < 0.3) c = P(22);
  float h = hashi(ip);
  if (h > 0.99) c = P(7);
  else if (h < 0.012) c = P(21);
  return c;
}

vec3 pathColor(vec2 wp, ivec2 ip, float d) {
  // irregular cobblestones: jittered-grid voronoi, mortar where the two nearest cells nearly tie
  vec2 g = wp / 6.5;
  vec2 gi = floor(g);
  float f1 = 9.0, f2 = 9.0;
  ivec2 id1 = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cell = ivec2(gi) + ivec2(i, j);
    vec2 pt = vec2(cell) + 0.5 + 0.38 * vec2(hashi(cell) - 0.5, hashi(cell + ivec2(31, 17)) - 0.5) * 2.0;
    float dist = distance(g, pt);
    if (dist < f1) { f2 = f1; f1 = dist; id1 = cell; } else if (dist < f2) f2 = dist;
  }
  float edge = (f2 - f1) * 6.5;
  if (edge < 0.9) return P(19);
  float sh = hashi(id1 + ivec2(5, 9));
  float lit = edge < 1.9 ? -0.12 : 0.0;
  return P(ramp(20, 4, 0.15 + 0.7 * sh + lit + 0.06 * (hashi(ip) - 0.5), d));
}

vec3 soilColor(vec2 wp, ivec2 ip, bool wet, float d) {
  float fur = sin(wp.y * 1.05 + vnoise(wp * 0.05) * 1.5);
  float v = 0.45 + 0.25 * (vnoise(wp * 0.2) - 0.5) + (fur > 0.35 ? 0.28 : (fur < -0.4 ? -0.18 : 0.0));
  if (wet) return P(ramp(16, 3, v * 0.9, d));
  return P(ramp(17, 4, v + 0.1, d));
}

vec3 floorColor(vec2 wp, ivec2 ip, float d) {
  int row = int(floor(wp.y / 4.0));
  float off = float(int(hashi(ivec2(0, row)) * 16.0));
  float px = mod(wp.x + off, 16.0);
  if (mod(wp.y, 4.0) < 1.0 || px < 1.0) return P(18);
  float sh = hashi(ivec2(int(floor((wp.x + off) / 16.0)), row));
  float grain = vnoise(vec2(wp.x * 0.35, wp.y * 2.2));
  return P(ramp(19, 4, 0.22 + 0.5 * sh + 0.2 * grain, d));
}

vec3 wallColor(vec2 wp, ivec2 ip, float d) {
  int row = int(floor(wp.y / 4.0));
  float off = (row & 1) == 0 ? 0.0 : 4.0;
  float cx = floor((wp.x + off) / 8.0);
  if (mod(wp.y, 4.0) < 1.0 || mod(wp.x + off, 8.0) < 1.0) return P(2);
  float sh = hashi(ivec2(int(cx), row));
  return P(ramp(3, 4, 0.2 + 0.6 * sh, d));
}

vec3 waterColor(vec2 wp, ivec2 ip, bool deep, float margin, float t, float d) {
  vec2 q = wp + 6.0 * vec2(vnoise(wp * 0.04 + t * 0.05 * uMotion), vnoise(wp * 0.04 + 9.0));
  float tt = t * uMotion;
  // interference: three travelling waves; crests where they add up
  float I = (sin(dot(q, vec2(0.23, 0.12)) + tt * 0.9)
           + sin(dot(q, vec2(-0.14, 0.27)) - tt * 1.15)
           + sin(dot(q, vec2(0.06, -0.33)) + tt * 0.7)) / 3.0;
  float depth = deep ? 0.18 : 0.5;
  float v = depth + 0.2 * I + 0.1 * (vnoise(wp * 0.05) - 0.5);
  v += clamp(margin, 0.0, 0.5) * (deep ? 0.0 : -0.1);
  int idx = deep ? ramp(25, 4, v, d) : ramp(26, 4, v, d);
  vec3 c = P(idx);
  if (I > 0.62) c = P(deep ? 28 : 29);              // bright crest
  if (I > 0.8 && !deep) c = P(30);
  if (uSeason > 2.5 && !deep) {                       // winter: thin ice sheen
    float ice = vnoise(wp * 0.05 + 70.0);
    if (ice > 0.62) c = P(ramp(5, 3, 0.5 + (ice - 0.62) * 2.0, d));
  }
  return c;
}

void main() {
  vec2 local = vUV * 512.0;
  vec2 wpf = uChunk + local;
  ivec2 ip = ivec2(floor(wpf));
  float d = bayer(ip);
  float t = uTime;

  // dual-grid: bilinear weights of the four nearest tile centres
  vec2 u = local / 16.0 - 0.5;
  vec2 fl = floor(u);
  vec2 f = u - fl;
  ivec2 t00 = ivec2(fl) + 1;
  int c[4];
  c[0] = cls(t00);
  c[1] = cls(t00 + ivec2(1, 0));
  c[2] = cls(t00 + ivec2(0, 1));
  c[3] = cls(t00 + ivec2(1, 1));
  float w[4];
  w[0] = (1.0 - f.x) * (1.0 - f.y);
  w[1] = f.x * (1.0 - f.y);
  w[2] = (1.0 - f.x) * f.y;
  w[3] = f.x * f.y;
  vec4 fx = texelFetch(uTiles, t00 + ivec2(f.x > 0.5 ? 1 : 0, f.y > 0.5 ? 1 : 0), 0);

  float sc[4];
  for (int j = 0; j < 4; j++) {
    float s = 0.0;
    for (int k = 0; k < 4; k++) if (c[k] == c[j]) s += w[k];
    // organic borders: each class gets its own warp noise
    s += 0.30 * (vnoise(wpf * 0.105 + float(c[j]) * 13.7) - 0.5) * 2.0 * (1.0 - s);
    sc[j] = s;
  }
  int bj = 0;
  for (int j = 1; j < 4; j++) if (sc[j] > sc[bj]) bj = j;
  int best = c[bj];
  float second = -1.0;
  int other = best;
  for (int j = 0; j < 4; j++) if (c[j] != best && sc[j] > second) { second = sc[j]; other = c[j]; }
  float margin = second < 0.0 ? 1.0 : sc[bj] - second;

  float flux = fx.g;
  vec3 col;
  if (best == GRASS) {
    col = grassColor(wpf, ip, flux, t, d);
    if (other != GRASS) {
      // worn, shaded lip where turf meets another ground; ragged tufts overhang it
      float edge = 1.0 - smoothstep(0.0, 0.16, margin);
      float h = hashi(ip);
      if (edge > 0.55) col = uSeason > 2.5 ? P(6) : P(h > 0.5 ? 9 : 10);
      else if (edge > 0.25 && h > 0.6) col = P(uSeason > 2.5 ? 7 : 14);
    }
  } else if (best == SAND) {
    float wet = isWater(other) ? 1.0 - smoothstep(0.0, 0.34, margin) : 0.0;
    col = sandColor(wpf, ip, wet, d);
  } else if (best == PATH) {
    col = pathColor(wpf, ip, d);
    if (other != PATH && margin < 0.1) col = P(18);
  } else if (best == SOIL) {
    col = soilColor(wpf, ip, false, d);
    if (other != SOIL && margin < 0.1) col = P(17);
  } else if (best == SOILWET) {
    col = soilColor(wpf, ip, true, d);
    if (other != SOILWET && margin < 0.1) col = P(16);
  } else if (best == FLOOR) {
    col = floorColor(wpf, ip, d);
  } else if (best == WALLC) {
    col = wallColor(wpf, ip, d);
  } else {
    bool deep = best == DEEP;
    col = waterColor(wpf, ip, deep, margin, t, d);
    // shoreline foam: animated dotted breakers
    if (!isWater(other) && margin < 0.11) {
      float br = 0.5 + 0.5 * sin(wpf.x * 0.45 + wpf.y * 0.3 + t * 2.2 * uMotion + vnoise(wpf * 0.1) * 6.0);
      col = br > 0.35 ? P(31) : P(30);
    } else if (!isWater(other) && margin < 0.2) {
      col = P(29);
    }
  }

  // drifting cloud shadows (painted as one dither step darker)
  float cloud = vnoise(wpf * 0.0075 + vec2(t * 0.018, t * 0.008) * uMotion);
  if (cloud > 0.62 && uSeason < 3.5) col *= (cloud > 0.7 ? 0.82 : (d > 0.5 ? 0.82 : 1.0));

  fragColor = vec4(col, 1.0);
}`;
