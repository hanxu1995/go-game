import type { CellState, Coordinates, Player } from '../types/common.ts';

// Which team a player is on. Each color is a team (联棋); the rest spectate.
export type Seat = 'black' | 'white' | 'spectator';

// Authoritative snapshot the server broadcasts to a room after every change.
export interface RoomState {
    board: CellState[][];
    currentPlayer: Player; // color to move
    blackCapturedOpponent: number;
    whiteCapturedOpponent: number;
    moveCount: number;
    lastMove: Coordinates | 'PASS' | null;
    gameOver: boolean;
    owner: string; // room owner (playerId/username); controls the roster
    blackTeam: string[]; // ordered playerIds
    whiteTeam: string[];
    spectators: string[]; // connected players without a seat
    connected: string[]; // currently-connected players (for online/offline marks)
    currentMover: string | null; // who must play this turn (联棋 rotation)
    currentMoverConnected: boolean;
}

// One row in the lobby list.
export interface RoomSummary {
    id: string;
    players: number; // total people in the room
    gameOver: boolean;
    moveCount: number;
}

// socket.io event maps, shared by both ends for type-safe messaging.
export interface ClientToServerEvents {
    listRooms: () => void;
    createRoom: () => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    // Owner-only: move a player to a team or to the bench (加人/踢人/调队).
    setTeam: (payload: { player: string; team: Seat }) => void;
    play: (coordinates: Coordinates) => void;
    pass: () => void;
}

export interface ServerToClientEvents {
    rooms: (rooms: RoomSummary[]) => void; // lobby list
    joined: (info: { roomId: string; seat: Seat }) => void;
    left: () => void; // back to lobby
    state: (state: RoomState) => void; // current room snapshot
    rejected: (reason: string) => void;
}
