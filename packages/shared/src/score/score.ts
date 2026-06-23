import { type CellState, CellStates } from '../types/common.ts';

export interface ScoreResult {
    blackStones: number;
    whiteStones: number;
    blackTerritory: number;
    whiteTerritory: number;
    dame: number; // neutral points (empty regions touching both colors)
    blackArea: number; // 子: black stones + territory + half the dame
    whiteArea: number; // 子: white stones + territory + half the dame
    komi: number; // 子 (Chinese rules; 1 子 = 2 目)
    winner: 'black' | 'white' | 'draw';
    margin: number; // 子, >= 0 (0 when draw)
}

// Chinese-style area scoring, reported in 子 (stones). ASSUMES every stone on
// the board is alive — no dead-stone removal / life-and-death analysis; players
// should capture dead stones before counting. Empty regions touching only one
// color are that color's territory; neutral regions (dame) are split evenly.
// `komi` is in 子 (1 子 = 2 目) and handicaps Black.
export function computeAreaScore(
    board: CellState[][],
    komi: number,
): ScoreResult {
    const size = board.length;
    const visited: boolean[][] = Array.from({ length: size }, () =>
        new Array<boolean>(size).fill(false),
    );

    let blackStones = 0;
    let whiteStones = 0;
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let dame = 0;

    for (let r = 0; r < size; ++r) {
        for (let c = 0; c < size; ++c) {
            const cell = board[r][c];
            if (cell === CellStates.Black) {
                ++blackStones;
                continue;
            }
            if (cell === CellStates.White) {
                ++whiteStones;
                continue;
            }
            if (visited[r][c]) {
                continue;
            }

            // Flood-fill this empty region, tracking which colors border it.
            let regionSize = 0;
            let bordersBlack = false;
            let bordersWhite = false;
            const stack: Array<[number, number]> = [[r, c]];
            visited[r][c] = true;
            while (stack.length > 0) {
                const [cr, cc] = stack.pop()!;
                ++regionSize;
                const neighbors: Array<[number, number]> = [
                    [cr - 1, cc],
                    [cr + 1, cc],
                    [cr, cc - 1],
                    [cr, cc + 1],
                ];
                for (const [nr, nc] of neighbors) {
                    if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
                        continue;
                    }
                    const ncell = board[nr][nc];
                    if (ncell === CellStates.Black) {
                        bordersBlack = true;
                    } else if (ncell === CellStates.White) {
                        bordersWhite = true;
                    } else if (!visited[nr][nc]) {
                        visited[nr][nc] = true;
                        stack.push([nr, nc]);
                    }
                }
            }

            if (bordersBlack && !bordersWhite) {
                blackTerritory += regionSize;
            } else if (bordersWhite && !bordersBlack) {
                whiteTerritory += regionSize;
            } else {
                dame += regionSize;
            }
        }
    }

    // Neutral points are split evenly between the two sides.
    const blackArea = blackStones + blackTerritory + dame / 2;
    const whiteArea = whiteStones + whiteTerritory + dame / 2;
    // Black's lead over half the board, in 子, after giving komi to White.
    const half = (blackArea + whiteArea) / 2;
    const blackResult = blackArea - half - komi;

    let winner: 'black' | 'white' | 'draw';
    let margin: number;
    if (blackResult > 0) {
        winner = 'black';
        margin = blackResult;
    } else if (blackResult < 0) {
        winner = 'white';
        margin = -blackResult;
    } else {
        winner = 'draw';
        margin = 0;
    }

    return {
        blackStones,
        whiteStones,
        blackTerritory,
        whiteTerritory,
        dame,
        blackArea,
        whiteArea,
        komi,
        winner,
        margin,
    };
}
