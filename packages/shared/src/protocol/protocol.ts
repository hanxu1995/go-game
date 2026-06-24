import type { CellState, Coordinates, Player } from '../types/common.ts';

// A seat at the board. Step 1: two seats assigned by join order; the rest spectate.
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
}

// socket.io event maps, shared by both ends for type-safe messaging.
export interface ClientToServerEvents {
    play: (coordinates: Coordinates) => void;
    pass: () => void;
}

export interface ServerToClientEvents {
    seat: (seat: Seat) => void;
    state: (state: RoomState) => void;
    rejected: (reason: string) => void;
}
