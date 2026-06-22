import type {
    Coordinates,
    GameState,
    GameStatesRecord,
} from '../types/common.ts';

export function logMessage(message: string, level: 'ERROR' | 'INFO') {
    if (level === 'ERROR') {
        console.error(message);
    } else {
        console.log(message);
    }
}

export function deepCopyGameState(gameState: GameState): GameState {
    return {
        ...gameState,
        board: gameState.board.map((row) => [...row]),
    };
}

// Returns a record the engine can advance without touching the original (needed
// for React immutability). Historical game states are immutable once recorded —
// the engine only appends a freshly-built state or pops the last one, never
// mutates an existing state — so we SHARE them by reference instead of deep
// copying every board. Only the mutable containers (the arrays and the ko map's
// per-position lists, which the engine pushes/pops) get fresh copies.
export function cloneGameStatesRecord(
    gameStateRecord: GameStatesRecord,
): GameStatesRecord {
    return {
        historicalGameStates: [...gameStateRecord.historicalGameStates],
        gameStateToMoves: Object.fromEntries(
            Object.entries(gameStateRecord.gameStateToMoves).map(
                ([key, value]) => [key, [...value]],
            ),
        ),
        moves: [...gameStateRecord.moves],
    };
}

export function coordToStr([r, c]: Coordinates): string {
    return JSON.stringify([r, c]);
}

export function gameStateToStr(gameState: GameState): string {
    const { board, currentPlayer } = gameState;
    return JSON.stringify({ board, currentPlayer });
}
