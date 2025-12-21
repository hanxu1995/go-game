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

export function deepCopyGameStatesRecord(
    gameStateRecord: GameStatesRecord,
): GameStatesRecord {
    return {
        historicalGameStates: gameStateRecord.historicalGameStates.map(
            (gameState) => deepCopyGameState(gameState),
        ),
        gameStateToMoves: Object.fromEntries(
            Object.entries(gameStateRecord.gameStateToMoves).map(
                ([key, value]) => [key, [...value]],
            ),
        ),
    };
}

export function coordToStr([r, c]: Coordinates): string {
    return JSON.stringify([r, c]);
}

export function gameStateToStr(gameState: GameState): string {
    const { board, currentPlayer } = gameState;
    return JSON.stringify({ board, currentPlayer });
}
