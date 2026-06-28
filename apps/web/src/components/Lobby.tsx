import type { RoomSummary } from '@go-game/shared';
import Button from '@mui/material/Button';

export interface LobbyProps {
    username: string;
    connected: boolean;
    rooms: RoomSummary[];
    onCreate: () => void;
    onJoin: (roomId: string) => void;
    onRefresh: () => void;
    onChangeUser: () => void;
}

export function Lobby({
    username,
    connected,
    rooms,
    onCreate,
    onJoin,
    onRefresh,
    onChangeUser,
}: LobbyProps) {
    return (
        <div className="game">
            <h1>联机大厅</h1>
            <p>
                用户：{username} · {connected ? '已连接' : '连接服务器中…'}
            </p>
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <Button variant="contained" onClick={onCreate}>
                    创建房间
                </Button>
                <Button variant="outlined" onClick={onRefresh}>
                    刷新
                </Button>
                <Button variant="text" onClick={onChangeUser}>
                    切换用户
                </Button>
            </div>
            {rooms.length === 0 ? (
                <p>还没有房间，点"创建房间"开一桌。</p>
            ) : (
                <ul
                    style={{
                        listStyle: 'none',
                        padding: 0,
                        maxWidth: 360,
                        margin: '0 auto',
                    }}
                >
                    {rooms.map((room) => (
                        <li
                            key={room.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 12px',
                                border: '1px solid #ddd',
                                borderRadius: 6,
                                margin: '6px 0',
                            }}
                        >
                            <span>
                                {room.id} · {room.players} 人 · {room.moveCount}{' '}
                                手{room.gameOver ? ' · 已结束' : ''}
                            </span>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onJoin(room.id)}
                            >
                                加入
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
