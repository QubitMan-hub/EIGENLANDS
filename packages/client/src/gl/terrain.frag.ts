import { CAVE_OY, DIVE_OY, LEVEL_PX, UPPER_OY, PALETTE } from '@eigenlands/shared';

const pal = PALETTE.map((h) => {
  const n = parseInt(h.slice(1), 16);
  const f = (v: number) => (v / 255).toFixed(4);
  return `vec3(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}).join(',');

/** Surface height (art px, + up) of each ground class; PATH depends on its paving style. Mirrored in terrain.ts. */
/** tallest block the ray can start from: MAX_LEVEL levels of LEVEL_PX art pixels */
const MAX_TOP = 9 * LEVEL_PX;
/** coarse planes needed to cross the tallest terrain plus the water/ground offsets below sea level */
const MAX_LEVEL_COARSE = 9 + 3;
export const GROUND_Z = {
  water: -7,
  grass: 0,
  sand: -2,
  dirt: -2,
  road: -1,
  plaza: 0,
  soil: -2,
  floor: 0,
  wall: 0,
  caveWall: 13,
} as const;
/** tile rows at or beyond this belong to the Undercroft (shared CAVE_OY - 512, with slack for the window origin) */
const CAVE_ROW = CAVE_OY - 600;

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
 * Tile texel: r = ground class, g = biome * 32 + quantum flux (0..31),
 *             b = paving style (1 road, 2 plaza, 3 shrine) in the low 2 bits + elevation level * 4 (a level lifts the block LEVEL_PX px),
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
uniform float uDetail;
uniform float uMotion;      // 1 = animate, 0 = reduced motion
uniform vec4 uPlaza;        // town plaza centre (tiles) + radius
uniform vec4 uShrine;       // spawn shrine centre (tiles) + radius
uniform vec3 uWind;         // world wind: direction xy + strength 0..1 (same field the swaying plants follow)
uniform float uTopZ;        // highest raised ground in the window (art px); 0 keeps the flat-world ray length

const vec3 PAL[48] = vec3[48](${pal});

const int B_MEADOW = 0, B_FOREST = 1, B_AUTUMN = 2, B_TAIGA = 3, B_SWAMP = 4, B_DESERT = 5, B_ENCHANTED = 6, B_CORRUPT = 7;
const int DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, SOIL = 5, SOILWET = 6, FLOOR = 7, WALLC = 8, CAVE = 9, CAVEWALL = 10, VOID = 11, LAVA = 12, VAULT = 13;
const int INK=0, NIGHT=1, SLATE=2, STEEL=3, MIST=4, FOG=5, PALE=6, WHITE=7;
const int G0=8, G1=9, G2=10, G3=11, G4=12, G5=13, G6=14, G7=15;
const int E0=16, E1=17, E2=18, E3=19, E4=20, E5=21, E6=22, E7=23;
const int W0=24, W1=25, W2=26, W3=27, W4=28, W5=29, W6=30, W7=31;
const int R0=32, R1=33, R2=34, R3=35, R4=36, R5=37, R6=38, R7=39;
const int Q0=40, Q1=41, Q2=42, Q3=43, Q4=44, Q5=45, Q6=46, Q7=47;

const float Z_WATER = ${GROUND_Z.water}.0;
const int STEPS = 9 + ${GROUND_Z.caveWall} + ${MAX_TOP};   // upper bound; the ray starts at the crown of the tallest block (0 on flat ground)

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
int styleOf(vec4 t) { return int(t.b * 255.0 + 0.5) & 3; }
int levelOf(vec4 t) { return int(t.b * 255.0 + 0.5) >> 2; }
float sdfOf(vec4 t) { return (t.a * 255.0 - 128.0) / 12.0; }
bool isWater(int c) { return c == WATER || c == DEEP; }
float surfaceOf(vec4 t) {
  int c = clsOf(t);
  if (c == WATER || c == DEEP || c == LAVA) return Z_WATER;
  if (c == CAVEWALL) return ${GROUND_Z.caveWall}.0;
  if (c == SAND) return ${GROUND_Z.sand}.0;
  if (c == SOIL || c == SOILWET) return ${GROUND_Z.soil}.0;
  if (c == PATH) { int s = styleOf(t); return s >= 2 ? ${GROUND_Z.plaza}.0 : s == 1 ? ${GROUND_Z.road}.0 : ${GROUND_Z.dirt}.0; }
  return 0.0;
}
// block top: the ground class's own offset plus the whole levels the terrain is raised
float heightOf(vec4 t) { return surfaceOf(t) + float(levelOf(t)) * ${LEVEL_PX}.0; }
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
// effective season of a biome: the tundra is always snowed in, Amberwood always in autumn colour
int seasonOf(int b, int s) { return b == B_TAIGA ? 3 : b == B_AUTUMN ? 2 : s; }

// quantum phase colour for rare glints: cyan -> lilac -> pink
int phaseCol(float h, float t) {
  float ph = fract(t * 0.11 * uMotion + h * 3.7);
  return ph < 0.34 ? Q7 : ph < 0.67 ? Q4 : Q6;
}

// Sparse angular marks, anchored in world pixels. Noise selects a stamp and its
// position, never fills a large bright/dark contour. Both quality modes share it.
int groundClusters(ivec2 ip,int base,int low,int high,float density){
  ivec2 size=ivec2(17,11),cell=cellOf(ip,size);
  if(hashk(cell,71)>density)return base;
  ivec2 origin=cell*size+ivec2(5+int(hashk(cell,72)*7.0),3+int(hashk(cell,73)*5.0));
  ivec2 q=ip-origin;
  if(hashk(cell,74)>.5)q.x=-q.x;
  int len=2+int(hashk(cell,75)*4.0),shape=int(hashk(cell,76)*3.0);
  if(shape==0){
    if(q.y==0&&q.x>=0&&q.x<len)return q.x==0?high:base;
    if(q.y==1&&q.x>=1&&q.x<len)return low;
    if(q.y==-1&&q.x==1)return high;
  }else if(shape==1){
    // Short, broken fracture with a one-pixel branch, not a closed contour.
    if(q.x>=0&&q.x<len&&q.y==q.x/3)return low;
    if(q.x==2&&q.y==-1)return low;
    if(q.x==0&&q.y==-1)return high;
  }else{
    if(q.y==0&&(q.x==0||q.x==1))return high;
    if(q.y==1&&q.x==1)return low;
  }
  return base;
}
// Piecewise-linear volcanic fractures: angular facets instead of smooth ovals.
float fractureNoise(vec2 p){
  ivec2 cell=ivec2(floor(p));vec2 f=fract(p);
  float a=hashi(cell),d=hashi(cell+1);
  return f.x>f.y?a+(hashi(cell+ivec2(1,0))-a)*f.x+(d-hashi(cell+ivec2(1,0)))*f.y:
    a+(hashi(cell+ivec2(0,1))-a)*f.y+(d-hashi(cell+ivec2(0,1)))*f.x;
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
  if (lush) { T.base = G4; T.body = G5; T.hi = G6; T.sh = G3; T.dk = G2; }
  else { T.base = G3; T.body = G4; T.hi = G5; T.sh = G2; T.dk = G1; }
  if (s == 0 && !lush) { T.base = G4; T.body = G4; T.hi = G6; T.sh = G3; T.dk = G2; }
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
    float dd = abs(n.x)*.8 + abs(n.y)*1.2;
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
  int c = groundClusters(ip,PALE,FOG,WHITE,.25);
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
  bool lush = false; // Vegetation density varies; the underlying earth does not change into broad color islands.
  Tones T = biomeTones(b, s, lush);
  int c = T.base;
  // Low frequency cover with a warped edge: quiet clearings alternate with planted hummocks.
  vec2 bent = tf + vec2(vnoise(tf * 0.12 + 17.0), vnoise(tf * 0.12 - 39.0)) * 2.5;
  float dn = fbm(bent * 0.32 + 50.0);
  // Resting ground planes between planted clusters keep actors and loot legible.
  float dens = lush ? 0.08 + 0.16 * smoothstep(0.4, 0.8, dn) : 0.08 + 0.28 * smoothstep(0.3, 0.72, dn);
  float big = lush ? 0.0 : 0.08 + 0.25 * smoothstep(0.3, 0.75, fbm(tf * 0.35 + 70.0));
  if (s == 3) { dens *= 0.35; big = 0.0; }
  bool hit;
  int cl = clumpPix(ip, dens, big, T, hit);
  if (hit) return cl;
  ivec2 TC = ivec2(6, 4);
  ivec2 tc = cellOf(ip, TC);
  for (int j = 0; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cc = tc + ivec2(i, j);
    if (hashk(cc, 6) > (lush ? 0.08 : 0.13)) continue;
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
  // Damp micro-detail follows an actual bank, rather than painting fake puddles.
  if(b==B_SWAMP&&sdfAt(tf)>-1.1)c=groundClusters(ip,c,G0,W1,.16);
  // wastes: cracked ground
  if (b == B_CORRUPT && abs(vnoise(wp * 0.07 + 5.0) - 0.5) < 0.018) return NIGHT;
  return c;
}

// ───────── sand / dirt / soil ─────────
int sandTop(ivec2 ip, float sdf, int s) {
  vec2 wp = vec2(ip);
  int c = groundClusters(ip,E6,E5,E7,.22);
  float n = vnoise(wp * 0.035) * 0.7 + vnoise(wp * 0.12) * 0.3;

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
  return groundClusters(ip,E4,E3,s==3?PALE:E5,s==3?.46:.34);
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
  if (edge < 0.4) return hashk(id1, 72) > 0.86 ? G2 : STEEL;
  vec2 rel = g - p1;
  float lit = -(rel.x + rel.y);                // tile -x/-y = screen up: lit from the top-left
  bool warm = hashi(id1 + ivec2(2, 3)) < 0.28;
  float v = 0.5 + lit * 0.65 + (hashi(id1 + ivec2(5, 9)) - 0.5) * 0.22;
  if (edge < 0.95) v -= 0.2;
  if (warm) return v > 0.75 ? E7 : v > 0.3 ? E6 : E5;
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
  float across = fract(rowF) * 5.0;
  if (across < 0.65 || px < 0.7) return E2;
  float sh = hashi(ivec2(int(floor((wp.x + off) / 24.0)), row));
  if (across < 1.5) return sh > 0.5 ? E6 : E5;
  // Two iron nailheads per board and sparse, long woodgrain marks.
  if ((px < 2.0 || px > 22.0) && across > 3.0 && across < 3.8) return E1;
  if (across > 2.6 && across < 3.2 && px > 6.0 && px < 15.0 && sh > 0.6) return E3;
  return sh > 0.7 ? E5 : E4;
}

// ───────── water ─────────
// One quiet body tone. Depth shading is continuous below, not filled threshold islands.
int waterTone(int c, int b) {
  if(b==B_SWAMP)return c==W4?G2:c==W3?G1:G0;
  if(b==B_CORRUPT)return c==W4?Q2:c==W3?Q1:Q0;
  if(b==B_ENCHANTED&&c==W4)return Q7;
  return c;
}
int calmWater(ivec2 ip, float sdf, bool deep, float t, int season, int bio, bool detail) {
  int c=W2;
  float time=t*uMotion*.22;
  // A thin bank shelf, rather than successively darker outlines around every pool centre.
  if(!deep&&sdf<.28)c=W3;
  ivec2 drift=ivec2(int(floor(time)),0),size=ivec2(36,18);
  ivec2 cell=cellOf(ip+drift,size);
  float h=hashk(cell,40);
  ivec2 origin=cell*size+ivec2(3+int(hashk(cell,41)*24.0),3+int(hashk(cell,42)*10.0));
  ivec2 q=ip+drift-origin;
  int len=3+int(hashk(cell,46)*3.0);
  if(h<(detail?.36:.22)&&q.y==0&&q.x>=0&&q.x<len&&fract(h*7.0+time*.2)<.78)c=W3;
  if(bio==B_ENCHANTED&&c==W3&&h<.035&&q.y==0)c=W4;
  if(season==3&&sdf<1.1){
    c=W5;
    if(q.y==0&&q.x>=0&&q.x<3&&h<.15)c=W6;
    return c;
  }
  return waterTone(c,bio);
}
int waterTop(ivec2 ip, vec2 tf, float sdf, bool deep, float t, int s, int b) {
  return calmWater(ip,sdf,deep,t,s,b,true);
}

// Slow molten flow: tiny broken streaks, no outlined polygon plates or black crust islands.
int lavaTop(ivec2 ip,float t){
  ivec2 size=ivec2(28,16),drift=ivec2(int(floor(t*uMotion*.18)),0);
  ivec2 cell=cellOf(ip+drift,size);
  ivec2 origin=cell*size+ivec2(3+int(hashk(cell,111)*14.0),3+int(hashk(cell,112)*7.0));
  ivec2 q=ip+drift-origin;
  float h=hashk(cell,113);
  if(q.y==0&&q.x>=0){if(h<.45&&q.x<7)return R4;if(h>.9&&q.x<4)return R2;}
  return R3;
}

// Quieter materials for small/limited GPUs: keep the same biome ramps, water depths and shore foam.
int economyGrass(ivec2 ip,vec2 tf,int s,float flux,float t,int b){
  Tones tone=biomeTones(b,s,false);int c=tone.base;
  ivec2 size=ivec2(11,7),cell=cellOf(ip,size);
  ivec2 origin=cell*size+ivec2(2+int(hashk(cell,2)*6.0),3+int(hashk(cell,3)*3.0));
  if(hashk(cell,6)>.8){int tuft=tuftPix(ip,origin,tone.body,tone.hi);if(tuft>=0)c=tuft;}
  if(flux>.6&&hashk(ip,8)>.999)c=phaseCol(flux,t);
  return c;
}
int economyWater(ivec2 ip,float sdf,bool deep,float t,int s,int b){
  return calmWater(ip,sdf,deep,t,s,b,false);
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

// ───────── the Undercroft ─────────
// floor: warm packed earth worn into flagstones, pebbles, damp glinting patches (reads lighter than the rock above)
int caveBase(int bio){
  return bio==1?G1:bio==6?SLATE:bio==7?E1:bio==3?STEEL:bio==4?W1:E2;
}
int caveFloorTop(ivec2 ip, float t, int bio) {
  int base=caveBase(bio),low=bio==1?G0:bio==6?NIGHT:bio==7?E0:bio==3?SLATE:bio==4?W0:E1;
  int high=bio==1?G2:bio==6?STEEL:bio==7?R0:bio==3?MIST:bio==4?W2:E3;
  int c=groundClusters(ip,base,low,high,.38);
  if(uDetail>.5&&c==base)c=groundClusters(ip+ivec2(37,19),base,low,high,.12);
  return c;
}
// Fractured rock crown: small chisel clusters, no value-noise blobs or blocky economy fill.
// Each cave biome tints its own rock: warm amber limestone, mossy green, violet prism, soot basalt, grey rime, teal wet stone.
ivec3 caveRockTone(int bio, int face) {
  if (face == 0) {
    return bio==B_DESERT?ivec3(INK,E0,E1):bio==B_FOREST?ivec3(INK,G0,G1):bio==B_ENCHANTED?ivec3(INK,Q0,Q1):bio==B_CORRUPT?ivec3(INK,NIGHT,R0):bio==B_TAIGA?ivec3(NIGHT,SLATE,STEEL):ivec3(INK,W0,W1);
  }
  if (face == 1) {
    return bio==B_DESERT?ivec3(E2,E3,E4):bio==B_FOREST?ivec3(G1,G2,G3):bio==B_ENCHANTED?ivec3(Q1,Q2,Q3):bio==B_CORRUPT?ivec3(NIGHT,SLATE,STEEL):bio==B_TAIGA?ivec3(STEEL,MIST,FOG):ivec3(W1,W2,W3);
  }
  return bio==B_DESERT?ivec3(E0,E1,E2):bio==B_FOREST?ivec3(G0,G1,G2):bio==B_ENCHANTED?ivec3(Q0,Q1,Q2):bio==B_CORRUPT?ivec3(INK,NIGHT,SLATE):bio==B_TAIGA?ivec3(NIGHT,SLATE,STEEL):ivec3(W0,W1,W2);
}
// Fractured rock crown: small chisel clusters, no value-noise blobs or blocky economy fill.
int caveRockTop(ivec2 ip, float t, int bio) {
  ivec3 k=caveRockTone(bio,0);
  int c=groundClusters(ip,k.y,k.x,k.z,.64);
  if(uDetail>.5&&c==k.y)c=groundClusters(ip+ivec2(5,31),k.y,k.x,k.z,.2);
  if(hashi(ip+ivec2(7,3))>.9995)c=Q2;
  return c;
}
// rock faces: lit, layered strata on the left, shade on the right; chisel marks and ore flecks; dark foot
int sideCave(ivec2 ip, vec2 tf, bool left, int d, int H, int bio) {
  int u=int(floor((left?tf.x:tf.y)*16.0));
  ivec3 tone=caveRockTone(bio,left?1:2);
  int base=tone.y,low=tone.x,high=tone.z;
  int c=groundClusters(ivec2(u,d),base,low,high,.42);
  // Short bedding seams vary by rock section; never a whole noisy strip of color.
  ivec2 bed=cellOf(ivec2(u,d),ivec2(17,5));
  int seam=2+int(hashk(bed,81)*2.0);
  if(d%5==seam&&(u%17+17)%17<3+int(hashk(bed,82)*6.0))c=low;
  if(d<=1)c=high;
  if(d>=H-1)c=left?low:INK;
  return c;
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
  bool submerged=abs(uWin.y - ${DIVE_OY}.0)<4000.0;
  bool enclosed = uWin.y > ${CAVE_ROW}.0 || abs(uWin.y - ${UPPER_OY}.0) < 1000.0 || abs(uWin.y - ${DIVE_OY}.0) < 4000.0;
  float zTop = enclosed ? ${GROUND_Z.caveWall}.0 : uTopZ;
  float zStart = zTop;
  int steps = 9 + int(zTop);
  // Tall terrain: coarse 8px (one level) planes find the block the ray enters, then the usual 1px march refines it.
  // Any tile footprint holds at least two coarse samples, so nothing is skipped; flat windows and caves keep the exact
  // single-pass march.
  if (!enclosed && zTop > 12.0) {
    float zc = zTop;
    for (int k = 0; k < ${MAX_LEVEL_COARSE}; k++) {
      vec2 tfc = isoToTile(vec2(iso.x, iso.y + zc));
      if (heightOf(tileAt(ivec2(floor(tfc)))) >= zc - 0.001 || zc <= -8.0) break;
      zc -= ${LEVEL_PX}.0;
    }
    zStart = min(zTop, zc + ${LEVEL_PX}.0);
    steps = 9 + ${LEVEL_PX} + 1;
    if (zStart < zTop) {
      vec2 tfp = isoToTile(vec2(iso.x, iso.y + zStart));
      prevT = ivec2(floor(tfp));
      prevH = heightOf(tileAt(prevT));
    }
  }
  for (int k = 0; k < STEPS; k++) {
    if (k >= steps) break;
    float z = zStart - float(k);
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

  int bio = biomeOf(X0);
  int sb = seasonOf(bio, s);
  if (face == 0) {
    float sdf = sdfAt(tfHit);
    if (cls == VOID) {
      c = NIGHT;
    } else if (isWater(cls)) {
      c = uDetail < .5 ? economyWater(ip, sdf, cls == DEEP, t, sb, bio) : waterTop(ip, tfHit, sdf, cls == DEEP, t, sb, bio);
    } else if (cls == GRASS) {
      c = uDetail < .5 ? economyGrass(ip, tfHit, sb, fluxOf(X0), t, bio) : grassTop(ip, tfHit, sb, fluxAt(tfHit), t, bio);
      // wind gusts ripple across the meadow as travelling lighter bands
      if (uDetail > .5 && uMotion > 0.5 && sb != 3 && c >= G3 && c < G7) {
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
    } else if(cls==LAVA){
      c=lavaTop(ip,t);
    } else if(cls==VAULT){
      vec2 p=fract(tfHit);float h=hashi(ivec2(floor(tfHit)));
      c=p.x<.04||p.y<.04?NIGHT:submerged?(h>.94?W3:W2):h>.96?MIST:STEEL;
      if((p.x>.12&&p.x<.16||p.y>.12&&p.y<.16)&&hashi(ivec2(floor(tfHit)))>.76)c=SLATE;
    } else if (cls == CAVE) {
      c = caveFloorTop(ip, t, bio);
    } else if (cls == CAVEWALL) {
      c = submerged ? ((int(floor(tfHit.x))+int(floor(tfHit.y)))%3==0?W2:STEEL) : caveRockTop(ip, t, bio);
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
        c = br > 0.72 ? W5 : W4;
        if (sb == 3) c = W7;
      } else c = (cls == GRASS) ? (sb == 3 ? FOG : G2) : (cls == SAND ? E4 : (cls == PATH && style >= 1 ? STEEL : cls == CAVE ? INK : E2));
    } else if (water && ((hxm > hHit + 0.5 && ex < 2.5) || (hym > hHit + 0.5 && ey < 2.5))) {
      c = sb == 3 ? W6 : W4;                          // glow halo just off the foam
    } else if (!water && ((hxm < hHit - 0.5 && hHit - hxm < 5.0 && ex < 1.0) || (hym < hHit - 0.5 && hHit - hym < 5.0 && ey < 1.0))) {
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
    bool cliff = H >= 2 * ${LEVEL_PX} - 2 && cls != CAVEWALL; // a tall face: rock, not turf
    int k = (cls == SAND) ? 1 : (cls == FLOOR || cls == WALLC || (cls == PATH && style >= 1)) ? 2 : 0;
    if (cls == CAVEWALL) c = submerged ? sideStone(ip,tfHit,left,dPx) : sideCave(ip, tfHit, left, dPx, H, bio);
    else if (cls == GRASS && !toWater && !cliff && H >= 6) {
      // a one-level step is a grassy bank in the habitat's own tones, not a trench of bare earth
      Tones bt = biomeTones(bio, s, false);
      c = left ? bt.body : bt.sh;
      if (hashi(ivec2(ip.x / 2, dPx)) > 0.82) c = left ? bt.hi : bt.body;
      if (dPx >= H - 1) c = bt.dk;
    }
    else if (cls == SAND && !toWater && !cliff && H >= 6) {
      // a dune step: one lit face and one shaded face with a pale crest and a soft foot, no strata
      c = left ? E5 : E4;
      if (dPx <= 1) c = left ? E7 : E6;
      else if (hashi(ivec2(ip.x / 2, dPx)) > 0.9) c = left ? E6 : E5;
      if (dPx >= H - 1) c = left ? E3 : E2;
    }
    else if (cliff) c = bio == B_DESERT ? sideSand(ip, left, dPx) : sideStone(ip, tfHit, left, dPx);
    else if (k == 1) c = sideSand(ip, left, dPx);
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
  // Quiet bank foam and tint it to the habitat; keep winter ice and quantum accents distinct.
  if(sb!=3&&c>=W4&&c<=W7&&(isWater(cls)||face>0))c=waterTone(W4,bio);
  vec3 col3 = P(c);
  if(face==0&&isWater(cls)){
    // Keep depth readable through a low-amplitude shore gradient; never draw dark central blobs.
    float depth=smoothstep(.3,9.0,sdfAt(tfHit));
    col3*=mix(1.015,.965,depth);
  }
  if(face==0&&cls==LAVA)col3*=.985+.03*vnoise(tfHit*.16+vec2(t*uMotion*.008,0.0));


  // Feather only real habitat boundaries, within the same surface material.
  // Geometry, collision, coastlines and paving stay on their actual tiles.
  if(face==0&&(cls==CAVE||cls==GRASS||cls==SAND||(cls==PATH&&style==0))){
    float edge=min(min(fr.x,1.0-fr.x),min(fr.y,1.0-fr.y));
    if(edge<.35){
      bool xEdge=min(fr.x,1.0-fr.x)<min(fr.y,1.0-fr.y);
      ivec2 adjacent=xEdge?ivec2(fr.x<.5?-1:1,0):ivec2(0,fr.y<.5?-1:1);
      vec4 other=tileAt(T0+adjacent);int nb=biomeOf(other);
      if(clsOf(other)==cls&&nb!=bio){
        int currentBase=cls==CAVE?caveBase(bio):cls==GRASS?biomeTones(bio,s,false).base:E6;
        int neighborBase=cls==CAVE?caveBase(nb):cls==GRASS?biomeTones(nb,s,false).base:E6;
        col3+= (P(neighborBase)-P(currentBase))*(.5*(1.0-smoothstep(0.0,.35,edge)));
      }else if(abs(heightOf(other)-hHit)<=2.1){
        int oc=clsOf(other);
        bool loose=oc==CAVE||oc==GRASS||oc==SAND||(oc==PATH&&styleOf(other)==0);
        if(loose&&oc!=cls){
          int here=cls==CAVE?caveBase(bio):cls==GRASS?biomeTones(bio,s,false).base:cls==SAND?E6:E4;
          int there=oc==CAVE?caveBase(nb):oc==GRASS?biomeTones(nb,s,false).base:oc==SAND?E6:E4;
          col3+=(P(there)-P(here))*(.5*(1.0-smoothstep(0.0,.22,edge)));
        }
      }
    }
  }
  // Broad variation is continuous and low in amplitude; it never becomes a filled color patch.
  if(face==0&&!isWater(cls)&&cls!=LAVA&&cls!=VAULT&&cls!=FLOOR){
    float grain=vnoise(vec2(ip)*.025+7.0)-.5;
    col3*=1.0+grain*.045;
  }
  // Clouds affect open sky only, with a soft ramp rather than a thresholded shadow island.
  if(!enclosed&&cls!=FLOOR&&cls!=VAULT&&s!=3){
    float cloud=vnoise(tfHit*.1+vec2(37.0,11.0)+vec2(t*.012,t*.005)*uMotion);
    col3*=1.0-.045*smoothstep(.25,.85,cloud);
  }

  fragColor = vec4(col3, 1.0);
}`;
