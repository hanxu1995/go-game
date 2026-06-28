import {
    CellStates,
    type ClientToServerEvents,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    type RoomState,
    type RoomSummary,
    type Seat,
    type ServerToClientEvents,
    checkAndAddNewHistoricalGameState,
    cloneGameStatesRecord,
    transitGameState,
} from '@go-game/shared';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

const BOARD_SIZE = 19;
const FULL_KO = true;
const LOBBY = 'lobby';
const PORT = Number(process.env.PORT ?? 3001);
// How long a disconnected player keeps their seat before it's released.
const GRACE_MS = Number(process.env.GRACE_MS ?? 60_000);

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Room {
    id: string;
    record: GameStatesRecord;
    gameOver: boolean;
    seats: { black: string | null; white: string | null }; // playerId
    connections: Map<string, Set<string>>; // playerId -> live socket ids
    disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const rooms = new Map<string, Room>();
const playerRoom = new Map<string, string>(); // playerId -> roomId (kept during grace)
let roomCounter = 0;

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

function makeRoom(): Room {
    roomCounter += 1;
    const room: Room = {
        id: `room-${roomCounter}`,
        record: createInitialRecord(BOARD_SIZE),
        gameOver: false,
        seats: { black: null, white: null },
        connections: new Map(),
        disconnectTimers: new Map(),
    };
    rooms.set(room.id, room);
    return room;
}

function isConnected(room: Room, playerId: string | null): boolean {
    return playerId !== null && (room.connections.get(playerId)?.size ?? 0) > 0;
}

function toRoomState(room: Room): RoomState {
    const state = room.record.historicalGameStates.at(-1)!;
    return {
        board: state.board,
        currentPlayer: state.currentPlayer,
        blackCapturedOpponent: state.blackCapturedOpponent,
        whiteCapturedOpponent: state.whiteCapturedOpponent,
        moveCount: room.record.moves.length,
        lastMove: state.lastMove,
        gameOver: room.gameOver,
        blackConnected: isConnected(room, room.seats.black),
        whiteConnected: isConnected(room, room.seats.white),
    };
}

function roomSummary(room: Room): RoomSummary {
    return {
        id: room.id,
        players: (room.seats.black ? 1 : 0) + (room.seats.white ? 1 : 0),
        gameOver: room.gameOver,
        moveCount: room.record.moves.length,
    };
}

function listRooms(): RoomSummary[] {
    return [...rooms.values()].map(roomSummary);
}

function seatOf(room: Room, playerId: string): Seat {
    if (room.seats.black === playerId) {
        return 'black';
    }
    if (room.seats.white === playerId) {
        return 'white';
    }
    return 'spectator';
}

function claimSeat(room: Room, playerId: string): Seat {
    const existing = seatOf(room, playerId);
    if (existing !== 'spectator') {
        return existing; // reconnect / already seated: keep it
    }
    if (room.seats.black === null) {
        room.seats.black = playerId;
        return 'black';
    }
    if (room.seats.white === null) {
        room.seats.white = playerId;
        return 'white';
    }
    return 'spectator';
}

function releaseSeat(room: Room, playerId: string): void {
    if (room.seats.black === playerId) {
        room.seats.black = null;
    } else if (room.seats.white === playerId) {
        room.seats.white = null;
    }
}

function isRoomEmpty(room: Room): boolean {
    return (
        room.connections.size === 0 &&
        room.seats.black === null &&
        room.seats.white === null &&
        room.disconnectTimers.size === 0
    );
}

function cleanupRoom(room: Room): void {
    if (isRoomEmpty(room)) {
        rooms.delete(room.id);
    }
}

function applyAuthoritative(
    room: Room,
    action: GameAction,
): 'applied' | 'rejected' {
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
    return 'rejected';
}

const httpServer = createServer();
const io: AppServer = new Server(httpServer, { cors: { origin: '*' } });

function broadcastLobby(): void {
    io.to(LOBBY).emit('rooms', listRooms());
}

function enterRoom(socket: AppSocket, playerId: string, room: Room): void {
    socket.join(room.id);
    let sockets = room.connections.get(playerId);
    if (!sockets) {
        sockets = new Set();
        room.connections.set(playerId, sockets);
    }
    sockets.add(socket.id);
    const pending = room.disconnectTimers.get(playerId);
    if (pending) {
        clearTimeout(pending);
        room.disconnectTimers.delete(playerId);
    }
    const seat = claimSeat(room, playerId);
    playerRoom.set(playerId, room.id);
    socket.emit('joined', { roomId: room.id, seat });
    io.to(room.id).emit('state', toRoomState(room));
}

// Explicit leave: free the seat immediately (unlike a disconnect, which holds it).
function exitRoom(socket: AppSocket, playerId: string, room: Room): void {
    socket.leave(room.id);
    const sockets = room.connections.get(playerId);
    if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
            room.connections.delete(playerId);
        }
    }
    const pending = room.disconnectTimers.get(playerId);
    if (pending) {
        clearTimeout(pending);
        room.disconnectTimers.delete(playerId);
    }
    releaseSeat(room, playerId);
    if (playerRoom.get(playerId) === room.id) {
        playerRoom.delete(playerId);
    }
    io.to(room.id).emit('state', toRoomState(room));
    cleanupRoom(room);
}

function handleMove(
    socket: AppSocket,
    playerId: string,
    roomId: string | null,
    action: GameAction,
): void {
    const room = roomId ? rooms.get(roomId) : undefined;
    if (!room) {
        socket.emit('rejected', '不在房间里');
        return;
    }
    const seat = seatOf(room, playerId);
    if (seat === 'spectator') {
        socket.emit('rejected', '观战者不能落子');
        return;
    }
    const turn = room.record.historicalGameStates.at(-1)!.currentPlayer;
    if (seat !== turn) {
        socket.emit('rejected', '还没轮到你');
        return;
    }
    if (applyAuthoritative(room, action) === 'rejected') {
        socket.emit('rejected', '非法手');
        return;
    }
    io.to(room.id).emit('state', toRoomState(room));
    broadcastLobby();
}

function handleDisconnect(
    playerId: string,
    socketId: string,
    room: Room,
): void {
    const sockets = room.connections.get(playerId);
    if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
            room.connections.delete(playerId);
            // Hold the seat briefly so a reconnect can reclaim room + seat.
            if (seatOf(room, playerId) !== 'spectator') {
                const release = setTimeout(() => {
                    releaseSeat(room, playerId);
                    room.disconnectTimers.delete(playerId);
                    if (playerRoom.get(playerId) === room.id) {
                        playerRoom.delete(playerId);
                    }
                    io.to(room.id).emit('state', toRoomState(room));
                    cleanupRoom(room);
                    broadcastLobby();
                }, GRACE_MS);
                room.disconnectTimers.set(playerId, release);
            }
        }
    }
    io.to(room.id).emit('state', toRoomState(room));
    cleanupRoom(room);
    broadcastLobby();
}

io.on('connection', (socket) => {
    const rawId = socket.handshake.auth.playerId;
    const playerId =
        typeof rawId === 'string' && rawId.length > 0 ? rawId : socket.id;
    let currentRoomId: string | null = null;

    // Reconnect straight back into the room held during the grace window.
    const homeId = playerRoom.get(playerId);
    const home = homeId ? rooms.get(homeId) : undefined;
    if (home) {
        currentRoomId = home.id;
        enterRoom(socket, playerId, home);
        broadcastLobby();
    } else {
        if (homeId) {
            playerRoom.delete(playerId);
        }
        socket.join(LOBBY);
        socket.emit('rooms', listRooms());
    }

    socket.on('listRooms', () => {
        socket.emit('rooms', listRooms());
    });

    socket.on('createRoom', () => {
        if (currentRoomId) {
            return;
        }
        const room = makeRoom();
        socket.leave(LOBBY);
        currentRoomId = room.id;
        enterRoom(socket, playerId, room);
        broadcastLobby();
    });

    socket.on('joinRoom', (roomId) => {
        if (currentRoomId) {
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('rejected', '房间不存在');
            return;
        }
        socket.leave(LOBBY);
        currentRoomId = room.id;
        enterRoom(socket, playerId, room);
        broadcastLobby();
    });

    socket.on('leaveRoom', () => {
        if (!currentRoomId) {
            return;
        }
        const room = rooms.get(currentRoomId);
        currentRoomId = null;
        if (room) {
            exitRoom(socket, playerId, room);
        }
        socket.join(LOBBY);
        socket.emit('left');
        socket.emit('rooms', listRooms());
        broadcastLobby();
    });

    socket.on('play', (coordinates) => {
        handleMove(socket, playerId, currentRoomId, {
            type: 'PLAY',
            coordinates,
        });
    });
    socket.on('pass', () => {
        handleMove(socket, playerId, currentRoomId, { type: 'PASS' });
    });

    socket.on('disconnect', () => {
        if (!currentRoomId) {
            return;
        }
        const room = rooms.get(currentRoomId);
        if (room) {
            handleDisconnect(playerId, socket.id, room);
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`go-game server listening on :${PORT}`);
});
