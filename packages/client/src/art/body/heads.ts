/**
 * Heads of the two base bodies, one per direction, traced from the reference sheets
 * (assets/reference/characters/base-*-walk.webp) at the game's scale by tools/bodies/extract.py and then cleaned by
 * hand: the reference's skin shading and silhouette are kept, and the eyes, brows and mouth are placed consistently.
 *
 * Rows run crown to chin (8 rows). Roles: '.' empty, '1'..'4' skin dark..light, 'e' eye (iris), 'b' brow (hair
 * colour), 'm' mouth. Directions: S, SW, W, NW, N, NE, E, SE (body/skeleton.ts maps the game's DIR_* onto these).
 * `cx` is the column of the skull's centre line (sits on the spine).
 */
export interface HeadMap {
  rows: readonly string[];
  cx: number;
}

const male: HeadMap[] = [
  // S
  { cx: 3.5, rows: ['..1111..', '.144441.', '.2444431', '.2444441', '12b44b31', '13e44e32', '.224m231', '..1441..'] },
  // SW
  { cx: 3.5, rows: ['..111...', '.34443..', '1444442.', '2444443.', '2b44b43.', '1e44e41.', '12m4431.', '.13431..'] },
  // W
  { cx: 4, rows: ['..1111..', '.144443.', '1444444.', '1444443.', '1b44443.', '1e44442.', '2444431.', '.2443...'] },
  // NW
  { cx: 3.5, rows: ['..1111..', '.134421.', '13444441', '14444441', '14444431', '24444431', '.244431.', '..2441..'] },
  // N
  { cx: 3.5, rows: ['..1111..', '.144441.', '.2444441', '.2444441', '13444441', '13444431', '.1344421', '..1441..'] },
  // NE
  { cx: 3.5, rows: ['..1111..', '.124431.', '13444441', '13444441', '13444441', '13444442', '.134442.', '..1442..'] },
  // E
  { cx: 3, rows: ['..1111..', '.144442.', '.4444441', '.3444441', '.34444b1', '.24444e1', '.1344442', '...3442.'] },
  // SE
  { cx: 4, rows: ['...111..', '..34443.', '.2444441', '.3444442', '.4b44b42', '.1e44e41', '.1344m21', '..14431.'] },
];

/** the women's heads: the same skulls with a finer jaw and a narrower chin */
const female: HeadMap[] = [
  { cx: 3.5, rows: ['..1111..', '.144441.', '.2444431', '.2444441', '12b44b31', '13e44e32', '.124m21.', '..1441..'] },
  { cx: 3.5, rows: ['..111...', '.34443..', '1444442.', '2444443.', '2b44b43.', '1e44e41.', '.2m4431.', '..1431..'] },
  { cx: 4, rows: ['..1111..', '.144443.', '1444444.', '1444443.', '1b44443.', '1e44442.', '.244431.', '..243...'] },
  { cx: 3.5, rows: ['..1111..', '.134421.', '13444441', '14444441', '14444431', '24444431', '.244431.', '..2441..'] },
  { cx: 3.5, rows: ['..1111..', '.144441.', '.2444441', '.2444441', '13444441', '13444431', '.1344421', '..1441..'] },
  { cx: 3.5, rows: ['..1111..', '.124431.', '13444441', '13444441', '13444441', '13444442', '.134442.', '..1442..'] },
  { cx: 3, rows: ['..1111..', '.144442.', '.4444441', '.3444441', '.34444b1', '.24444e1', '.134444.', '...344..'] },
  { cx: 4, rows: ['...111..', '..34443.', '.2444441', '.3444442', '.4b44b42', '.1e44e41', '..344m2.', '...4431.'] },
];

export const HEADS: Record<'male' | 'female', HeadMap[]> = { male, female };
/** head height in rows (crown to chin) */
export const HEAD_H = 8;
