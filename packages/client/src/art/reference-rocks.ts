import catalog from './reference-rocks.json';
import { preparedSprite } from './prepared-sprite';
export type ReferenceRock = keyof typeof catalog.frames;
export const referenceRock = (name: ReferenceRock) => preparedSprite(catalog.frames[name]);
