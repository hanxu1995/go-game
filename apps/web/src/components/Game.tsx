import { useCallback, useMemo, useState } from 'react';

import { BoardSize, CellSizePx, DefaultKomi, Dots, FullKo } from '../config.ts';
import { downloadTextFile } from '../utils/download.ts';
import { displayMessage } from '../utils/message.ts';
import {
    MOVE_NUMBER_MODE_LABEL,
    type MoveNumberMode,
    minVisibleMoveNumber,
    nextMoveNumberMode,
} from '../utils/moveNumbers.ts';
import { Board } from './Board';
import './Game.css';
import { ScoreBanner } from './ScoreBanner.tsx';
import {
    CellStates,
    type Coordinates,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    type ScoreResult,
    buildMoveNumberBoard,
    checkAndAddNewHistoricalGameState,
    cloneGameStatesRecord,
    computeAreaScore,
    toSGF,
    transitGameState,
} from '@go-game/shared';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';

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
    const [score, setScore] = useState<ScoreResult | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [komi, setKomi] = useState(DefaultKomi);

    const applyAction = useCallback(
        (action: GameAction) => {
            const newGameStateRecord = cloneGameStatesRecord(gameStatesRecord);
            const result = transitGameState(newGameStateRecord, action, FullKo);
            if (result.status === 'INVALID') {
                return;
            }
            if (result.status === 'END') {
                // Both players passed: score the final position (area scoring).
                const finalBoard =
                    newGameStateRecord.historicalGameStates.at(-1)!.board;
                setGameStatesRecord(newGameStateRecord);
                setScore(computeAreaScore(finalBoard, komi));
                setGameOver(true);
                return;
            }
            if (result.status === 'OK') {
                // A new move resumes play and invalidates any shown score.
                setGameStatesRecord(newGameStateRecord);
                setScore(null);
                setGameOver(false);
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
        [gameStatesRecord, komi],
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

    const handlePass = useCallback(() => {
        applyAction({ type: 'PASS' });
    }, [applyAction]);

    // On-demand counting of the current position (does not end the game).
    const handleScore = useCallback(() => {
        setScore(computeAreaScore(lastGameState.board, komi));
        setGameOver(false);
    }, [lastGameState, komi]);

    const cycleMoveNumberMode = useCallback(() => {
        setMoveNumberMode(nextMoveNumberMode);
    }, []);

    const handleDownloadSgf = useCallback(() => {
        downloadTextFile(
            'game.sgf',
            toSGF(gameStatesRecord.moves, BoardSize, komi),
        );
    }, [gameStatesRecord, komi]);

    // Move number painted on each stone (0 = empty / no stone there).
    const moveNumberBoard = useMemo(
        () => buildMoveNumberBoard(gameStatesRecord.historicalGameStates),
        [gameStatesRecord],
    );
    const totalMoves = gameStatesRecord.moves.length;
    const minVisible = minVisibleMoveNumber(moveNumberMode, totalMoves);

    return (
        <div className="game">
            <h1>围棋-严格禁全同</h1>
            <p>
                {gameOver
                    ? '对局结束'
                    : `${lastGameState.currentPlayer === 'black' ? '黑' : '白'}方行棋`}
            </p>
            <p>
                黑方提子：{lastGameState.blackCapturedOpponent}
                &nbsp;&nbsp;&nbsp;白方提子：
                {lastGameState.whiteCapturedOpponent}
            </p>

            {score && <ScoreBanner score={score} gameOver={gameOver} />}

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <Button variant="contained" onClick={handlePass}>
                    停一手
                </Button>
                <Button variant="outlined" onClick={handleScore}>
                    数子
                </Button>
                <TextField
                    label="贴目(子)"
                    type="number"
                    size="small"
                    value={komi}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) {
                            setKomi(v);
                        }
                    }}
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { step: 0.25, min: 0 } }}
                />
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
                minVisibleMoveNumber={minVisible}
                showCoordinates={showCoordinates}
                onIntersectionClick={handleIntersectionClick}
            />
        </div>
    );
}
