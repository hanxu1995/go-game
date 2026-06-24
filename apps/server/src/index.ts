import {
    CellStates,
    type ClientToServerEvents,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    type RoomState,
    type Seat,
    type ServerToClientEvents,
    checkAndAddNewHistoricalGameState,
    cloneGameStatesRecord,
    transitGameState,
} from '@go-game/shared';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const BOARD_SIZE = 19;
const FULL_KO = true;
const ROOM = 'default';
const PORT = Number(process.env.PORT ?? 3001);

function createInitialRecord(size: number): GameStatesRecord {
    const initial: GameState = {
        board: Array.from({ length: size }, () =>
            new Array(size).fill(CellStates.Empty),
        ),
        currentPlayer: 'black',
        lastMove: null,
        blackCapturedOpponent: 0,
        whiteCapturedOpponent: 0,
    };
    const record: GameStatesRecord = {
        historicalGameStates: [],
        gameStateToMoves: {},
        moves: [],
    };
    checkAndAddNewHistoricalGameState(record, initial, FULL_KO);
    return record;
}

// Single hard-coded room (step 1). The authoritative game state lives here.
const room = {
    record: createInitialRecord(BOARD_SIZE),
    gameOver: false,
    seats: { black: null as string | null, white: null as string | null },
};

function toRoomState(): RoomState {
    const state = room.record.historicalGameStates.at(-1)!;
    return {
        board: state.board,
        currentPlayer: state.currentPlayer,
        blackCapturedOpponent: state.blackCapturedOpponent,
        whiteCapturedOpponent: state.whiteCapturedOpponent,
        moveCount: room.record.moves.length,
        lastMove: state.lastMove,
        gameOver: room.gameOver,
    };
}

function assignSeat(id: string): Seat {
    if (room.seats.black === null) {
        room.seats.black = id;
        return 'black';
    }
    if (room.seats.white === null) {
        room.seats.white = id;
        return 'white';
    }
    return 'spectator';
}

function releaseSeat(id: string): void {
    if (room.seats.black === id) {
        room.seats.black = null;
    } else if (room.seats.white === id) {
        room.seats.white = null;
    }
}

// Validate + apply against the authoritative record. Returns whether it stuck.
function applyAuthoritative(action: GameAction): 'applied' | 'rejected' {
    if (room.gameOver) {
        return 'rejected';
    }
    const next = cloneGameStatesRecord(room.record);
    const result = transitGameState(next, action, FULL_KO);
    if (result.status === 'OK' || result.status === 'END') {
        room.record = next;
        if (result.status === 'END') {
            room.gameOver = true;
        }
        return 'applied';
    }
    // INVALID / KO / FULL_KO
    return 'rejected';
}

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
});

io.on('connection', (socket) => {
    const seat = assignSeat(socket.id);
    socket.join(ROOM);
    socket.emit('seat', seat);
    socket.emit('state', toRoomState());

    const handle = (action: GameAction): void => {
        if (seat === 'spectator') {
            socket.emit('rejected', '观战者不能落子');
            return;
        }
        const turn = room.record.historicalGameStates.at(-1)!.currentPlayer;
        if (seat !== turn) {
            socket.emit('rejected', '还没轮到你');
            return;
        }
        if (applyAuthoritative(action) === 'rejected') {
            socket.emit('rejected', '非法手');
            return;
        }
        io.to(ROOM).emit('state', toRoomState());
    };

    socket.on('play', (coordinates) => {
        handle({ type: 'PLAY', coordinates });
    });
    socket.on('pass', () => {
        handle({ type: 'PASS' });
    });
    socket.on('disconnect', () => {
        releaseSeat(socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`go-game server listening on :${PORT}`);
});
