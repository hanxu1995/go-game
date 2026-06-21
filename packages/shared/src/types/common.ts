export type Coordinates = readonly [number, number];

export type CellState = 0 | 1 | 2;
export const CellStates = Object.freeze({
    Empty: 0,
    Black: 1,
    White: 2,
});

export type Player = 'black' | 'white';

export type GameAction =
    | { type: 'PLAY'; coordinates: Coordinates }
    | { type: 'PASS' };

export interface GameState {
    board: CellState[][];
    currentPlayer: Player;
    lastMove: Coordinates | 'PASS' | null;
    blackCapturedOpponent: number;
    whiteCapturedOpponent: number;
}

export interface GameStatesRecord {
    historicalGameStates: GameState[];
    gameStateToMoves: Record<string, number[]>;
}
