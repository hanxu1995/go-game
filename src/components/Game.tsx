import { useCallback, useReducer } from 'react';

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
import { deepCopyGameStatesRecord, logMessage } from '../utils/utils.ts';
import { Board } from './Board';
import './Game.css';

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
checkAndAddNewHistoricalGameState(
    initialGameStatesRecord,
    initialGameState,
    FullKo,
);

function endGame() {
    logMessage('endGame', 'INFO');
}

export function Game() {
    const gameStatesRecordReducer = (
        prevGameStateRecord: GameStatesRecord,
        action: GameAction,
    ): GameStatesRecord => {
        const newGameStateRecord =
            deepCopyGameStatesRecord(prevGameStateRecord);
        const result = transitGameState(newGameStateRecord, action);
        if (result.status === 'INVALID') {
            return prevGameStateRecord;
        }
        if (result.status === 'END') {
            endGame();
            return newGameStateRecord;
        }
        if (result.status === 'OK') {
            return newGameStateRecord;
        }
        if (result.status === 'KO') {
            displayMessage(
                `Repetitions at moves ${result.repetitions.join(', ')}`,
                'error',
                'KO violation',
            );
            return prevGameStateRecord;
        }
        if (result.status === 'FULL_KO') {
            displayMessage(
                `Repetitions at moves ${result.repetitions.join(', ')}`,
                'error',
                'Full KO violation',
            );
            return prevGameStateRecord;
        }
        return prevGameStateRecord;
    };

    const [gameStatesRecord, dispatchGameStatesRecord] = useReducer(
        gameStatesRecordReducer,
        initialGameStatesRecord,
    );

    if (gameStatesRecord.historicalGameStates.length === 0) {
        throw new Error('empty states record');
    }
    const lastGameState = gameStatesRecord.historicalGameStates.at(-1)!;
    // This function handles placing a new stone on the board
    const handleIntersectionClick = useCallback(([row, col]: Coordinates) => {
        // game state transfer
        dispatchGameStatesRecord({ type: 'PLAY', coordinates: [row, col] });
    }, []);

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
