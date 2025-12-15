import './Game.css';
import { useCallback, useReducer } from 'react';
import { Board } from './Board';
import { type Coordinates } from './Stone';
import { emitMessage } from '../utils';
import { type CellState, CellStates } from '../types/types.tsx';

const BoardSize = 19;
const CellSizePx = 50;
const FullKo = true;

type Player = 'black' | 'white';
type GameState = {
    board: CellState[][];
    currentPlayer: Player;
    lastMove: Coordinates | 'PASS' | null;
    blackCapturedOpponent: number;
    whiteCapturedOpponent: number;
};
type GameAction = { type: 'PLAY'; coordinates: Coordinates } | { type: 'PASS' };
type GameStatesRecord = {
    historicalGameStates: GameState[];
    gameStateToMoves: Record<string, number[]>;
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
};
checkAndAddNewHistoricalGameState(
    initialGameStatesRecord,
    initialGameState,
    FullKo,
);

function endGame() {
    console.log('endGame');
}

function deepCopyGameState(gameState: GameState): GameState {
    return {
        ...gameState,
        board: gameState.board.map((row) => [...row]),
    };
}

function deepCopyGameStatesRecord(
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

function isWithinBounds([r, c]: Coordinates): boolean {
    return 0 <= r && r < BoardSize && 0 <= c && c < BoardSize;
}

function coordToStr([r, c]: Coordinates): string {
    return JSON.stringify([r, c]);
}

function gameStateToStr(gameState: GameState): string {
    const { board, currentPlayer } = gameState;
    return JSON.stringify({ board, currentPlayer });
}

function getNeighbors([r, c]: Coordinates): Coordinates[] {
    const neighbors: Coordinates[] = [];
    const directions = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
    ];
    for (const [dr, dc] of directions) {
        const newR = r + dr;
        const newC = c + dc;
        if (isWithinBounds([newR, newC])) {
            neighbors.push([newR, newC]);
        }
    }
    return neighbors;
}

function findGroup(
    board: CellState[][],
    [r, c]: Coordinates,
): { stones: Coordinates[]; liberties: number } {
    const stoneColor = board[r][c];
    if (stoneColor === CellStates.Empty) {
        return { stones: [], liberties: 0 };
    }

    const stones: Coordinates[] = [];
    const visited = new Set<string>(); // Use a Set to track visited stones (r,c) strings
    const liberties = new Set<string>(); // Use a Set to track unique liberty coordinates (r,c) strings

    const stack: Coordinates[] = [[r, c]];
    while (stack.length > 0) {
        const [currR, currC] = stack.pop()!;
        const coordStr = coordToStr([currR, currC]);
        visited.add(coordStr);
        stones.push([currR, currC]);

        for (const [nR, nC] of getNeighbors([currR, currC])) {
            const neighborColor = board[nR][nC];
            const neighborStr = coordToStr([nR, nC]);

            if (neighborColor === stoneColor) {
                // Same color, add to the stack for group exploration
                if (!visited.has(neighborStr)) {
                    stack.push([nR, nC]);
                }
            } else if (neighborColor === CellStates.Empty) {
                // Empty spot, add to liberties set
                liberties.add(neighborStr);
            }
            // Opponent color is ignored for group finding and liberty counting
        }
    }
    return { stones, liberties: liberties.size };
}

// Executes the capture and returns the number of captured stones
function captureStones(board: CellState[][], group: Coordinates[]): number {
    for (const [r, c] of group) {
        board[r][c] = CellStates.Empty;
    }
    return group.length;
}

// Main function to check and apply captures after a move is placed
function checkAndApplyCaptures(
    board: CellState[][],
    [r, c]: Coordinates,
): number {
    const playerColor: CellState = board[r][c];
    const opponentColor: CellState =
        playerColor === CellStates.Black ? CellStates.White : CellStates.Black;
    let totalCaptures = 0;

    for (const [nR, nC] of getNeighbors([r, c])) {
        if (board[nR][nC] === opponentColor) {
            const groupInfo = findGroup(board, [nR, nC]);
            if (groupInfo.liberties === 0) {
                // Group is captured!
                totalCaptures += captureStones(board, groupInfo.stones);
            }
        }
    }
    return totalCaptures;
}

function removeLastHistoricalGameState(gameStateRecord: GameStatesRecord) {
    const lastState = gameStateRecord.historicalGameStates.pop();
    if (lastState === undefined) {
        return;
    }
    const stateString = gameStateToStr(lastState);
    if (gameStateRecord.gameStateToMoves[stateString] === undefined) {
        throw new Error('invalid game state');
    }
    gameStateRecord.gameStateToMoves[stateString].pop();
    if (gameStateRecord.gameStateToMoves[stateString].length === 0) {
        delete gameStateRecord.gameStateToMoves[stateString];
    }
}

function checkAndAddNewHistoricalGameState(
    gameStateRecord: GameStatesRecord,
    newGameState: GameState,
    fullKo: boolean,
): {
    status: 'OK' | 'KO' | 'FULL_KO';
    repetitions: number[];
} {
    const stateString = gameStateToStr(newGameState);
    if (gameStateRecord.gameStateToMoves[stateString] !== undefined) {
        if (gameStateRecord.gameStateToMoves[stateString].length === 0) {
            throw new Error('invalid game state: empty moves');
        }
        if (newGameState.lastMove !== 'PASS') {
            if (
                gameStateRecord.gameStateToMoves[stateString].at(-1) ===
                gameStateRecord.historicalGameStates.length - 2
            ) {
                return {
                    status: 'KO',
                    repetitions: gameStateRecord.gameStateToMoves[stateString],
                };
            }
            if (fullKo) {
                return {
                    status: 'FULL_KO',
                    repetitions: gameStateRecord.gameStateToMoves[stateString],
                };
            }
        }
    } else {
        gameStateRecord.gameStateToMoves[stateString] = [];
    }
    gameStateRecord.gameStateToMoves[stateString].push(
        gameStateRecord.historicalGameStates.length,
    );
    gameStateRecord.historicalGameStates.push(newGameState);
    return {
        status: 'OK',
        repetitions: gameStateRecord.gameStateToMoves[stateString],
    };
}

export function Game() {
    const gameStatesRecordReducer = (
        prevGameStateRecord: GameStatesRecord,
        action: GameAction,
    ): GameStatesRecord => {
        if (prevGameStateRecord.historicalGameStates.length === 0) {
            throw new Error('empty states record');
        }
        const newGameStateRecord =
            deepCopyGameStatesRecord(prevGameStateRecord);
        const lastGameState = newGameStateRecord.historicalGameStates.at(-1)!;
        if (action.type === 'PASS') {
            if (lastGameState.lastMove === 'PASS') {
                removeLastHistoricalGameState(newGameStateRecord);
                endGame();
                return newGameStateRecord;
            }
            const newGameState = deepCopyGameState(lastGameState);
            newGameState.lastMove = 'PASS';
            newGameState.currentPlayer =
                newGameState.currentPlayer === 'black' ? 'white' : 'black';
            checkAndAddNewHistoricalGameState(
                newGameStateRecord,
                newGameState,
                FullKo,
            );
            return newGameStateRecord;
        }
        if (action.type === 'PLAY') {
            const [r, c] = action.coordinates;
            if (lastGameState.board[r][c] !== CellStates.Empty) {
                emitMessage('Spot occupied (internal error)', 'INFO');
                return prevGameStateRecord;
            }

            const newGameState = deepCopyGameState(lastGameState);
            newGameState.board = lastGameState.board.map((row) => [...row]);
            // Place the stone on the temporary board copy
            newGameState.board[r][c] =
                lastGameState.currentPlayer === 'black'
                    ? CellStates.Black
                    : CellStates.White;

            // Check and apply opponent captures
            const numCaptured = checkAndApplyCaptures(newGameState.board, [
                r,
                c,
            ]);

            // Check for Suicide: If the newly placed group has 0 liberties after captures, it's illegal.
            const newGroupInfo = findGroup(newGameState.board, [r, c]);
            if (newGroupInfo.liberties === 0) {
                emitMessage('Illegal move: Suicide is not allowed.', 'INFO');
                return prevGameStateRecord; // Discard the move and return previous state
            }

            // Check for Ko and add historical state
            if (lastGameState.currentPlayer === 'black') {
                newGameState.currentPlayer = 'white';
                newGameState.blackCapturedOpponent += numCaptured;
            } else {
                newGameState.currentPlayer = 'black';
                newGameState.whiteCapturedOpponent += numCaptured;
            }
            newGameState.lastMove = [r, c];
            const { status, repetitions } = checkAndAddNewHistoricalGameState(
                newGameStateRecord,
                newGameState,
                FullKo,
            );
            if (status === 'KO') {
                emitMessage(`KO: ${repetitions}`, 'INFO');
                return prevGameStateRecord;
            }
            if (status === 'FULL_KO') {
                emitMessage(`FULL_KO: ${repetitions}`, 'INFO');
            }
            return newGameStateRecord;
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
    const handleIntersectionClick = useCallback(
        ([row, col]: Coordinates) => {
            // range check
            if (!isWithinBounds([row, col])) {
                emitMessage(`(${row},${col}) out of bounds.`, 'ERROR');
                return;
            }

            // Check if the intersection is already occupied
            if (lastGameState.board[row][col] !== CellStates.Empty) {
                emitMessage(
                    `Intersection (${row},${col}) is already occupied.`,
                    'INFO',
                );
                return;
            }

            // game state transfer
            dispatchGameStatesRecord({ type: 'PLAY', coordinates: [row, col] });
        },
        [lastGameState.board],
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
