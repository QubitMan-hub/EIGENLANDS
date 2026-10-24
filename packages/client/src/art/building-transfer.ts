import type { BuildingArt, WallPiece } from './buildings';
export type PackedBuildingArt=Omit<BuildingArt,'walls'|'roof'|'shadow'|'sign'>&{
 walls:Array<Omit<WallPiece,'day'|'night'|'cut'>&{day:ImageBitmap;night:ImageBitmap;cut:ImageBitmap|null}>;
 roof:{tex:ImageBitmap;night:ImageBitmap|null;x:number;y:number};
 shadow:{tex:ImageBitmap;x:number;y:number};
 sign:{tex:ImageBitmap;x:number;y:number;tx:number;ty:number}|null;
};
