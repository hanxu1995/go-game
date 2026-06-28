import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from '@go-game/shared';
import { type Socket, io } from 'socket.io-client';

// Client listens for ServerToClientEvents, emits ClientToServerEvents.
export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Step 2: dev server is hard-coded. Make this an env var when we deploy.
const SERVER_URL = 'http://localhost:3001';

// Identity is the username the player enters before going online. No accounts
// yet; later this becomes a real registered userId.
export function createSocket(username: string): GameSocket {
    return io(SERVER_URL, { auth: { username } });
}
