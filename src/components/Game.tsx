import { useCallback } from 'react';

import {
    BoardSize,
    FullKo,
    checkAndAddNewHistoricalGameState,
    transitGameState,
} from '../game/game.ts';
import {
    CellStates,
    type Coordinates,
    type GameAction,
    type GameState,
    type GameStatesRecord,
} from '../types/common.ts';
import { displayMessage } from '../utils/message.ts';
import { deepCopyGameStatesRecord } from '../utils/utils.ts';
import { Board } from './Board';
import './Game.css';
import { create } from 'zustand';

const CellSizePx = 50;

const initialGameState: GameState = {
    board: Array.from({ length: BoardSize }, () =>
        new Array(BoardSize).fill(CellStates.Empty),
    ),
    currentPlayer: 'black',
    lastMove: null,
    blackCapturedOpponent: 0,
    whiteCapturedOpponent: 0,
};
const initialGameStatesRecord: GameStatesRecord = {
    historicalGameStates: [],
    gameStateToMoves: {},
};
const initialResult = checkAndAddNewHistoricalGameState(
    initialGameStatesRecord,
    initialGameState,
    FullKo,
);
if (initialResult.status !== 'OK') {
    throw new Error('failed to initialize game states record');
}

interface GameComponentState {
    gameStatesRecord: GameStatesRecord;
    endGame: () => void;
    applyAction: (action: GameAction) => void;
}

const useGameStore = create<GameComponentState>((set, get) => ({
    gameStatesRecord: initialGameStatesRecord,
    endGame: () => {
        displayMessage('Game ended', 'info', 'Game Over');
    },
    applyAction: (action: GameAction) => {
        const { gameStatesRecord, endGame } = get();
        const newGameStateRecord = deepCopyGameStatesRecord(gameStatesRecord);
        const result = transitGameState(newGameStateRecord, action);
        if (result.status === 'INVALID') {
            return;
        }
        if (result.status === 'END') {
            endGame();
            set({ gameStatesRecord: newGameStateRecord });
            return;
        }
        if (result.status === 'OK') {
            set({ gameStatesRecord: newGameStateRecord });
            return;
        }
        if (result.status === 'KO') {
            displayMessage(
                `Repetitions at moves ${result.repetitions.join(', ')}`,
                'error',
                'KO violation',
            );
            return;
        }
        if (result.status === 'FULL_KO') {
            displayMessage(
                `Repetitions at moves ${result.repetitions.join(', ')}`,
                'error',
                'Full KO violation',
            );
            return;
        }
        return;
    },
}));

export function Game() {
    const gameStatesRecord = useGameStore((state) => state.gameStatesRecord);
    const applyAction = useGameStore((state) => state.applyAction);

    if (gameStatesRecord.historicalGameStates.length === 0) {
        throw new Error('empty states record');
    }
    const lastGameState = gameStatesRecord.historicalGameStates.at(-1)!;
    // This function handles placing a new stone on the board
    const handleIntersectionClick = useCallback(
        ([row, col]: Coordinates) => {
            // game state transfer
            applyAction({ type: 'PLAY', coordinates: [row, col] });
        },
        [applyAction],
    );

    return (
        <div className="game">
            <h1>围棋-严格禁全同</h1>
            <p>{`${lastGameState.currentPlayer === 'black' ? '黑' : '白'}方行棋`}</p>
            <p>
                黑方提子：{lastGameState.blackCapturedOpponent}
                &nbsp;&nbsp;&nbsp;白方提子：
                {lastGameState.whiteCapturedOpponent}
            </p>

            <Board
                cellSizePx={CellSizePx}
                boardSize={BoardSize}
                boardState={lastGameState.board}
                onIntersectionClick={handleIntersectionClick}
            />
        </div>
    );
}
