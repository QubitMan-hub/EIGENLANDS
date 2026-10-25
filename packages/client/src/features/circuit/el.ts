import { h as baseH, type Attrs } from '../../ui/dom';

type Child = Parameters<typeof baseH>[2];
export interface XAttrs extends Attrs {
  alt?: string;
  role?: string;
}

/** The shared `h` helper plus `alt` and `role`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: XAttrs = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const { alt, role, ...rest } = attrs;
  const el = baseH(tag, rest, ...kids);
  if (alt !== undefined) el.setAttribute('alt', alt);
  if (role) el.setAttribute('role', role);
  return el;
}
export { clear } from '../../ui/dom';
