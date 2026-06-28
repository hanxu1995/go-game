import type { CellState, Coordinates, Player } from '../types/common.ts';

// A seat at the board. Two seats per room; the rest spectate.
export type Seat = 'black' | 'white' | 'spectator';

// Authoritative snapshot the server broadcasts to a room after every change.
export interface RoomState {
    board: CellState[][];
    currentPlayer: Player;
    blackCapturedOpponent: number;
    whiteCapturedOpponent: number;
    moveCount: number;
    lastMove: Coordinates | 'PASS' | null;
    gameOver: boolean;
    blackConnected: boolean;
    whiteConnected: boolean;
}

// One row in the lobby list.
export interface RoomSummary {
    id: string;
    players: number; // seated players, 0-2
    gameOver: boolean;
    moveCount: number;
}

// socket.io event maps, shared by both ends for type-safe messaging.
export interface ClientToServerEvents {
    listRooms: () => void;
    createRoom: () => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
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
