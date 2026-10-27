/** Preserved pre-redesign resident artwork; animation keys use the shared action rig. */
import type { Outfit, HairStyle } from './actors';
import { actionPose } from './person-actions';
import { blob, C, limb, poly, put, rampAt, type Ctx, type Ramp } from './shade';
const RUN_FRAME = 14,
  SHOT_FRAME = 22,
  CAST_FRAME = 26,
  ATTACK_FRAME = 10;
interface View {
  turn: number;
  s: number;
} // turn 0 front .. 1 profile .. 2 back; s = +1 facing right, -1 left
const VIEWS: View[] = [
  { turn: 0, s: 1 }, // DOWN
  { turn: 2, s: 1 }, // UP
  { turn: 1, s: -1 }, // LEFT
  { turn: 1, s: 1 }, // RIGHT
  { turn: 0.5, s: -1 }, // DOWN_LEFT
  { turn: 0.5, s: 1 }, // DOWN_RIGHT
  { turn: 1.5, s: -1 }, // UP_LEFT
  { turn: 1.5, s: 1 }, // UP_RIGHT
];

/** Shared near-hand anchor for the body and held equipment; coordinates in the 24×32 frame. */
function npcGrip(dir: number, frame: number): { x: number; y: number; angle: number } {
  const work = actionPose(dir, frame);
  if (work) return { x: work.x, y: work.y, angle: work.angle };
  const { s, turn } = VIEWS[dir]!;
  const profile = turn === 1,
    three = turn === 0.5 || turn === 1.5,
    back = turn > 1.2,
    front = turn < 0.8;
  const nearK = (back ? s : -s) > 0 ? 1 : 0;
  const running = frame >= RUN_FRAME && frame < SHOT_FRAME;
  const moving = (frame >= 1 && frame <= 8) || running;
  const action =
    frame >= CAST_FRAME
      ? frame - CAST_FRAME
      : frame >= SHOT_FRAME
        ? frame - SHOT_FRAME
        : frame >= ATTACK_FRAME && frame < RUN_FRAME
          ? frame - ATTACK_FRAME
          : -1;
  const reach = action >= 0 ? [0.35, 1, 0.65, 0][action]! : 0;
  const aim = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-0.894, 0.447],
    [0.894, 0.447],
    [-0.894, -0.447],
    [0.894, -0.447],
  ][dir]!;
  const sw = moving ? Math.sin(((running ? frame - RUN_FRAME : frame - 1) / 8) * Math.PI * 2) * (running ? 1.3 : 1) : 0;
  const sk = nearK ? sw : -sw;
  const top = moving ? (Math.abs(sw) < 0.5 ? -1 : 0) : action >= 0 ? -reach * 0.7 : frame === 9 ? 0.6 : 0;
  const sy = 14.3 + top;
  const lean = (profile ? 0.6 : three ? 0.3 : 0) * s * (running ? 2 : moving ? 1 : 0.5) + aim[0]! * reach;
  const sx = profile ? 12.5 + lean * 0.8 : 12.5 + (nearK ? 1 : -1) * ((three ? 4 : 4.5) - 0.7) + lean;
  let x = profile
    ? sx + (sk * 2.8 + Math.max(0, sk) * 0.8) * s
    : sx + (nearK ? 0.9 : -0.9) + (three ? sk * 1.6 * s : 0);
  let y = profile
    ? sy + 7 - Math.abs(sk) * 0.9 - Math.max(0, sk) * 0.6
    : sy + 7 + (front ? sk : back ? -sk : sk * 0.7) * 1.1;
  if (action >= 0) {
    x = sx + aim[0]! * (2 + reach * 5);
    y = sy + 3 + aim[1]! * reach * 4;
  }
  const aimAngle = Math.atan2(aim[1]!, aim[0]!);
  // Crossbow points along aim; a blade cuts across it, a staff returns upright after release.
  let angle = action >= 0 ? aimAngle + [-0.8, -0.1, 0.45, -0.7][action]! : -1.1 + sw * 0.15;
  if (frame >= CAST_FRAME) angle = action === 1 ? aimAngle - 0.35 : -1.35;
  else if (frame >= SHOT_FRAME) {
    angle = aimAngle;
    x -= aim[0]! * (action === 2 ? 1.2 : 0);
    y -= aim[1]! * (action === 2 ? 1.2 : 0);
  }
  return { x, y, angle };
}

/**
 * Draw one 24x32 person frame (frame 0 idle, 1..8 walk, 9 idle-breath, 10..13 strike, 14..21 run, 22..25 crossbow, 26..29 cast). Natural proportions, about four heads tall:
 * a tapered torso over the hips, jointed arms that hang clear of the waist, knees that bend as each foot lifts, and
 * heeled boots. Limbs swing in opposition and the body rises twice per stride.
 */
export function paintNpc(ctx: Ctx, dir: number, frame: number, o: Outfit, seed: number): void {
  const work = actionPose(dir, frame);
  const legacyFrame = frame;
  if (work) frame = 0;
  const v = VIEWS[dir]!;
  const s = v.s,
    turn = v.turn;
  const back = turn > 1.2,
    front = turn < 0.8,
    profile = turn === 1,
    three = turn === 0.5 || turn === 1.5;
  const running = frame >= RUN_FRAME && frame < SHOT_FRAME;
  const action =
    frame >= CAST_FRAME
      ? frame - CAST_FRAME
      : frame >= SHOT_FRAME
        ? frame - SHOT_FRAME
        : frame >= ATTACK_FRAME && frame < RUN_FRAME
          ? frame - ATTACK_FRAME
          : -1;
  const reach = action >= 0 ? [0.35, 1, 0.65, 0][action]! : 0;
  const aim = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-0.894, 0.447],
    [0.894, 0.447],
    [-0.894, -0.447],
    [0.894, -0.447],
  ][dir]!;
  const moving = (frame >= 1 && frame <= 8) || running || work?.action === 'swim';
  const p = moving
    ? ((work?.action === 'swim' ? work.phase * 8 : running ? frame - RUN_FRAME : frame - 1) / 8) * Math.PI * 2
    : 0;
  const sw = moving ? Math.sin(p) * (running ? 1.3 : 1) : 0;
  const cosp = moving ? Math.cos(p) : 0;
  const top = moving ? (Math.abs(sw) < 0.5 && !work ? -1 : 0) : action >= 0 ? -reach * 0.7 : frame === 9 ? 0.6 : 0;
  const sh = o.shorten ?? 0;
  const cx = 12.5;
  const foot = 30;
  const crouch = work?.crouch ?? 0;
  const hipY = 20.6 + sh * 0.5 + top * 0.6 + crouch * 0.55;
  const y0 = 13.0 + sh * 0.6 + top + crouch; // shoulder line
  const waistY = y0 + 4.2;
  const shW = profile ? 2.9 : three ? 4.0 : 4.5,
    waW = profile ? 2.4 : three ? 3.0 : 3.3,
    hiW = profile ? 2.6 : three ? 3.2 : 3.5;
  const lean = (profile ? 0.6 : three ? 0.3 : 0) * s * (running ? 2 : moving ? 1 : 0.5) + aim[0]! * reach; // the chest leads the hips a little
  const edge = (r: Ramp) => [r[0]!, r[0]!] as Ramp; // selective outline for limbs crossing the body
  // three-quarter views: the shoulder turned toward the camera is screen-left when facing down-right (and mirrored)
  const nearK = (back ? s : -s) > 0 ? 1 : 0,
    farK = 1 - nearK;

  const drawLeg = (k: number, near: boolean) => {
    const sk = k ? -sw : sw; // + = forward
    const lift = moving ? Math.max(0, k ? -cosp : cosp) * 2.4 : 0; // the recovering leg lifts its foot
    const hx0 = profile ? cx - 0.3 * s : cx + (k ? 2 : -2) + (three ? 0.4 * s : 0);
    const fx = hx0 + (profile ? sk * 3.4 * s : three ? sk * 1.9 * s : 0);
    const fy =
      (work?.action === 'sit' ? foot - 5 : foot - 1.6) -
      lift +
      (profile ? 0 : front ? sk * 0.8 : back ? -sk * 0.8 : sk * 0.5);
    const hy0 = hipY + 1;
    const bend = lift * 0.7 + 0.3;
    const kx =
      (hx0 + fx) / 2 + (profile ? bend * s : three ? bend * 0.6 * s : 0) + (work?.action === 'sit' ? s * 2 : 0);
    const ky = (hy0 + fy) / 2 - (front || back ? lift * 0.3 : 0);
    if (near) {
      limb(ctx, hx0, hy0, kx, ky, 2.1, 1.9, edge(o.pants));
      limb(ctx, kx, ky, fx, fy, 1.9, 1.8, edge(o.pants));
    }
    limb(ctx, hx0, hy0, kx, ky, 1.45, 1.25, o.pants, seed + k, k ? -0.1 : 0.04);
    limb(ctx, kx, ky, fx, fy - 0.6, 1.2, 1.05, o.pants, seed + 3 + k, k ? -0.12 : 0.02);
    const toe = profile ? 1.3 * s : three ? 0.8 * s : 0;
    limb(ctx, fx, fy - 1.3, fx, fy + 0.2, 1.15, 1.2, o.boots, seed + 5 + k, 0.05);
    blob(ctx, fx + toe, fy + 0.9, profile ? 2.2 : 1.6, 1.15, o.boots, {
      seed: seed + 6 + k,
      noise: 0,
      edgeDark: 0.15,
      bright: 0.05,
    });
    put(ctx, Math.floor(fx - 0.5), Math.round(fy - 1.5), o.boots[2] ?? o.boots[1]!, 2, 1); // turned-down cuff
  };
  const drawArm = (k: number, near: boolean) => {
    const sk = k ? sw : -sw; // arms swing against the legs; + = forward
    const sy = y0 + 1.3;
    let sx: number, ex: number, ey: number, hx: number, hy: number;
    if (profile) {
      sx = cx + lean * 0.8;
      ex = sx + (sk * 1.3 - 0.3) * s;
      ey = sy + 3.7;
      hx = sx + (sk * 2.8 + Math.max(0, sk) * 0.8) * s;
      hy = sy + 7 - Math.abs(sk) * 0.9 - Math.max(0, sk) * 0.6;
    } else {
      const side = k ? 1 : -1;
      sx = cx + side * (shW - (three && k === farK ? 1.5 : 0.7)) + lean;
      ex = sx + side * 0.7 + (three ? sk * 0.7 * s : 0);
      ey = sy + 3.7 + (front ? sk * 0.4 : back ? -sk * 0.4 : 0);
      hx = sx + side * 0.9 + (three ? sk * 1.6 * s : 0);
      hy = sy + 7 + (front ? sk : back ? -sk : sk * 0.7) * 1.1;
    }
    if (action >= 0) {
      if (k === nearK) {
        hx = sx + aim[0]! * (2 + reach * 5);
        hy = sy + 3 + aim[1]! * reach * 4;
        ex = sx + (hx - sx) * 0.55;
        ey = sy + 2.3 + aim[1]! * reach;
      } else {
        hx = sx + (profile ? s : k ? -1 : 1) * 1.5;
        hy = sy + 4;
        ey = sy + 2.8;
      }
    }
    if (k === nearK && !sh) {
      const grip = npcGrip(dir, legacyFrame);
      hx = grip.x;
      hy = grip.y;
      if (action >= 0) {
        ex = sx + (hx - sx) * 0.55;
        ey = sy + 2.3 + aim[1]! * reach;
      }
    }
    // The support hand meets the stock while shooting, rather than guarding the chest.
    if (frame >= SHOT_FRAME && frame < CAST_FRAME && k !== nearK) {
      const grip = npcGrip(dir, legacyFrame);
      hx = grip.x + aim[0]! * 3;
      hy = grip.y + aim[1]! * 3;
      ex = (sx + hx) / 2;
      ey = sy + 3;
    }
    if (work) {
      hx = k === nearK ? work.x : work.supportX;
      hy = k === nearK ? work.y : work.supportY;
      ex = sx + (hx - sx) * 0.5 + (k ? 1 : -1);
      ey = sy + (hy - sy) * 0.6 + 1;
    }
    if (near) {
      limb(ctx, sx, sy, ex, ey, 1.8, 1.7, edge(o.shirt));
      limb(ctx, ex, ey, hx, hy - 0.8, 1.7, 1.6, edge(o.shirt));
    }
    limb(ctx, sx, sy, ex, ey, 1.3, 1.1, o.shirt, seed + 10 + k, k ? -0.08 : 0.06);
    limb(ctx, ex, ey, hx, hy - 0.8, 1.1, 0.95, o.shirt, seed + 12 + k, k ? -0.1 : 0.03);
    put(ctx, Math.round(hx - 0.5), Math.round(hy - 1.2), o.trim ?? o.shirt[0]!, 1, 1); // cuff
    blob(ctx, hx, hy + 0.2, 1.1, 1.15, o.skin, { seed: seed + 14 + k, noise: 0, edgeDark: 0.2, bright: 0.05 });
  };

  // cape behind everything (front views) / over the back (back views)
  const capeDraw = () => {
    if (!o.cape) return;
    const flutter = moving ? Math.sin(p * 2) * 0.8 : 0;
    if (back)
      poly(
        ctx,
        [
          [cx - shW + 0.2, y0 + 0.3],
          [cx + shW - 0.2, y0 + 0.3],
          [cx + shW + 1.4, 25 + flutter],
          [cx - shW - 1.4, 25 - flutter],
        ],
        (x, y) => rampAt(o.cape!, 0.75 - (x - cx + shW) / 14 - (y - y0) / 40 + ((x + y) % 4 === 0 ? -0.15 : 0), x, y),
      );
    else if (!front)
      poly(
        ctx,
        [
          [cx - 1.2 * s, y0 + 0.4],
          [cx - 3.2 * s, y0 + 1.2],
          [cx - (5.6 + (moving ? 1 : 0)) * s + flutter * s, 25],
          [cx - 1.6 * s, 25.5],
        ],
        (x, y) => rampAt(o.cape!, 0.5 - (y - y0) / 40, x, y),
      );
    else {
      poly(
        ctx,
        [
          [cx - shW - 0.4, y0 + 0.8],
          [cx - shW + 0.6, y0 + 0.8],
          [cx - shW - 0.6, 24 - flutter],
          [cx - shW - 1.8, 24 - flutter],
        ],
        o.cape[1]!,
      );
      poly(
        ctx,
        [
          [cx + shW - 0.6, y0 + 0.8],
          [cx + shW + 0.4, y0 + 0.8],
          [cx + shW + 1.8, 24 + flutter],
          [cx + shW + 0.6, 24 + flutter],
        ],
        o.cape[0]!,
      );
    }
  };
  if (!back) capeDraw();

  // far limbs, then the near leg over the far one
  if (profile) {
    drawArm(0, false);
    drawLeg(s > 0 ? 0 : 1, false);
    drawLeg(s > 0 ? 1 : 0, true);
  } else if (three) {
    drawArm(farK, false);
    drawLeg(farK, false);
    drawLeg(nearK, true);
  } else {
    drawLeg(0, false);
    drawLeg(1, false);
  }

  // hips (trousers seat) and the tapered tunic over them
  poly(
    ctx,
    [
      [cx - hiW, hipY - 1],
      [cx + hiW, hipY - 1],
      [cx + hiW + 0.3, hipY + 2.4],
      [cx - hiW - 0.3, hipY + 2.4],
    ],
    (x, y) => rampAt(o.pants, 0.75 - (x - cx + hiW) / 10, x, y),
  );
  if (!profile && !three) put(ctx, Math.round(cx - 0.5), Math.round(hipY + 1.4), o.pants[0]!, 1, 1);
  const tcx = cx + lean;
  poly(
    ctx,
    [
      [tcx - shW + 0.9, y0 - 0.5],
      [tcx + shW - 0.9, y0 - 0.5],
      [tcx + shW, y0 + 1.1],
      [cx + waW + lean * 0.4, waistY],
      [cx + hiW, hipY + 1],
      [cx - hiW, hipY + 1],
      [cx - waW + lean * 0.4, waistY],
      [tcx - shW, y0 + 1.1],
    ],
    (x, y) => {
      const u = (x + 0.5 - (cx - shW)) / (2 * shW);
      const seam =
        (front || three) && Math.abs(x + 0.5 - (cx + lean * 0.7 + (three ? 0.8 * s : 0))) < 0.55 && y > y0 + 1.5
          ? -0.14
          : 0;
      const hem = y >= hipY ? -0.12 : 0;
      const flank = three && (x + 0.5 - cx) * (back ? -s : s) > shW - 1.8 ? -0.22 : 0; // the side plane turning away
      return rampAt(o.shirt, 0.95 - u * 0.7 - (y - y0) / 26 + (y < y0 + 1.2 ? 0.14 : 0) + seam + hem + flank, x, y);
    },
  );
  if (front || three) {
    put(ctx, Math.round(tcx - 1 + (three ? 0.6 * s : 0)), Math.round(y0 - 0.5), o.skin[2]!, 2, 1);
    put(ctx, Math.round(tcx - 0.5 + (three ? 0.6 * s : 0)), Math.round(y0 + 0.5), o.skin[1]!, 1, 1);
  }
  if (o.trim !== undefined && !back) {
    const nx0 = Math.round(tcx - 2.4 + (three ? 0.6 * s : 0));
    put(ctx, nx0, Math.round(y0 + 0.4), o.trim, 1, 2);
    put(ctx, nx0 + 4 + (profile ? -2 : 0), Math.round(y0 + 0.4), o.trim, 1, 2);
  }
  if (o.vest && !back) {
    poly(
      ctx,
      [
        [cx - shW + 0.6, y0 + 0.2],
        [cx - 0.9 + lean, y0 + 0.6],
        [cx - 1.2, hipY],
        [cx - hiW, hipY],
      ],
      (x, y) => rampAt(o.vest!, 0.72 - (y - y0) / 30, x, y),
    );
    if (!profile)
      poly(
        ctx,
        [
          [cx + 0.9 + lean, y0 + 0.6],
          [cx + shW - 0.6, y0 + 0.2],
          [cx + hiW, hipY],
          [cx + 1.2, hipY],
        ],
        (x, y) => rampAt(o.vest!, 0.38 - (y - y0) / 30, x, y),
      );
  }
  if (o.dress === 'robe' || o.dress === 'coat') {
    // long garments hang from the hips: robes flare to the shins, coats stop at the knee and part down the front
    const robe = o.dress === 'robe';
    const hem = robe ? 27.4 : 25.6,
      flare = (robe ? 2.8 : 1.9) * (profile ? 0.55 : 1),
      sway = moving ? sw * (profile ? 0.5 : 0.9) : 0;
    const l0 = cx - hiW - 0.3 + lean * 0.3,
      r0 = cx + hiW + 0.3 + lean * 0.3;
    poly(
      ctx,
      [
        [l0, hipY - 0.8],
        [r0, hipY - 0.8],
        [r0 + flare + sway, hem],
        [l0 - flare + sway, hem],
      ],
      (x, y) => {
        const u = (x + 0.5 - l0) / (r0 - l0 + 2 * flare);
        const fold = (x * 3 + (robe ? 1 : 0)) % 5 === 0 && y > hipY + 2 ? -0.13 : 0;
        const wave = y > hem - 1.4 ? -0.14 : 0;
        return rampAt(o.shirt, 0.88 - u * 0.62 - (y - hipY) / 34 + fold + wave, x, y);
      },
    );
    if (!back && !profile && !robe) {
      // the open front shows the trousers beneath, framed by lapels
      const mx = Math.round(cx + lean * 0.3 + (three ? 0.8 * s : 0));
      for (let y = Math.round(hipY + 1); y < hem; y++) {
        put(ctx, mx - 1, y, o.trim ?? o.shirt[3]!);
        put(ctx, mx, y, o.pants[1]!);
        put(ctx, mx + 1, y, o.trim ?? o.shirt[3]!);
      }
      for (let i = 0; i < 4; i++) {
        put(
          ctx,
          Math.round(tcx - 2.4 + i * 0.6 + (three ? 0.6 * s : 0)),
          Math.round(y0 + 0.4 + i * 1.3),
          o.trim ?? o.shirt[4]!,
        );
        put(
          ctx,
          Math.round(tcx + 2.0 - i * 0.6 + (three ? 0.6 * s : 0)),
          Math.round(y0 + 0.4 + i * 1.3),
          o.trim ?? o.shirt[4]!,
        );
      }
    }
    if (o.trim !== undefined) {
      const hy2 = Math.round(hem) - 1;
      for (let x = Math.round(l0 - flare + sway); x < Math.round(r0 + flare + sway); x++) put(ctx, x, hy2, o.trim);
    }
  }
  if (!back && !o.plate && !o.apron) {
    const seamX = Math.round(tcx + (three ? s : 0));
    put(ctx, seamX - 2, Math.round(y0), o.trim ?? o.shirt[3]!, 2, 1);
    put(ctx, seamX + 1, Math.round(y0), o.trim ?? o.shirt[3]!, profile ? 1 : 2, 1);
    for (const offset of [3, 6]) put(ctx, seamX, Math.round(y0 + offset), o.trim ?? o.shirt[4]!, 1, 1);
    if (!profile) {
      put(ctx, Math.round(cx - hiW - 1), Math.round(hipY), o.boots[1]!, 2, 3);
      put(ctx, Math.round(cx - hiW - 1), Math.round(hipY), o.boots[3] ?? o.boots[2]!, 2, 1);
    }
  }
  const beltY = Math.round(hipY - 0.3);
  poly(
    ctx,
    [
      [cx - waW - 0.4, beltY],
      [cx + waW + 0.4, beltY],
      [cx + waW + 0.4, beltY + 1],
      [cx - waW - 0.4, beltY + 1],
    ],
    C.e0,
  );
  if (!back) put(ctx, Math.round(cx - 0.5 + (profile ? 1.2 * s : three ? 0.8 * s : 0)), beltY, o.trim ?? C.e6, 1, 1);
  if (o.glow !== undefined && !back) {
    const gx = Math.round(cx - 0.5 + lean + (profile ? 1.4 * s : three ? 1.2 * s : 0));
    for (let y = Math.round(y0) + 2; y < beltY; y += 2) put(ctx, gx, y, o.glow);
  }
  if (o.sash && !back && !profile)
    for (let i = 0; i < 9; i++)
      put(ctx, Math.round(cx - shW + 1.2 + i * 0.95 + lean * 0.5), Math.round(y0 + 0.8 + i * 0.9), o.sash[2]!);
  if (o.apron) {
    if (front || turn === 0.5)
      poly(
        ctx,
        [
          [cx - waW + 0.4 + (three ? 0.6 * s : 0), y0 + 3],
          [cx + waW - 0.4 + (three ? 0.6 * s : 0), y0 + 3],
          [cx + hiW - 0.2, hipY + 5],
          [cx - hiW + 0.2, hipY + 5],
        ],
        (x, y) => rampAt(o.apron!, 0.85 - (x - cx + waW) / 12 - (y - y0) / 40, x, y),
      );
    else if (profile)
      poly(
        ctx,
        [
          [cx + 1 * s, y0 + 3],
          [cx + 2.4 * s, y0 + 3],
          [cx + 3.2 * s, hipY + 5],
          [cx + 1.2 * s, hipY + 5],
        ],
        o.apron[2]!,
      );
    else {
      put(ctx, Math.round(cx - 1.5), beltY, o.apron[1]!, 3, 1);
      put(ctx, Math.round(cx - shW + 1), Math.round(y0), o.apron[1]!, 1, 4);
      put(ctx, Math.round(cx + shW - 2), Math.round(y0), o.apron[1]!, 1, 4);
    }
  }
  if (back) capeDraw();

  // near limbs over the body
  if (profile) drawArm(1, true);
  else if (three) drawArm(nearK, true);
  else {
    drawArm(0, true);
    drawArm(1, true);
  }

  // breastplate, mantle and rounded pauldrons over both shoulders
  if (o.plate && !back)
    poly(
      ctx,
      [
        [tcx - shW + 1.5, y0 + 0.2],
        [tcx + shW - 1.5, y0 + 0.2],
        [tcx + shW - 2.1, waistY + 0.4],
        [tcx - shW + 2.1, waistY + 0.4],
      ],
      (x, y) => rampAt(o.plate!, 0.92 - (x - tcx + shW) / 13 - (y - y0) / 15 + (y > waistY - 0.6 ? -0.2 : 0), x, y),
    );
  if (o.mantle)
    blob(ctx, tcx, y0 + 1.1, shW + 0.5, 2.1, o.mantle, { seed: seed + 72, noise: 0.12, bright: 0.05, edgeDark: 0.2 });
  if (o.mantle && o.trim !== undefined && !back)
    put(ctx, Math.round(tcx - shW + 0.5), Math.round(y0 + 2.5), o.trim, Math.round(shW * 2 - 1), 1);
  const guard = o.plate ?? (o.hatStyle === 'helm' ? o.hat : undefined);
  if (guard)
    for (const k of profile ? [1] : [0, 1]) {
      const side = profile ? s : k ? 1 : -1;
      blob(ctx, tcx + side * (shW - (profile ? 1.8 : 0.4)), y0 + 1.2, 2.3, 1.8, guard, {
        seed: seed + 70 + k,
        noise: 0.05,
        bright: side < 0 ? 0.12 : -0.05,
        edgeDark: 0.2,
      });
    }
  // neck + head
  const hx = cx + (profile ? 0.7 * s : three ? 0.4 * s : 0) + lean * 0.6;
  const hy = 7.4 + top + sh * 0.5 + crouch;
  put(ctx, Math.round(hx - 1), Math.round(hy + 2.8), o.skin[1]!, 2, 2);
  if (o.scarf) {
    blob(ctx, tcx, y0 + 0.3, shW - 1, 1.5, o.scarf, { seed: seed + 30, noise: 0, edgeDark: 0.15 });
    if (!back) put(ctx, Math.round(cx + (profile ? -1.5 * s : 1.5)), Math.round(y0 + 0.8), o.scarf[1]!, 1, 4);
  }
  // head: soft, mostly mid-tone skin (faces read better flat), lit along the upper-left, jaw shaded
  {
    const rx = profile ? 3.2 : 3.5,
      ry = 4.0;
    for (let y = Math.floor(hy - ry); y <= Math.ceil(hy + ry); y++)
      for (let x = Math.floor(hx - rx); x <= Math.ceil(hx + rx); x++) {
        const nx = (x + 0.5 - hx) / rx,
          ny = (y + 0.5 - hy) / ry;
        const jaw = ny > 0.35 ? (ny - 0.35) * 0.9 : 0; // the chin narrows
        if (nx * nx + ny * ny > 1 || Math.abs(nx) > 1 - jaw) continue;
        const t = 0.74 - nx * 0.22 - ny * 0.14 - (nx * nx + ny * ny > 0.7 && nx > 0 ? 0.14 : 0);
        put(ctx, x, y, rampAt(o.skin, t, x, y));
      }
  }
  if (!front || turn === 0.5)
    if (!back || turn === 1.5) put(ctx, Math.round(hx - 1.6 * s), Math.round(hy + 0.6), o.skin[1]!, 1, 2);
  // hair: sculpted masses with a restrained highlight and directional side locks
  const style: HairStyle = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  const H = o.hair;
  const hr = (y: number, x: number, t: number) => rampAt(H, t, x, y);
  if (style !== 'bald') {
    const big = style === 'curly' ? 1 : 0;
    for (let y = Math.floor(hy - 6 - big); y <= Math.ceil(hy + 4.6); y++)
      for (let x = Math.floor(hx - 6 - big); x <= Math.ceil(hx + 6 + big); x++) {
        const nx = (x + 0.5 - hx) / (4.1 + big * 0.6),
          ny = (y + 0.5 - (hy - 0.6)) / (4.5 + big * 0.6);
        if (nx * nx + ny * ny > 1) continue;
        const fringe = hy - 1.6 + (x < hx - 1 ? 0.4 : x < hx + 1 ? 1.2 : 0); // spiky bangs
        let cover: boolean;
        if (back) cover = y < hy + 3.2;
        else if (front) cover = y < fringe || (Math.abs(nx) > 0.74 && y < hy + 2.6);
        else if (profile) cover = y < fringe - 0.4 || (x - hx) * s < -0.4;
        else
          cover =
            y < fringe || ((x - hx) * s < -1.6 && y < hy + 2.6) || (turn === 1.5 && y < hy + 3.2 && (x - hx) * s < 1.4);
        if (!cover) continue;
        const lam = -nx * 0.6 - ny * 0.7;
        const shine =
          ny > -0.66 && ny < -0.4 && nx > -0.7 && nx < 0.25 && !back
            ? 0.3
            : back && ny > -0.5 && ny < -0.25 && nx < 0.2
              ? 0.25
              : 0;
        const strand = Math.abs(x - hx + s * 2) < 0.6 && ny > -0.3 ? -0.12 : 0;
        put(ctx, x, y, hr(y, x, 0.5 + lam * 0.5 + shine + strand + (big && nx < -0.4 ? 0.08 : 0)));
      }
    const longLen = style === 'long' ? 9 : style === 'braids' ? 10 : 0;
    if (longLen) {
      if (back)
        poly(
          ctx,
          [
            [hx - 4.6, hy],
            [hx + 4.6, hy],
            [hx + 4.0, hy + longLen - 2],
            [hx, hy + longLen - 1],
            [hx - 4.0, hy + longLen - 2],
          ],
          (x, y) => hr(y, x, 0.65 - (y - hy) / 20 - (x - hx + 5) / 25 + (x % 3 === 0 ? -0.12 : 0)),
        );
      else if (front || turn === 0.5) {
        for (const sx of style === 'braids' ? [-4.8, 4] : [-5, 4.2])
          for (let y = 0; y < longLen - 1; y++)
            put(
              ctx,
              Math.round(hx + sx),
              Math.round(hy + 1 + y),
              hr(y, 0, 0.55 - y / 18 + (sx < 0 ? 0.15 : 0) + (style === 'braids' && y % 2 ? -0.2 : 0)),
              style === 'braids' ? 1 : 2,
              1,
            );
      } else
        poly(
          ctx,
          [
            [hx - 0.8 * s, hy - 1],
            [hx - 4.6 * s, hy - 1],
            [hx - 4.2 * s, hy + longLen - 2],
            [hx - 1.4 * s, hy + longLen - 3],
          ],
          (x, y) => hr(y, x, 0.45 - (y - hy) / 25),
        );
    }
    if (style === 'bun')
      blob(ctx, hx - (profile ? 3 * s : 0), hy - 5.8 + (back ? 1 : 0), 2.6, 2.2, H, {
        seed: seed + 40,
        noise: 0.15,
        edgeDark: 0.2,
        bright: 0.1,
      });
    if (style === 'ponytail') {
      if (back) limb(ctx, hx, hy - 1, hx + 0.5, hy + 7, 1.9, 1.2, H, seed + 41);
      else if (!front) limb(ctx, hx - 4 * s, hy - 2, hx - 6 * s, hy + 5, 1.8, 1.1, H, seed + 41);
      else limb(ctx, hx + 4.6, hy - 2, hx + 5.4, hy + 3, 1.2, 0.9, H, seed + 41);
    }
    const tie = o.trim ?? C.r3;
    if (style === 'spiky') {
      // swept-up spikes, each lit on its left edge
      const spread = profile ? 0.62 : 1;
      for (const [bx, tx, ty] of [
        [-3.2, -5.2, -9],
        [-1, -2.2, -10.6],
        [1.2, 1.4, -10.2],
        [3.2, 4.6, -8.2],
      ] as const) {
        const ox = profile ? -1.2 * s : 0;
        poly(
          ctx,
          [
            [hx + ox + (bx - 1.5) * spread, hy - 3.6],
            [hx + ox + (bx + 1.5) * spread, hy - 3.6],
            [hx + ox + tx * spread, hy + ty],
          ],
          (x, y) => hr(y, x, x < hx + ox + tx * spread ? 0.78 - (hy - 3.6 - y) / 18 : 0.45 - (hy - 3.6 - y) / 24),
        );
      }
    }
    if (style === 'swept') {
      // a long side-swept fringe over one eye, with a lock that falls to the shoulder
      if (front || turn === 0.5) {
        poly(
          ctx,
          [
            [hx - 4.4, hy - 4.2],
            [hx + 4.4, hy - 4.6],
            [hx + 4.8, hy + 2.4],
            [hx + 3.4, hy + 3.6],
            [hx + 1.6, hy + 0.8],
            [hx - 1.2, hy - 1.6],
          ],
          (x, y) => hr(y, x, 0.62 - (y - hy) / 14 + ((x + y) % 4 === 0 ? 0.12 : 0) - (x > hx + 2 ? 0.1 : 0)),
        );
        limb(ctx, hx + 4.4, hy, hx + 5.2, hy + 8, 1.4, 1, H, seed + 43);
      } else if (profile)
        poly(
          ctx,
          [
            [hx - 1 * s, hy - 5],
            [hx + 3.8 * s, hy - 3.2],
            [hx + 3.6 * s, hy + 1.4],
            [hx + 1 * s, hy - 1],
          ],
          (x, y) => hr(y, x, 0.6 - (y - hy) / 14),
        );
      else limb(ctx, hx, hy - 1, hx + 0.8, hy + 6, 2.6, 1.4, H, seed + 43);
    }
    if (style === 'topknot') {
      blob(ctx, hx - (profile ? 1.6 * s : 0), hy - 7.4 + (back ? 0.8 : 0), 1.9, 1.9, H, {
        seed: seed + 44,
        noise: 0.1,
        edgeDark: 0.2,
        bright: 0.12,
      });
      put(ctx, Math.round(hx - (profile ? 1.6 * s : 0)) - 1, Math.round(hy - 5.4), tie, 2, 1);
    }
    if (style === 'twintail') {
      const tails = profile ? [-s] : [-1, 1];
      for (const t of tails) {
        const sway = moving ? Math.sin(p + (t > 0 ? 1.4 : 0)) * 0.9 : 0;
        const bx = hx + t * (profile ? 4.2 : 4.4);
        limb(
          ctx,
          bx,
          hy - 1.6,
          bx + t * 1.6 + sway,
          hy + 8.4,
          1.8,
          0.9,
          H,
          seed + 45 + (t > 0 ? 1 : 0),
          t > 0 ? -0.08 : 0.08,
        );
        put(ctx, Math.round(bx) - 1, Math.round(hy - 2), tie, 2, 1);
      }
    }
  } else {
    put(ctx, Math.round(hx - 2), Math.round(hy - 3.6), o.skin[4]!, 3, 1); // scalp shine
  }
  if (o.headband !== undefined) put(ctx, Math.round(hx - 4.5), Math.round(hy - 2), o.headband, 9, 1);

  // Faces: one-pixel eyes, brows and a quiet jaw shadow.
  const ey = Math.round(hy + 0.6);
  const eye = (x: number) => {
    put(ctx, x, ey, C.ink, 1, 1);
    put(ctx, x, ey - 1, o.hair[1]!, 1, 1);
    if (o.eyes !== undefined) put(ctx, x, ey + 1, o.eyes, 1, 1); // iris glints under the lid
  };
  if (front) {
    for (const ex of o.hairStyle === 'swept' ? [-2] : [-2, 1]) eye(Math.round(hx) + ex);
    put(ctx, Math.round(hx) - 3, ey + 2, o.skin[2]!);
    put(ctx, Math.round(hx) + 2, ey + 2, o.skin[2]!); // cheeks
    put(ctx, Math.round(hx) - 1, ey + 3, o.skin[1]!, 2, 1);
  } else if (turn === 0.5) {
    eye(Math.round(hx - 0.4 * s) - (s < 0 ? 1 : 0));
    eye(Math.round(hx + 2.6 * s) - (s < 0 ? 1 : 0));
    put(ctx, Math.round(hx + 1.4 * s) - (s < 0 ? 1 : 0), ey + 3, o.skin[1]!, 1, 1);
  } else if (profile) {
    eye(Math.round(hx + 1.8 * s) - (s < 0 ? 1 : 0));
    put(ctx, Math.round(hx + 3.4 * s) - (s < 0 ? 1 : 0), ey + 1, o.skin[3]!, 1, 1); // nose
    put(ctx, Math.round(hx + 2.6 * s) - (s < 0 ? 1 : 0), ey + 3, o.skin[1]!, 1, 1);
  }
  if (work?.action === 'talk' && ((legacyFrame - 70) % 4 === 1 || (legacyFrame - 70) % 4 === 2) && !back) {
    put(ctx, Math.round(hx + (profile ? s * 2 : three ? s : 0)), ey + 3, o.skin[0]!, 1, 1);
  }
  if (o.glasses && !back) {
    if (front) {
      for (const ex of [-3, 0]) {
        put(ctx, Math.round(hx + ex), ey - 1, C.night, 3, 1);
        put(ctx, Math.round(hx + ex), ey + 2, C.night, 3, 1);
        put(ctx, Math.round(hx + ex + 1), ey, C.w6);
      }
    } else put(ctx, Math.round(hx + (turn === 0.5 ? 1 : 2.4) * s) - 1, ey - 1, C.night, 3, 1);
  }
  if (o.beard && !back) {
    const bx = hx + (profile ? 2.2 * s : turn === 0.5 ? 1 * s : 0);
    blob(ctx, bx, hy + 3.2, profile ? 2.4 : 3.2, 2.1, o.beard, { seed: seed + 50, noise: 0.3, edgeDark: 0.15 });
    put(ctx, Math.round(bx) - 1, Math.round(hy + 2.6), o.skin[0]!, 2, 1);
  }
  if (o.moustache && !back)
    put(
      ctx,
      Math.round(hx + (profile ? 3 * s : turn === 0.5 ? 1.3 * s : 0)) - 2,
      Math.round(hy + 2.4),
      (o.beard ?? o.hair)[1]!,
      4,
      1,
    );

  // hats
  if (o.hat) {
    const hs = o.hatStyle ?? 'cap';
    const hh = o.hat;
    if (hs === 'brim') {
      blob(ctx, hx, hy - 3.6, 6.8, 2.0, hh, { seed: seed + 60, noise: 0.25, edgeDark: 0.2 });
      blob(ctx, hx, hy - 5.2, 4.0, 2.6, hh, { seed: seed + 61, noise: 0.25, bright: 0.12, edgeDark: 0.12 });
      put(ctx, Math.round(hx - 4), Math.round(hy - 4.4), C.r3, 8, 1);
    } else if (hs === 'helm') {
      // domed iron helm with a visor slit, cheek guards and a crest
      blob(ctx, hx, hy - 1.8, 4.5, 4.6, hh, { seed: seed + 65, noise: 0.08, bright: 0.1, edgeDark: 0.2 });
      if (!back) put(ctx, Math.round(hx) - (profile ? 0 : 3), Math.round(hy + 0.6), C.ink, profile ? 4 : 6, 1);
      if (front) for (const sx of [-4, 3]) put(ctx, Math.round(hx) + sx, Math.round(hy + 1), hh[1]!, 1, 3);
      limb(ctx, hx, hy - 7.2, hx - 1.5 * s, hy - 5.5, 1.3, 0.9, o.cape ?? [C.r2, C.r3, C.r4, C.r5], seed + 67);
    } else if (hs === 'hood') {
      blob(ctx, hx, hy - 3, 4.7, 3.3, hh, { seed: seed + 66, noise: 0.12, bright: 0.05, edgeDark: 0.2 });
      for (const sx of [-1, 1])
        put(ctx, Math.round(hx + sx * 5 - (sx < 0 ? 1 : 0)), Math.round(hy - 1.5), hh[1]!, 1, 6);
      if (!back) put(ctx, Math.round(hx - 3), Math.round(hy - 1.2), hh[0]!, 7, 1);
    } else if (hs === 'bandana') {
      // a knotted headscarf: band across the brow, tails fluttering behind
      put(ctx, Math.round(hx - 4.5), Math.round(hy - 3.2), hh[2]!, 9, 2);
      put(ctx, Math.round(hx - 4.5), Math.round(hy - 1.8), hh[1]!, 9, 1);
      if (!back)
        for (let i = 0; i < 4; i++) put(ctx, Math.round(hx - 3 + i * 2), Math.round(hy - 2.8), hh[4] ?? hh[3]!, 1, 1);
      const kx = back ? hx + 1 : profile ? hx - 4.4 * s : hx + 4.6;
      limb(ctx, kx, hy - 2.4, kx + (moving ? 1.6 : 0.8) * (profile ? -s : 1), hy + 3.4, 1.4, 0.8, hh, seed + 68, 0.1);
      limb(ctx, kx, hy - 2.4, kx + (profile ? -s : 1) * 2.4, hy + 1.8, 1.2, 0.7, hh, seed + 69, 0.2);
    } else if (hs === 'crown') {
      put(ctx, Math.round(hx - 4.5), Math.round(hy - 4), hh[2]!, 9, 1);
      for (const [dx, h2] of [
        [-4, 2],
        [-2, 3],
        [0, 4],
        [2, 3],
        [4, 2],
      ] as const)
        put(
          ctx,
          Math.round(hx + dx) - (dx > 0 ? 1 : 0),
          Math.round(hy - 4 - h2),
          dx <= 0 ? (hh[4] ?? hh[3]!) : hh[3]!,
          1,
          h2,
        );
      if (!back) put(ctx, Math.round(hx) - 1, Math.round(hy - 4), C.r3, 1, 1);
    } else if (hs === 'circlet') {
      put(ctx, Math.round(hx - 4.5), Math.round(hy - 3.2), hh[2]!, 9, 1);
      if (!back) {
        put(ctx, Math.round(hx) - 1, Math.round(hy - 4.2), C.white, 2, 2);
        put(ctx, Math.round(hx), Math.round(hy - 3.8), (hh[4] ?? hh[hh.length - 1])!, 1, 1);
      }
    } else if (hs === 'beret') {
      blob(ctx, hx - 0.8 * s, hy - 4.6, 5.2, 2.4, hh, { seed: seed + 62, noise: 0.15, edgeDark: 0.15 });
      put(ctx, Math.round(hx - 0.6 * s), Math.round(hy - 7.1), hh[0]!, 1, 1);
    } else {
      blob(ctx, hx, hy - 4.4, 4.9, 2.8, hh, { seed: seed + 63, noise: 0.1, edgeDark: 0.12 });
      if (!back)
        blob(
          ctx,
          hx + (profile ? 3.8 * s : turn === 0.5 ? 1.8 * s : 0),
          hy - 2.6 + (front ? 0.4 : 0),
          profile ? 3 : 3.8,
          1.1,
          hh,
          { seed: seed + 64, noise: 0, edgeDark: 0.3 },
        );
    }
  }
}

// ───────────────────────── fauna & enemies ─────────────────────────
