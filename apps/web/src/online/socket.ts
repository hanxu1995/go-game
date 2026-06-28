import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from '@go-game/shared';
import { type Socket, io } from 'socket.io-client';

// Client listens for ServerToClientEvents, emits ClientToServerEvents.
export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Step 2: dev server is hard-coded. Make this an env var when we deploy.
const SERVER_URL = 'http://localhost:3001';
const PLAYER_ID_KEY = 'go-game:playerId';

// A stable per-browser id so the server can restore our seat after a reconnect.
function getPlayerId(): string {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
}

export function createSocket(): GameSocket {
    return io(SERVER_URL, { auth: { playerId: getPlayerId() } });
}
