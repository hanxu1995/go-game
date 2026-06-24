import { useCallback, useEffect, useRef, useState } from 'react';

import { BoardSize, CellSizePx, Dots } from '../config.ts';
import { type GameSocket, createSocket } from '../online/socket.ts';
import { displayMessage } from '../utils/message.ts';
import { Board } from './Board';
import './Game.css';
import type { Coordinates, RoomState, Seat } from '@go-game/shared';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

const SEAT_LABEL: Record<Seat, string> = {
    black: '你执黑',
    white: '你执白',
    spectator: '观战中',
};

export function OnlineGame() {
    const socketRef = useRef<GameSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [seat, setSeat] = useState<Seat | null>(null);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [showCoordinates, setShowCoordinates] = useState(true);

    useEffect(() => {
        const socket = createSocket();
        socketRef.current = socket;
        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));
        socket.on('seat', (s) => setSeat(s));
        socket.on('state', (st) => setRoomState(st));
        socket.on('rejected', (reason) =>
            displayMessage(reason, 'warning', '不可落子'),
        );
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const handleIntersectionClick = useCallback(([row, col]: Coordinates) => {
        socketRef.current?.emit('play', [row, col]);
    }, []);
    const handlePass = useCallback(() => {
        socketRef.current?.emit('pass');
    }, []);

    if (!roomState) {
        return (
            <div className="game">
                <h1>围棋-联机</h1>
                <p>{connected ? '已连接，等待状态…' : '连接服务器中…'}</p>
            </div>
        );
    }

    const myTurn = seat === roomState.currentPlayer && !roomState.gameOver;

    return (
        <div className="game">
            <h1>围棋-联机</h1>
            <p>
                {connected ? '已连接' : '连接中…'}
                {seat ? ` · ${SEAT_LABEL[seat]}` : ''}
            </p>
            <p>
                {roomState.gameOver
                    ? '对局结束'
                    : `${roomState.currentPlayer === 'black' ? '黑' : '白'}方行棋${myTurn ? '（轮到你）' : ''}`}
            </p>
            <p>
                黑方提子：{roomState.blackCapturedOpponent}
                &nbsp;&nbsp;&nbsp;白方提子：
                {roomState.whiteCapturedOpponent}
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <Button
                    variant="contained"
                    disabled={!myTurn}
                    onClick={handlePass}
                >
                    停一手
                </Button>
                <FormControlLabel
                    control={
                        <Switch
                            checked={showCoordinates}
                            onChange={(_event, checked) =>
                                setShowCoordinates(checked)
                            }
                        />
                    }
                    label="坐标"
                />
            </div>

            <Board
                cellSizePx={CellSizePx}
                boardSize={BoardSize}
                dots={Dots}
                boardState={roomState.board}
                showCoordinates={showCoordinates}
                onIntersectionClick={handleIntersectionClick}
            />
        </div>
    );
}
