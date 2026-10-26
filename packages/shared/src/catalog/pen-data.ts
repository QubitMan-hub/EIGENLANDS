/** Animal shelters: which animal lives in which, and what it gives. Pure data read by objects.ts and the farm catalog. */
export interface PenData {
  sub: string;
  name: string;
  animal: string;
  animalName: string;
  product: string;
  productName: string;
  max: number;
}
export const PEN_DATA: PenData[] = [
  {
    sub: 'sheepfold',
    name: 'Sheepfold',
    animal: 'sheep',
    animalName: 'Sheep',
    product: 'wool',
    productName: 'wool',
    max: 4,
  },
  {
    sub: 'goat_shed',
    name: 'Goat Shed',
    animal: 'goat',
    animalName: 'Goat',
    product: 'goat_milk',
    productName: 'goat milk',
    max: 4,
  },
  {
    sub: 'pig_pen',
    name: 'Pig Pen',
    animal: 'pig',
    animalName: 'Pig',
    product: 'truffle',
    productName: 'truffles',
    max: 4,
  },
  {
    sub: 'apiary',
    name: 'Apiary',
    animal: 'bee_colony',
    animalName: 'Bee Colony',
    product: 'honey',
    productName: 'honey',
    max: 4,
  },
];
