import type { CSSProperties } from 'react';

import type { RoomState, Seat } from '@go-game/shared';
import Button from '@mui/material/Button';

export interface RoomRosterProps {
    state: RoomState;
    username: string;
    onSetTeam: (player: string, team: Seat) => void;
}

const listStyle: CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: '4px 0 12px',
};

export function RoomRoster({ state, username, onSetTeam }: RoomRosterProps) {
    const isOwner = state.owner === username;
    const connectedSet = new Set(state.connected);

    const renderGroup = (title: string, players: string[], group: Seat) => (
        <div>
            <strong>{title}</strong>
            <ul style={listStyle}>
                {players.length === 0 ? (
                    <li style={{ color: '#999' }}>（空）</li>
                ) : (
                    players.map((p) => (
                        <li
                            key={p}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                padding: '2px 0',
                            }}
                        >
                            <span>
                                {p}
                                {p === username ? '（你）' : ''}
                                {p === state.owner ? '（房主）' : ''}
                                {connectedSet.has(p) ? '' : '（离线）'}
                            </span>
                            {isOwner && (
                                <span style={{ display: 'flex', gap: 4 }}>
                                    {group !== 'black' && (
                                        <Button
                                            size="small"
                                            onClick={() =>
                                                onSetTeam(p, 'black')
                                            }
                                        >
                                            转黑
                                        </Button>
                                    )}
                                    {group !== 'white' && (
                                        <Button
                                            size="small"
                                            onClick={() =>
                                                onSetTeam(p, 'white')
                                            }
                                        >
                                            转白
                                        </Button>
                                    )}
                                    {group !== 'spectator' && (
                                        <Button
                                            size="small"
                                            onClick={() =>
                                                onSetTeam(p, 'spectator')
                                            }
                                        >
                                            旁观
                                        </Button>
                                    )}
                                </span>
                            )}
                        </li>
                    ))
                )}
            </ul>
        </div>
    );

    return (
        <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
            {renderGroup('黑方', state.blackTeam, 'black')}
            {renderGroup('白方', state.whiteTeam, 'white')}
            {renderGroup('旁观', state.spectators, 'spectator')}
            {isOwner && (
                <p style={{ fontSize: 12, color: '#666' }}>
                    你是房主：可调整座位（加人 / 踢人 / 调队）。
                </p>
            )}
        </div>
    );
}
