import { useCallback, useMemo, useState } from 'react';

import { BoardSize, CellSizePx, Dots, FullKo } from '../config.ts';
import { downloadTextFile } from '../utils/download.ts';
import { displayMessage } from '../utils/message.ts';
import { Board } from './Board';
import './Game.css';
import {
    CellStates,
    type Coordinates,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    buildMoveNumberBoard,
    checkAndAddNewHistoricalGameState,
    cloneGameStatesRecord,
    toSGF,
    transitGameState,
} from '@go-game/shared';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

type MoveNumberMode = 'none' | 'all' | 'last10';

const LAST_N = 10;
const MOVE_NUMBER_MODE_ORDER: MoveNumberMode[] = ['none', 'all', 'last10'];
const MOVE_NUMBER_MODE_LABEL: Record<MoveNumberMode, string> = {
    none: '手顺：关',
    all: '手顺：全部',
    last10: `手顺：最后${LAST_N}手`,
};

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
    moves: [],
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
    const [moveNumberMode, setMoveNumberMode] =
        useState<MoveNumberMode>('none');
    const [showCoordinates, setShowCoordinates] = useState(true);

    const endGame = useCallback(() => {
        displayMessage('Game ended', 'info', 'Game Over');
    }, []);
    const applyAction = useCallback(
        (action: GameAction) => {
            const newGameStateRecord = cloneGameStatesRecord(gameStatesRecord);
            const result = transitGameState(newGameStateRecord, action, FullKo);
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

    const cycleMoveNumberMode = useCallback(() => {
        setMoveNumberMode((mode) => {
            const nextIndex =
                (MOVE_NUMBER_MODE_ORDER.indexOf(mode) + 1) %
                MOVE_NUMBER_MODE_ORDER.length;
            return MOVE_NUMBER_MODE_ORDER[nextIndex];
        });
    }, []);

    const handleDownloadSgf = useCallback(() => {
        downloadTextFile('game.sgf', toSGF(gameStatesRecord.moves, BoardSize));
    }, [gameStatesRecord]);

    // Move number painted on each stone (0 = empty / no stone there).
    const moveNumberBoard = useMemo(
        () => buildMoveNumberBoard(gameStatesRecord.historicalGameStates),
        [gameStatesRecord],
    );
    const totalMoves = gameStatesRecord.moves.length;
    const minVisibleMoveNumber =
        moveNumberMode === 'none'
            ? Number.POSITIVE_INFINITY
            : moveNumberMode === 'last10'
              ? totalMoves - LAST_N + 1
              : 1;

    return (
        <div className="game">
            <h1>围棋-严格禁全同</h1>
            <p>{`${lastGameState.currentPlayer === 'black' ? '黑' : '白'}方行棋`}</p>
            <p>
                黑方提子：{lastGameState.blackCapturedOpponent}
                &nbsp;&nbsp;&nbsp;白方提子：
                {lastGameState.whiteCapturedOpponent}
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <FormControlLabel
                    control={
                        <Switch
                            checked={showCoordinates}
                            onChange={(_event, checked) =>
                                setShowCoordinates(checked)
                            }
                        />
                    }
                    label="坐标"
                />
                <Button variant="outlined" onClick={cycleMoveNumberMode}>
                    {MOVE_NUMBER_MODE_LABEL[moveNumberMode]}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleDownloadSgf}
                    disabled={totalMoves === 0}
                >
                    下载棋谱
                </Button>
            </div>

            <Board
                cellSizePx={CellSizePx}
                boardSize={BoardSize}
                dots={Dots}
                boardState={lastGameState.board}
                moveNumberBoard={moveNumberBoard}
                minVisibleMoveNumber={minVisibleMoveNumber}
                showCoordinates={showCoordinates}
                onIntersectionClick={handleIntersectionClick}
            />
        </div>
    );
}
