import {
    CellStates,
    type ClientToServerEvents,
    type GameAction,
    type GameState,
    type GameStatesRecord,
    type Player,
    type RoomState,
    type RoomSummary,
    type Seat,
    type ServerToClientEvents,
    buildMoveNumberBoard,
    checkAndAddNewHistoricalGameState,
    cloneGameStatesRecord,
    toSGF,
    transitGameState,
} from '@go-game/shared';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

const BOARD_SIZE = 19;
const FULL_KO = true;
const LOBBY = 'lobby';
const PORT = Number(process.env.PORT ?? 3001);
// How long a disconnected player keeps their place before being removed.
const GRACE_MS = Number(process.env.GRACE_MS ?? 60_000);
const DEFAULT_KOMI = 3.75; // 中国规则贴目（子）

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Room {
    id: string;
    owner: string; // playerId of the room owner (controls the roster)
    komi: number; // 子 (Chinese rules)
    record: GameStatesRecord;
    gameOver: boolean;
    // 联棋: each color is an ordered team of playerIds.
    teams: { black: string[]; white: string[] };
    // How many moves each color has made; the next mover rotates through the team.
    turnIndex: { black: number; white: number };
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
        owner: '',
        komi: DEFAULT_KOMI,
        record: createInitialRecord(BOARD_SIZE),
        gameOver: false,
        teams: { black: [], white: [] },
        turnIndex: { black: 0, white: 0 },
        connections: new Map(),
        disconnectTimers: new Map(),
    };
    rooms.set(room.id, room);
    return room;
}

function isConnected(room: Room, playerId: string | null): boolean {
    return playerId !== null && (room.connections.get(playerId)?.size ?? 0) > 0;
}

function seatOf(room: Room, playerId: string): Seat {
    if (room.teams.black.includes(playerId)) {
        return 'black';
    }
    if (room.teams.white.includes(playerId)) {
        return 'white';
    }
    return 'spectator';
}

function removeFromTeam(room: Room, playerId: string): void {
    const bi = room.teams.black.indexOf(playerId);
    if (bi >= 0) {
        room.teams.black.splice(bi, 1);
        return;
    }
    const wi = room.teams.white.indexOf(playerId);
    if (wi >= 0) {
        room.teams.white.splice(wi, 1);
    }
}

function spectatorsOf(room: Room): string[] {
    const seated = new Set([...room.teams.black, ...room.teams.white]);
    return [...room.connections.keys()].filter((p) => !seated.has(p));
}

// If the owner is gone, hand ownership to the next available person.
function ensureOwner(room: Room): void {
    const present =
        room.owner !== '' &&
        (seatOf(room, room.owner) !== 'spectator' ||
            room.connections.has(room.owner));
    if (present) {
        return;
    }
    room.owner =
        room.teams.black[0] ??
        room.teams.white[0] ??
        [...room.connections.keys()][0] ??
        '';
}

// The playerId who must play this turn: the current color's rotation member.
function currentMover(room: Room): string | null {
    const color = room.record.historicalGameStates.at(-1)!.currentPlayer;
    const team = room.teams[color];
    if (team.length === 0) {
        return null;
    }
    return team[room.turnIndex[color] % team.length];
}

function toRoomState(room: Room): RoomState {
    const state = room.record.historicalGameStates.at(-1)!;
    const mover = currentMover(room);
    return {
        board: state.board,
        currentPlayer: state.currentPlayer,
        blackCapturedOpponent: state.blackCapturedOpponent,
        whiteCapturedOpponent: state.whiteCapturedOpponent,
        moveCount: room.record.moves.length,
        lastMove: state.lastMove,
        gameOver: room.gameOver,
        owner: room.owner,
        blackTeam: [...room.teams.black],
        whiteTeam: [...room.teams.white],
        spectators: spectatorsOf(room),
        connected: [...room.connections.keys()],
        currentMover: mover,
        currentMoverConnected: mover !== null && isConnected(room, mover),
        moveNumberBoard: buildMoveNumberBoard(room.record.historicalGameStates),
        komi: room.komi,
    };
}

function roomSummary(room: Room): RoomSummary {
    return {
        id: room.id,
        players:
            room.teams.black.length +
            room.teams.white.length +
            spectatorsOf(room).length,
        gameOver: room.gameOver,
        moveCount: room.record.moves.length,
    };
}

function listRooms(): RoomSummary[] {
    return [...rooms.values()].map(roomSummary);
}

function isRoomEmpty(room: Room): boolean {
    return (
        room.connections.size === 0 &&
        room.teams.black.length === 0 &&
        room.teams.white.length === 0 &&
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

// Register a connection in a room. Does NOT assign a team — new joiners are
// spectators until the owner seats them; reconnects keep their existing seat.
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
    playerRoom.set(playerId, room.id);
    socket.emit('joined', { roomId: room.id, seat: seatOf(room, playerId) });
    io.to(room.id).emit('state', toRoomState(room));
}

// Explicit leave: remove from the team immediately (a disconnect holds it).
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
    removeFromTeam(room, playerId);
    if (playerRoom.get(playerId) === room.id) {
        playerRoom.delete(playerId);
    }
    ensureOwner(room);
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
    if (currentMover(room) !== playerId) {
        socket.emit('rejected', '还没轮到你');
        return;
    }
    const color: Player =
        room.record.historicalGameStates.at(-1)!.currentPlayer;
    if (applyAuthoritative(room, action) === 'rejected') {
        socket.emit('rejected', '非法手');
        return;
    }
    // The color that just moved advances to its next team member.
    room.turnIndex[color] += 1;
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
            // Hold a seated player's place briefly so a reconnect can reclaim it.
            if (seatOf(room, playerId) !== 'spectator') {
                const release = setTimeout(() => {
                    removeFromTeam(room, playerId);
                    room.disconnectTimers.delete(playerId);
                    if (playerRoom.get(playerId) === room.id) {
                        playerRoom.delete(playerId);
                    }
                    ensureOwner(room);
                    io.to(room.id).emit('state', toRoomState(room));
                    cleanupRoom(room);
                    broadcastLobby();
                }, GRACE_MS);
                room.disconnectTimers.set(playerId, release);
            } else if (playerRoom.get(playerId) === room.id) {
                // A spectator left: nothing to hold.
                playerRoom.delete(playerId);
            }
        }
    }
    ensureOwner(room);
    io.to(room.id).emit('state', toRoomState(room));
    cleanupRoom(room);
    broadcastLobby();
}

io.on('connection', (socket) => {
    // Identity is the username the client entered (no accounts yet); falls back
    // to the socket id for anonymous clients (which then can't reconnect).
    const rawName = socket.handshake.auth.username;
    const playerId =
        typeof rawName === 'string' && rawName.trim().length > 0
            ? rawName.trim()
            : socket.id;
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
        room.owner = playerId;
        room.teams.black.push(playerId); // creator plays black by default
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
        enterRoom(socket, playerId, room); // joins as spectator (owner seats later)
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

    socket.on('setTeam', ({ player, team }) => {
        if (!currentRoomId) {
            return;
        }
        const room = rooms.get(currentRoomId);
        if (!room) {
            return;
        }
        if (room.owner !== playerId) {
            socket.emit('rejected', '只有房主可以调整座位');
            return;
        }
        const present =
            seatOf(room, player) !== 'spectator' ||
            room.connections.has(player);
        if (!present) {
            socket.emit('rejected', '该玩家不在房间');
            return;
        }
        removeFromTeam(room, player);
        if (team === 'black') {
            room.teams.black.push(player);
        } else if (team === 'white') {
            room.teams.white.push(player);
        }
        io.to(room.id).emit('state', toRoomState(room));
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

    socket.on('requestSgf', () => {
        const room = currentRoomId ? rooms.get(currentRoomId) : undefined;
        if (room) {
            socket.emit('sgf', toSGF(room.record.moves, BOARD_SIZE, room.komi));
        }
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
