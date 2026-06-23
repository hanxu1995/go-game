import type { Coordinates, Move } from '../types/common.ts';

// SGF point letters: 'a'..'s' map to board indices 0..18.
// A point is "column row", e.g. board [r, c] -> letter(c) + letter(r).
function coordToSgf([r, c]: Coordinates): string {
    const col = String.fromCharCode('a'.charCodeAt(0) + c);
    const row = String.fromCharCode('a'.charCodeAt(0) + r);
    return `${col}${row}`;
}

// Serialise a move log to a minimal but standard SGF (FF[4], GM[1] = Go).
// Any go viewer (Sabaki / EidoGo / 弈客 …) can open it. For 联棋 we can later
// attach who played each move via node comments (C[...]).
// `komi` is in Chinese 子; SGF stores komi in 目 via KM = komi * 2, and
// RU[Chinese] flags the ruleset.
export function toSGF(moves: Move[], boardSize: number, komi: number): string {
    let sgf = `(;FF[4]GM[1]SZ[${boardSize}]RU[Chinese]KM[${komi * 2}]`;
    for (const move of moves) {
        const color = move.player === 'black' ? 'B' : 'W';
        // Empty value = pass in FF[4].
        const point =
            move.action.type === 'PLAY'
                ? coordToSgf(move.action.coordinates)
                : '';
        sgf += `;${color}[${point}]`;
    }
    return `${sgf})`;
}
