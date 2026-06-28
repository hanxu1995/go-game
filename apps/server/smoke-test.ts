// Boot the authoritative server in-process, then drive it with clients.
import './src/index.ts';
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
    // pa creates a room -> owner + black. Watch the room via pa's state stream.
    const a = io(URL, { auth: { username: 'pa' } });
    const aStates = collect(a, 'state');
    const aJoinedP = once(a, 'joined');
    a.emit('createRoom');
    const aJoined = await aJoinedP;
    const roomId = aJoined.roomId;
    const s0 = await aStates.next();
    check(
        'pa is owner and seated black',
        aJoined.seat === 'black' &&
            s0.owner === 'pa' &&
            s0.blackTeam.join() === 'pa',
    );

    // pb, pc, pd join -> all spectators (owner seats them).
    const joinAs = async (username: string) => {
        const s = io(URL, { auth: { username } });
        const joinedP = once(s, 'joined');
        s.emit('joinRoom', roomId);
        const joined = await joinedP;
        const state = await aStates.next();
        return { socket: s, seat: joined.seat, state };
    };
    const b = await joinAs('pb');
    const c = await joinAs('pc');
    const d = await joinAs('pd');
    check(
        'joiners start as spectators',
        b.seat === 'spectator' &&
            c.seat === 'spectator' &&
            d.seat === 'spectator',
    );
    check(
        'spectators listed',
        ['pb', 'pc', 'pd'].every((p) => d.state.spectators.includes(p)),
    );

    // Owner seats the players: pb->white, pc->black, pd->white.
    a.emit('setTeam', { player: 'pb', team: 'white' });
    await aStates.next();
    a.emit('setTeam', { player: 'pc', team: 'black' });
    await aStates.next();
    a.emit('setTeam', { player: 'pd', team: 'white' });
    const seated = await aStates.next();
    check(
        'owner seated 2v2',
        seated.blackTeam.join() === 'pa,pc' &&
            seated.whiteTeam.join() === 'pb,pd' &&
            seated.spectators.length === 0 &&
            seated.currentMover === 'pa',
    );

    // Non-owner cannot change the roster.
    const bRej = once(b.socket, 'rejected');
    b.socket.emit('setTeam', { player: 'pc', team: 'spectator' });
    check('non-owner setTeam rejected', typeof (await bRej) === 'string');

    // 联棋 rotation still works under owner-assigned teams.
    a.emit('play', [0, 0]);
    const m1 = await aStates.next();
    check('after pa, mover pb', m1.currentMover === 'pb' && m1.moveCount === 1);
    check(
        'state carries 手顺 grid + komi',
        m1.moveNumberBoard[0][0] === 1 && m1.komi === 3.75,
    );
    const sgfP = once(a, 'sgf');
    a.emit('requestSgf');
    const sgf = await sgfP;
    check(
        'sgf on request',
        typeof sgf === 'string' && sgf.startsWith('(;FF[4]'),
    );
    b.socket.emit('play', [0, 1]);
    const m2 = await aStates.next();
    check('rotation: mover pc', m2.currentMover === 'pc');

    // Owner benches pc (踢人 = move to spectator).
    a.emit('setTeam', { player: 'pc', team: 'spectator' });
    const benched = await aStates.next();
    check(
        'owner benched pc',
        benched.blackTeam.join() === 'pa' && benched.spectators.includes('pc'),
    );

    a.close();
    b.socket.close();
    c.socket.close();
    d.socket.close();
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
