import {
    type CellState,
    CellStates,
    type Coordinates,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    type Player,
} from '../types/common.ts';
import {
    coordToStr,
    deepCopyGameState,
    gameStateToStr,
    logMessage,
} from '../utils/utils.ts';

export function isWithinBounds(
    [r, c]: Coordinates,
    boardSize: number,
): boolean {
    return 0 <= r && r < boardSize && 0 <= c && c < boardSize;
}

function getNeighbors([r, c]: Coordinates, boardSize: number): Coordinates[] {
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
        if (isWithinBounds([newR, newC], boardSize)) {
            neighbors.push([newR, newC]);
        }
    }
    return neighbors;
}

function findGroup(
    board: CellState[][],
    [r, c]: Coordinates,
): { stones: Coordinates[]; liberties: Coordinates[] } {
    const boardSize = board.length;
    if (!isWithinBounds([r, c], boardSize)) {
        return { stones: [], liberties: [] };
    }

    const stoneColor = board[r][c];
    if (stoneColor === CellStates.Empty) {
        return { stones: [], liberties: [] };
    }

    const stones: Coordinates[] = [];
    const liberties: Coordinates[] = [];
    const visited = new Set<string>(); // Use a Set to track visited stones (r,c) strings

    const stack: Coordinates[] = [[r, c]];
    visited.add(coordToStr([r, c]));
    while (stack.length > 0) {
        const [currR, currC] = stack.pop()!;
        stones.push([currR, currC]);

        const neighbors = getNeighbors([currR, currC], boardSize);
        for (const [nR, nC] of neighbors) {
            const neighborColor = board[nR][nC];
            const neighborStr = coordToStr([nR, nC]);

            if (visited.has(neighborStr)) {
                continue;
            }
            if (neighborColor === CellStates.Empty) {
                // Empty spot, add to liberties set
                liberties.push([nR, nC]);
                visited.add(neighborStr);
            } else if (neighborColor === stoneColor) {
                // Same color, add to the stack for group exploration
                stack.push([nR, nC]);
                visited.add(neighborStr);
            }
            // Opponent color is ignored for group finding and liberty counting
        }
    }
    return { stones, liberties: liberties };
}

// Main function to check and apply captures after a move is placed
function checkAndApplyCaptures(
    board: CellState[][],
    [r, c]: Coordinates,
): number {
    const boardSize = board.length;
    if (!isWithinBounds([r, c], boardSize)) {
        return 0;
    }
    const playerColor: CellState = board[r][c];
    if (playerColor === CellStates.Empty) {
        return 0; // No stone placed, no captures possible
    }
    const opponentColor: CellState =
        playerColor === CellStates.Black ? CellStates.White : CellStates.Black;
    let totalCaptures = 0;

    const neighbors = getNeighbors([r, c], boardSize);
    for (const [nR, nC] of neighbors) {
        if (board[nR][nC] !== opponentColor) {
            continue;
        }
        const groupInfo = findGroup(board, [nR, nC]);
        if (groupInfo.liberties.length === 0) {
            // Group is captured!
            for (const [r, c] of groupInfo.stones) {
                board[r][c] = CellStates.Empty;
                ++totalCaptures;
            }
        }
    }
    return totalCaptures;
}

function transitGameStateIgnoreKo(
    gameState: GameState,
    [r, c]: Coordinates,
    player: Player,
): boolean {
    const boardSize = gameState.board.length;
    if (!isWithinBounds([r, c], boardSize)) {
        logMessage(`Spot (${r},${c}) is out of bounds.`, 'INFO');
        return false;
    }
    if (gameState.board[r][c] !== CellStates.Empty) {
        logMessage(`Spot (${r},${c}) is occupied.`, 'INFO');
        return false;
    }

    // Place the stone on the temporary board
    gameState.board[r][c] =
        player === 'black' ? CellStates.Black : CellStates.White;

    // Check and apply opponent captures
    const numCaptured = checkAndApplyCaptures(gameState.board, [r, c]);

    // Check for Suicide: If the newly placed group has 0 liberties after captures, it's illegal.
    const newGroupInfo = findGroup(gameState.board, [r, c]);
    if (newGroupInfo.liberties.length === 0) {
        logMessage('Illegal move: Suicide is not allowed.', 'INFO');
        gameState.board[r][c] = CellStates.Empty; // Discard the move
        return false;
    }

    // Transit state
    if (player === 'black') {
        gameState.currentPlayer = 'white';
        gameState.blackCapturedOpponent += numCaptured;
    } else {
        gameState.currentPlayer = 'black';
        gameState.whiteCapturedOpponent += numCaptured;
    }
    gameState.lastMove = [r, c];
    return true;
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
    // Keep the move log aligned 1:1 with historicalGameStates.
    gameStateRecord.moves.pop();
}

export function checkAndAddNewHistoricalGameState(
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

export function transitGameState(
    gameStateRecord: GameStatesRecord,
    action: GameAction,
    fullKo: boolean,
):
    | { status: 'END' | 'INVALID' }
    | { status: 'OK' | 'KO' | 'FULL_KO'; repetitions: number[] } {
    if (gameStateRecord.historicalGameStates.length === 0) {
        throw new Error('empty states record');
    }
    const lastGameState = gameStateRecord.historicalGameStates.at(-1)!;
    const mover = lastGameState.currentPlayer;
    const newGameState = deepCopyGameState(lastGameState);
    if (action.type === 'PASS') {
        if (lastGameState.lastMove === 'PASS') {
            removeLastHistoricalGameState(gameStateRecord);
            return { status: 'END' };
        }

        newGameState.lastMove = 'PASS';
        newGameState.currentPlayer =
            newGameState.currentPlayer === 'black' ? 'white' : 'black';
        const { status, repetitions } = checkAndAddNewHistoricalGameState(
            gameStateRecord,
            newGameState,
            fullKo,
        );
        if (status !== 'OK') {
            throw new Error('unexpected status on PASS');
        }
        gameStateRecord.moves.push({ player: mover, action });
        return { status, repetitions };
    }
    if (action.type === 'PLAY') {
        const [r, c] = action.coordinates;
        const valid = transitGameStateIgnoreKo(
            newGameState,
            [r, c],
            newGameState.currentPlayer,
        );
        if (!valid) {
            return { status: 'INVALID' };
        }

        const { status, repetitions } = checkAndAddNewHistoricalGameState(
            gameStateRecord,
            newGameState,
            fullKo,
        );
        if (status === 'OK') {
            gameStateRecord.moves.push({ player: mover, action });
        }
        return { status, repetitions };
    }
    return { status: 'INVALID' };
}

// Returns a grid where each cell holds the move number (1-based, aligned with
// the move log) of the stone currently sitting there, or 0 when empty.
// Derived purely from board snapshots — no capture logic is duplicated.
export function buildMoveNumberBoard(
    historicalGameStates: GameState[],
): number[][] {
    const lastState = historicalGameStates.at(-1)!;
    const boardSize = lastState.board.length;
    const moveNumbers: number[][] = Array.from({ length: boardSize }, () =>
        new Array<number>(boardSize).fill(0),
    );
    for (let i = 1; i < historicalGameStates.length; ++i) {
        const prevBoard = historicalGameStates[i - 1].board;
        const currBoard = historicalGameStates[i].board;
        for (let r = 0; r < boardSize; ++r) {
            for (let c = 0; c < boardSize; ++c) {
                if (
                    prevBoard[r][c] === CellStates.Empty &&
                    currBoard[r][c] !== CellStates.Empty
                ) {
                    moveNumbers[r][c] = i;
                } else if (
                    prevBoard[r][c] !== CellStates.Empty &&
                    currBoard[r][c] === CellStates.Empty
                ) {
                    moveNumbers[r][c] = 0;
                }
            }
        }
    }
    return moveNumbers;
}
