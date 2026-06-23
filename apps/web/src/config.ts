import type { Coordinates } from '@go-game/shared';

export const BoardSize = 19;
export const FullKo = true;
// 中国规则贴目，单位"子"（1 子 = 2 目，3.75 子 = 7.5 目）。
export const DefaultKomi = 3.75;
export const CellSizePx = 50;
export const Dots: Coordinates[] = [
    [3, 3],
    [3, 9],
    [3, 15],
    [9, 3],
    [9, 9],
    [9, 15],
    [15, 3],
    [15, 9],
    [15, 15],
];
