export type MoveNumberMode = 'none' | 'all' | 'last10';

const LAST_N = 10;
const ORDER: MoveNumberMode[] = ['none', 'all', 'last10'];

export const MOVE_NUMBER_MODE_LABEL: Record<MoveNumberMode, string> = {
    none: '手顺：关',
    all: '手顺：全部',
    last10: `手顺：最后${LAST_N}手`,
};

export function nextMoveNumberMode(mode: MoveNumberMode): MoveNumberMode {
    return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
}

// Stones whose move number is >= the threshold get painted (Infinity = hide all).
export function minVisibleMoveNumber(
    mode: MoveNumberMode,
    totalMoves: number,
): number {
    if (mode === 'none') {
        return Number.POSITIVE_INFINITY;
    }
    if (mode === 'last10') {
        return totalMoves - LAST_N + 1;
    }
    return 1;
}
