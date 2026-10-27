import type { Outfit } from './actors';
import { actionPose } from './person-actions';
import { C, limb, poly, put, rampAt, type Ctx, type Ramp } from './shade';

/** Native pixels, not a scaled legacy sprite. Shared palette and top-left material lighting. */
export function paintPerson(
  ctx: Ctx,
  dir: number,
  frame: number,
  o: Outfit,
  grip: { x: number; y: number; angle: number },
): void {
  const facing = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-0.894, 0.447],
    [0.894, 0.447],
    [-0.894, -0.447],
    [0.894, -0.447],
  ][dir]!;
  const [dx, dy] = facing,
    back = dir === 1 || dir >= 6,
    profile = dir === 2 || dir === 3;
  const side = dx! < 0 ? -1 : 1,
    three = !profile && dir >= 4;
  const work = actionPose(dir, frame);
  const running = frame >= 14 && frame <= 21,
    walking = frame >= 1 && frame <= 8;
  const swimming = work?.action === 'swim';
  const phase = swimming ? work.phase * Math.PI * 2 : ((running ? frame - 14 : frame - 1) * Math.PI) / 4;
  const moving = running || walking || swimming;
  const stride = moving ? Math.sin(phase) : 0,
    lift = moving ? Math.cos(phase) : 0;
  const crouch = (work?.crouch ?? 0) * 1.4,
    sh = (o.shorten ?? 0) * 1.5;
  const bob = moving ? -Math.abs(Math.sin(phase * 2)) * (running ? 1.2 : 0.5) : frame === 9 ? 0.6 : 0;
  const lean = dx! * (running ? 1.5 : moving ? 0.5 : 0.2);
  const fallen = work?.action === 'death' ? work.phase : 0;
  const cx = 16,
    shoulder = 20 + bob + crouch + sh * 0.6 + fallen * 12,
    hip = 32 + crouch * 0.4 + sh * 0.4 + fallen * 7;
  const width = profile ? 3.5 : three ? 5 : 5.5;
  const panel = (points: number[][], ramp: Ramp, bright = 0) =>
    poly(ctx, points as [number, number][], (x, y) =>
      rampAt(ramp, 0.88 - (x - 9) / 26 - (y - 17) / 100 + bright, x, y),
    );
  const joint = (x: number, y: number, ex: number, ey: number, hx: number, hy: number, ramp: Ramp, w = 1.6) => {
    limb(ctx, x, y, ex, ey, w, w - 0.15, ramp, 0, 0);
    limb(ctx, ex, ey, hx, hy, w - 0.15, w - 0.35, ramp, 0, 0);
  };
  // Hanging fabric follows the hips, with a delayed, restrained hem instead of noisy flutter.
  const cape = () => {
    if (!o.cape) return;
    const sway = moving ? Math.sin(phase - 0.5) * 1.2 : 0;
    panel(
      [
        [cx - width, shoulder],
        [cx + width, shoulder],
        [cx + width + 1 + sway, 38],
        [cx - width - 2 + sway, 37],
      ],
      o.cape,
    );
    put(ctx, cx - width + 1, shoulder + 3, o.cape[2]!, 1, 10);
  };
  if (!back) cape();
  const leg = (k: number) => {
    const sign = k ? 1 : -1,
      swing = stride * sign;
    const planted = Math.max(0, -lift * sign),
      raised = Math.max(0, lift * sign);
    const hx = cx + (profile ? sign * 0.7 : sign * 2.4);
    const span = profile ? 5.8 : three ? 4.2 : 0;
    const fx = hx + side * swing * span;
    const fy = 44.5 - raised * (running ? 3.3 : 2.4) + (profile ? 0 : dy! * swing * 2.8);
    const seated = work?.action === 'sit';
    const footY = seated ? 40 : fy;
    const kneeX = seated ? hx + side * 4 : hx + (fx - hx) * 0.6 + side * raised * 1.3;
    const kneeY = seated ? hip + 3 : hip + 6 - planted * 0.3;
    joint(hx, hip, kneeX, kneeY, fx, footY, o.pants, 1.9);
    put(ctx, fx - 1, footY - 2, o.boots[1]!, 3, 3);
    put(ctx, fx - 1 + (profile ? side : 0), footY + 1, o.boots[0]!, profile ? 4 : 3, 1);
    put(ctx, fx - 1, footY - 2, o.boots[2] ?? o.boots[1]!, 2, 1);
  };
  const arm = (near: boolean) => {
    const sign = near ? (back ? side : -side) : back ? -side : side;
    const sx = cx + lean + (profile ? sign * 0.6 : sign * (width - 0.4)),
      sy = shoulder + 1;
    let hx = near ? grip.x : sx - stride * sign * (profile ? 3 : 1),
      hy = near ? grip.y : shoulder + 11;
    if (work && !near) {
      hx = work.supportX * 1.25 + 0.375;
      hy = work.supportY * 1.5;
    }
    if (frame >= 22 && frame < 26 && !near) {
      hx = grip.x + dx! * 3;
      hy = grip.y + dy! * 3;
    }
    const ex = sx + (hx - sx) * 0.5 + sign * 0.7,
      ey = sy + (hy - sy) * 0.55 + 1;
    joint(sx, sy, ex, ey, hx, hy - 1, o.shirt, 1.65);
    put(ctx, hx - 1, hy - 2, o.trim ?? o.shirt[0]!, 2, 1);
    put(ctx, hx - 1, hy - 1, o.skin[2]!, 2, 2);
    put(ctx, hx - 1, hy - 1, o.skin[3] ?? o.skin[2]!, 1, 1);
  };
  arm(false);
  leg(0);
  leg(1);
  // Tailored silhouette, waist seam, distinct cloth and armor planes.
  const hem = o.dress === 'robe' ? 40 : o.dress === 'coat' ? 36 : hip + 1;
  panel(
    [
      [cx + lean - width + 1, shoulder - 1],
      [cx + lean + width - 1, shoulder - 1],
      [cx + lean + width, shoulder + 2],
      [cx + 4, hip - 2],
      [cx + 5, hem],
      [cx - 5, hem],
      [cx - 4, hip - 2],
      [cx + lean - width, shoulder + 2],
    ],
    o.shirt,
  );
  if (o.vest)
    panel(
      [
        [cx - width + 1, shoulder],
        [cx + width - 1, shoulder],
        [cx + 3, hip - 2],
        [cx - 3, hip - 2],
      ],
      o.vest,
    );
  if (o.plate || o.dress === 'plated') {
    const metal = o.plate ?? o.shirt;
    panel(
      [
        [cx - width + 1, shoulder],
        [cx + width - 1, shoulder],
        [cx + 3, shoulder + 8],
        [cx, shoulder + 10],
        [cx - 3, shoulder + 8],
      ],
      metal,
      0.1,
    );
    put(ctx, cx - 3, shoulder + 2, metal[metal.length - 1]!, 3, 1);
    put(ctx, cx, shoulder + 4, metal[0]!, 1, 4);
  }
  if (o.apron)
    panel(
      [
        [cx - 3, shoulder + 3],
        [cx + 3, shoulder + 3],
        [cx + 4, hip + 4],
        [cx - 4, hip + 4],
      ],
      o.apron,
      0.1,
    );
  if (!back) {
    const trim = o.trim ?? o.shirt[1]!;
    put(ctx, cx - 1, shoulder + 1, o.skin[2]!, 2, 2);
    poly(
      ctx,
      [
        [cx - 3, shoulder],
        [cx - 1, shoulder + 1],
        [cx - 1, shoulder + 5],
      ],
      trim,
    );
    poly(
      ctx,
      [
        [cx + 3, shoulder],
        [cx + 1, shoulder + 1],
        [cx + 1, shoulder + 5],
      ],
      trim,
    );
    for (let y = shoulder + 6; y < hip - 2; y += 3) put(ctx, cx, y, trim);
    if (o.sash) limb(ctx, cx - width + 1, shoulder + 2, cx + 3, hip - 1, 1.1, 1, o.sash, 0);
    if (o.glow) {
      put(ctx, cx - 4, shoulder + 5, o.glow);
      put(ctx, cx + 3, shoulder + 6, o.glow);
    }
  }
  put(ctx, cx - 4, hip - 2, o.boots[0]!, 8, 2);
  put(ctx, cx - 1, hip - 2, o.trim ?? C.e5, 2, 2);
  put(ctx, cx + 3, hip, o.boots[1]!, 3, 4); // leather utility pouch
  put(ctx, cx + 3, hip, o.boots[2] ?? o.boots[1]!, 2, 1);
  if (o.mantle)
    panel(
      [
        [cx - width - 1, shoulder],
        [cx, shoulder - 2],
        [cx + width + 1, shoulder],
        [cx + width, shoulder + 4],
        [cx, shoulder + 2],
        [cx - width, shoulder + 4],
      ],
      o.mantle,
    );
  if (back) cape();
  // Jaw, neck and cheek planes leave enough native pixels for readable eyes and brows.
  const hx = cx + lean * 0.7 + (profile ? side * 0.3 : 0),
    hy = 12 + bob + crouch + sh * 0.6 + fallen * 20;
  put(ctx, hx - 1, hy + 5, o.skin[1]!, 3, 4);
  panel(
    [
      [hx - 5, hy - 5],
      [hx + 4, hy - 5],
      [hx + 5, hy - 2],
      [hx + 5, hy + 3],
      [hx + 2, hy + 6],
      [hx - 2, hy + 6],
      [hx - 5, hy + 3],
    ],
    o.skin,
    0.1,
  );
  if (profile) put(ctx, hx + side * 5 - (side < 0 ? 1 : 0), hy, o.skin[2]!, 2, 2);
  if (!back) {
    const eyes = profile ? [side * 3] : three ? [side === 1 ? -1 : -3, side === 1 ? 3 : 1] : [-3, 2];
    for (const x of eyes) {
      put(ctx, hx + x, hy, o.skin[0]!, 2, 1);
      put(ctx, hx + x, hy + 1, C.pale, 2, 1);
      put(ctx, hx + x + (side > 0 ? 1 : 0), hy + 1, o.eyes ?? C.night);
    }
    put(ctx, hx + (profile ? side * 4 : three ? side * 2 : 0), hy + 3, o.skin[1]!);
    put(ctx, hx + (profile ? side * 2 : -1), hy + 5, o.skin[0]!, 2, 1);
    if (o.glasses)
      for (const x of eyes) {
        put(ctx, hx + x - 1, hy, C.steel, 3, 1);
        put(ctx, hx + x - 1, hy + 2, C.steel, 3, 1);
      }
  }
  const hair = o.hair,
    style = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  if (style !== 'bald') {
    panel(
      [
        [hx - 5, hy],
        [hx - 6, hy - 4],
        [hx - 3, hy - 7],
        [hx + 2, hy - 7],
        [hx + 5, hy - 5],
        [hx + 5, hy - 1],
        [hx + 3, hy - 3],
        [hx, hy - 2],
        [hx - 2, hy - 4],
        [hx - 4, hy],
      ],
      hair,
    );
    if (back)
      panel(
        [
          [hx - 5, hy - 3],
          [hx + 5, hy - 3],
          [hx + 4, hy + 4],
          [hx - 3, hy + 5],
          [hx - 5, hy + 2],
        ],
        hair,
      );
    put(ctx, hx - 3, hy - 6, hair[Math.min(3, hair.length - 1)]!, 3, 1);
    if (['long', 'braids', 'twintail'].includes(style))
      for (const s of [-1, 1]) {
        limb(
          ctx,
          hx + s * 4,
          hy,
          hx + s * 5 + (moving ? stride * 0.6 : 0),
          hy + (style === 'long' ? 13 : 11),
          1.5,
          style === 'long' ? 1.7 : 0.8,
          hair,
          0,
        );
        if (style !== 'long') put(ctx, hx + s * 5 - 1, hy + 9, o.trim ?? C.e5, 2, 1);
      }
    if (['ponytail', 'topknot', 'bun'].includes(style)) {
      const x = hx - side * 5,
        y = style === 'topknot' ? hy - 9 : hy - 2;
      panel(
        [
          [x - 2, y],
          [x + 2, y - 1],
          [x + 3, y + 3],
          [x, y + 5],
          [x - 2, y + 3],
        ],
        hair,
      );
      if (style === 'ponytail') limb(ctx, x, y + 3, x - side * 2 + stride, hy + 13, 1.7, 0.8, hair, 0);
    }
    if (style === 'spiky')
      for (const x of [-4, 0, 3])
        poly(
          ctx,
          [
            [hx + x - 1, hy - 5],
            [hx + x, hy - 10 + (x === 0 ? 0 : 2)],
            [hx + x + 2, hy - 5],
          ],
          hair[2]!,
        );
    if (style === 'swept')
      poly(
        ctx,
        [
          [hx - 5, hy - 5],
          [hx + 4, hy - 7],
          [hx + 2, hy - 1],
          [hx - 1, hy - 3],
        ],
        hair[2]!,
      );
    if (style === 'curly') for (const x of [-5, -2, 1, 4]) put(ctx, hx + x, hy - 6 + (x % 2), hair[2]!, 3, 3);
  }
  if (o.beard && !back)
    panel(
      [
        [hx - 4, hy + 3],
        [hx + 4, hy + 3],
        [hx + 2, hy + 8],
        [hx, hy + 9],
        [hx - 3, hy + 6],
      ],
      o.beard,
    );
  if (o.moustache && !back) put(ctx, hx - 2, hy + 4, (o.beard ?? hair)[1]!, 5, 1);
  if (o.scarf) {
    put(ctx, hx - 4, hy + 7, o.scarf[2]!, 8, 2);
    put(ctx, hx + 2, hy + 9, o.scarf[1]!, 2, 5);
  }
  if (o.headband !== undefined) put(ctx, hx - 5, hy - 2, o.headband, 10, 1);
  if (o.hat) {
    const h = o.hat,
      hs = o.hatStyle ?? 'cap';
    if (hs === 'helm') {
      panel(
        [
          [hx - 6, hy],
          [hx - 6, hy - 5],
          [hx - 3, hy - 8],
          [hx + 3, hy - 8],
          [hx + 6, hy - 5],
          [hx + 6, hy],
          [hx + 3, hy - 2],
          [hx - 3, hy - 2],
        ],
        h,
        0.1,
      );
      put(ctx, hx - 1, hy - 7, h[h.length - 1]!, 1, 5);
      if (!back) {
        put(ctx, hx - 5, hy - 1, h[0]!, 10, 1);
        put(ctx, hx - 5, hy, h[1]!, 1, 4);
        put(ctx, hx + 4, hy, h[1]!, 1, 4);
      }
    } else if (hs === 'hood') {
      panel(
        [
          [hx - 6, hy + 5],
          [hx - 7, hy - 2],
          [hx - 3, hy - 8],
          [hx + 3, hy - 8],
          [hx + 7, hy - 2],
          [hx + 6, hy + 5],
          [hx + 4, hy],
          [hx + 3, hy - 3],
          [hx - 3, hy - 3],
          [hx - 4, hy],
        ],
        h,
      );
    } else if (hs === 'circlet' || hs === 'crown' || hs === 'bandana') {
      put(ctx, hx - 5, hy - 3, h[2]!, 10, 2);
      if (hs === 'crown') for (const x of [-4, 0, 4]) put(ctx, hx + x, hy - 6, h[3] ?? h[2]!, 1, 3);
      if (hs === 'circlet') put(ctx, hx, hy - 3, o.glow ?? C.q6, 1, 2);
    } else {
      panel(
        [
          [hx - 5, hy - 2],
          [hx - 5, hy - 5],
          [hx - 2, hy - 8],
          [hx + 4, hy - 7],
          [hx + 6, hy - 3],
          [hx + 4, hy - 1],
        ],
        h,
      );
      put(ctx, hx - 5, hy - 2, h[0]!, 10, 1);
      if (hs === 'brim') {
        put(ctx, hx - 8, hy - 1, h[1]!, 16, 1);
        put(ctx, hx - 6, hy - 2, h[3] ?? h[2]!, 12, 1);
      }
      if (hs === 'beret') put(ctx, hx - 6, hy - 6, h[2]!, 10, 2);
    }
  }
  arm(true);
  // Occupational implements are attached to the working hand, not an unrelated equipped sword.
  if (work && ['forge', 'cook', 'alchemy', 'saw'].includes(work.action)) {
    const { x, y, angle } = grip,
      ux = Math.cos(angle),
      uy = Math.sin(angle);
    if (work.action === 'alchemy') {
      put(ctx, x - 1, y - 3, C.steel, 2, 1);
      put(ctx, x - 2, y - 2, C.w3, 4, 4);
      put(ctx, x - 1, y - 1, C.q5, 2, 2);
      put(ctx, x - 2, y - 2, C.w6, 1, 2);
    } else {
      limb(
        ctx,
        x - ux * 2,
        y - uy * 2,
        x + ux * (work.action === 'saw' ? 5 : 7),
        y + uy * (work.action === 'saw' ? 5 : 7),
        0.7,
        0.7,
        [C.e1, C.e3, C.e5],
        0,
      );
      if (work.action === 'forge') {
        const tx = x + ux * 6,
          ty = y + uy * 6;
        limb(ctx, tx - uy * 3, ty + ux * 3, tx + uy * 3, ty - ux * 3, 1.5, 1.5, [C.night, C.steel, C.pale], 0);
      } else if (work.action === 'cook') {
        put(ctx, x + ux * 7 - 1, y + uy * 7 - 1, C.e4, 3, 2);
      } else {
        limb(
          ctx,
          x + ux * 2 - uy,
          y + uy * 2 + ux,
          x + ux * 6 - uy,
          y + uy * 6 + ux,
          1.3,
          1.3,
          [C.slate, C.steel, C.pale],
          0,
        );
      }
    }
  }
}
