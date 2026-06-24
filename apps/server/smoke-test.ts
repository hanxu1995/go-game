// Boot the authoritative server in-process, then drive it with two clients.
import './src/index';
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

async function main(): Promise<void> {
    const a = io(URL);
    const aSeat = once(a, 'seat');
    const aInit = once(a, 'state');
    const b = io(URL);
    const bSeat = once(b, 'seat');
    const bInit = once(b, 'state');

    check('A seat = black', (await aSeat) === 'black');
    check('B seat = white', (await bSeat) === 'white');
    await aInit;
    await bInit;

    // A (black) plays (0,0): broadcast to both clients.
    const aS1 = once(a, 'state');
    const bS1 = once(b, 'state');
    a.emit('play', [0, 0]);
    const s1 = await aS1;
    await bS1;
    check('stone placed at 0,0', s1.board[0][0] === CellStates.Black);
    check('turn -> white', s1.currentPlayer === 'white');
    check('moveCount = 1', s1.moveCount === 1);

    // B (white) plays (3,3): broadcast to both clients.
    const aS2 = once(a, 'state');
    const bS2 = once(b, 'state');
    b.emit('play', [3, 3]);
    const s2 = await bS2;
    await aS2;
    check('white at 3,3', s2.board[3][3] === CellStates.White);
    check('turn -> black', s2.currentPlayer === 'black');

    // B plays again out of turn -> rejected (only B is notified).
    const bRej = once(b, 'rejected');
    b.emit('play', [4, 4]);
    check('out-of-turn rejected', typeof (await bRej) === 'string');

    // A plays on an occupied point -> rejected.
    const aRej = once(a, 'rejected');
    a.emit('play', [0, 0]);
    check('illegal move rejected', typeof (await aRej) === 'string');

    // Double pass -> game over. Drain both clients on each broadcast so the
    // next listener can't catch the previous pass's state.
    const aPass1 = once(a, 'state');
    const bPass1 = once(b, 'state');
    a.emit('pass');
    await aPass1;
    await bPass1;
    const aEnd = once(a, 'state');
    const bEnd = once(b, 'state');
    b.emit('pass');
    const sEnd = await bEnd;
    await aEnd;
    check('double pass -> gameOver', sEnd.gameOver === true);

    a.close();
    b.close();
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
