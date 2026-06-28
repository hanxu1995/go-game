import { useCallback, useEffect, useRef, useState } from 'react';

import { BoardSize, CellSizePx, Dots } from '../config.ts';
import { type GameSocket, createSocket } from '../online/socket.ts';
import { displayMessage } from '../utils/message.ts';
import { Board } from './Board';
import './Game.css';
import { Lobby } from './Lobby.tsx';
import { RoomRoster } from './RoomRoster.tsx';
import { UsernameForm } from './UsernameForm.tsx';
import type {
    Coordinates,
    RoomState,
    RoomSummary,
    Seat,
} from '@go-game/shared';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

const USERNAME_KEY = 'go-game:username';
const SEAT_LABEL: Record<Seat, string> = {
    black: '你执黑',
    white: '你执白',
    spectator: '观战中',
};

export function OnlineGame() {
    const socketRef = useRef<GameSocket | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState<RoomSummary[]>([]);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [showCoordinates, setShowCoordinates] = useState(true);

    useEffect(() => {
        if (!username) {
            return;
        }
        const socket = createSocket(username);
        socketRef.current = socket;
        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));
        // Receiving the lobby list means the server has us in the lobby.
        socket.on('rooms', (list) => {
            setRooms(list);
            setRoomId(null);
            setRoomState(null);
        });
        socket.on('joined', ({ roomId: id }) => setRoomId(id));
        socket.on('left', () => {
            setRoomId(null);
            setRoomState(null);
        });
        socket.on('state', (st) => setRoomState(st));
        socket.on('rejected', (reason) =>
            displayMessage(reason, 'warning', '提示'),
        );
        return () => {
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [username]);

    const enter = useCallback((name: string) => {
        localStorage.setItem(USERNAME_KEY, name);
        setUsername(name);
    }, []);
    const changeUser = useCallback(() => {
        setUsername(null);
        setRooms([]);
        setRoomId(null);
        setRoomState(null);
    }, []);

    const createRoom = useCallback(() => {
        socketRef.current?.emit('createRoom');
    }, []);
    const joinRoom = useCallback((id: string) => {
        socketRef.current?.emit('joinRoom', id);
    }, []);
    const refresh = useCallback(() => {
        socketRef.current?.emit('listRooms');
    }, []);
    const leaveRoom = useCallback(() => {
        socketRef.current?.emit('leaveRoom');
    }, []);
    const setTeam = useCallback((player: string, team: Seat) => {
        socketRef.current?.emit('setTeam', { player, team });
    }, []);
    const handleIntersectionClick = useCallback(([row, col]: Coordinates) => {
        socketRef.current?.emit('play', [row, col]);
    }, []);
    const handlePass = useCallback(() => {
        socketRef.current?.emit('pass');
    }, []);

    if (username === null) {
        return (
            <UsernameForm
                defaultValue={localStorage.getItem(USERNAME_KEY) ?? ''}
                onSubmit={enter}
            />
        );
    }

    if (roomId === null) {
        return (
            <Lobby
                username={username}
                connected={connected}
                rooms={rooms}
                onCreate={createRoom}
                onJoin={joinRoom}
                onRefresh={refresh}
                onChangeUser={changeUser}
            />
        );
    }

    if (roomState === null) {
        return (
            <div className="game">
                <h1>房间 {roomId}</h1>
                <p>{connected ? '加载中…' : '连接中…'}</p>
            </div>
        );
    }

    const mySeat: Seat = roomState.blackTeam.includes(username)
        ? 'black'
        : roomState.whiteTeam.includes(username)
          ? 'white'
          : 'spectator';
    const myTurn = roomState.currentMover === username && !roomState.gameOver;
    const colorText = roomState.currentPlayer === 'black' ? '黑' : '白';
    const turnText = roomState.gameOver
        ? '对局结束'
        : myTurn
          ? '轮到你落子'
          : `${colorText}方行棋${roomState.currentMoverConnected ? '' : '（当前玩家已断线）'}`;

    return (
        <div className="game">
            <h1>房间 {roomId}</h1>
            <p>
                {username} · {SEAT_LABEL[mySeat]}
            </p>
            <p>{turnText}</p>
            <p>
                黑方提子：{roomState.blackCapturedOpponent}
                &nbsp;&nbsp;&nbsp;白方提子：
                {roomState.whiteCapturedOpponent}
            </p>

            <RoomRoster
                state={roomState}
                username={username}
                onSetTeam={setTeam}
            />

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
                <Button variant="outlined" onClick={leaveRoom}>
                    离开房间
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
