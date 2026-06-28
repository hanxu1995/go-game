// Boot the authoritative server in-process, then drive it with clients.
import './src/index.ts';
import { CellStates } from '@go-game/shared';
import { io } from 'socket.io-client';

const PORT = Number(process.env.PORT ?? 3001);
const URL = `http://localhost:${PORT}`;

const results: Array<[string, boolean]> = [];
const check = (name: string, cond: boolean): number =>
    results.push([name, cond]);

function once(socket: any, event: string): Promise<any> {
    return new Promise((resolve) => socket.once(event, resolve));
}

// Buffers every `event` so the test consumes them in order without races.
function collect(socket: any, event: string): { next: () => Promise<any> } {
    const queue: any[] = [];
    const waiters: Array<(v: any) => void> = [];
    socket.on(event, (arg: any) => {
        const waiter = waiters.shift();
        if (waiter) {
            waiter(arg);
        } else {
            queue.push(arg);
        }
    });
    return {
        next() {
            const v = queue.shift();
            return v !== undefined
                ? Promise.resolve(v)
                : new Promise((resolve) => waiters.push(resolve));
        },
    };
}

async function main(): Promise<void> {
    // A connects -> lobby (empty).
    const a = io(URL, { auth: { playerId: 'pa' } });
    const aRooms = collect(a, 'rooms');
    const aStates = collect(a, 'state');
    const initial = await aRooms.next();
    check('lobby starts empty', Array.isArray(initial) && initial.length === 0);

    // A creates a room -> seated black.
    const aJoined = once(a, 'joined');
    a.emit('createRoom');
    const created = await aJoined;
    await aStates.next();
    const roomId = created.roomId;
    check(
        'A created room, seat black',
        created.seat === 'black' && typeof roomId === 'string',
    );

    // B connects -> lobby shows the room with one player.
    const b = io(URL, { auth: { playerId: 'pb' } });
    const bRooms = collect(b, 'rooms');
    const bStates = collect(b, 'state');
    const lobby = await bRooms.next();
    check(
        'B sees 1 room with 1 player',
        lobby.length === 1 && lobby[0].players === 1,
    );

    // B joins -> seated white.
    const bJoined = once(b, 'joined');
    b.emit('joinRoom', roomId);
    const bj = await bJoined;
    await bStates.next();
    await aStates.next(); // A is notified that B joined the room
    check('B joined as white', bj.seat === 'white' && bj.roomId === roomId);

    // A (black) plays -> both in the room receive state.
    a.emit('play', [0, 0]);
    const s1 = await aStates.next();
    await bStates.next();
    check(
        'move syncs in room',
        s1.board[0][0] === CellStates.Black && s1.moveCount === 1,
    );

    // A leaves -> back to lobby, black seat freed.
    const aLeft = once(a, 'left');
    a.emit('leaveRoom');
    await aLeft;
    check('A left to lobby', true);

    // Reconnection: B drops and returns with the same playerId -> back in the
    // same room, seat white restored.
    b.close();
    const b2 = io(URL, { auth: { playerId: 'pb' } });
    const rejoined = await once(b2, 'joined');
    check(
        'B reconnects into room as white',
        rejoined.roomId === roomId && rejoined.seat === 'white',
    );

    a.close();
    b2.close();
}

setTimeout(() => {
    console.log('TIMEOUT — smoke test did not finish');
    process.exit(1);
}, 10000);

void main()
    .then(() => {
        let ok = true;
        for (const [name, pass] of results) {
            if (!pass) ok = false;
            console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
        }
        console.log(ok ? '=== ALL PASS ===' : '=== SOME FAIL ===');
        process.exit(ok ? 0 : 1);
    })
    .catch((err: unknown) => {
        console.error(err);
        process.exit(1);
    });
