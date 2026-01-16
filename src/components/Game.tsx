import { useCallback, useState } from 'react';

import {
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

const CellSizePx = 50;
const Dots: Coordinates[] = [
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
export const BoardSize = 19;
export const FullKo = true;

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

export function Game() {
    const [gameStatesRecord, setGameStatesRecord] = useState(
        initialGameStatesRecord,
    );
    const endGame = useCallback(() => {
        displayMessage('Game ended', 'info', 'Game Over');
    }, []);
    const applyAction = useCallback(
        (action: GameAction) => {
            const newGameStateRecord =
                deepCopyGameStatesRecord(gameStatesRecord);
            const result = transitGameState(newGameStateRecord, action);
            if (result.status === 'INVALID') {
                return;
            }
            if (result.status === 'END') {
                endGame();
                setGameStatesRecord(newGameStateRecord);
                return;
            }
            if (result.status === 'OK') {
                setGameStatesRecord(newGameStateRecord);
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
        [endGame, gameStatesRecord],
    );

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
                dots={Dots}
                boardState={lastGameState.board}
                onIntersectionClick={handleIntersectionClick}
            />
        </div>
    );
}
