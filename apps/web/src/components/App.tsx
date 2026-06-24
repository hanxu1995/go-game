import { useState } from 'react';

import { AlertSnackbar } from './AlertSnackbar.tsx';
import './App.css';
import { Game } from './Game';
import { OnlineGame } from './OnlineGame.tsx';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { SnackbarProvider } from 'notistack';

type Mode = 'local' | 'online';

export function App() {
    const [mode, setMode] = useState<Mode>('local');
    return (
        <>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={mode}
                    onChange={(_event, next: Mode | null) => {
                        if (next) {
                            setMode(next);
                        }
                    }}
                >
                    <ToggleButton value="local">本地</ToggleButton>
                    <ToggleButton value="online">联机</ToggleButton>
                </ToggleButtonGroup>
            </div>
            {mode === 'local' ? <Game /> : <OnlineGame />}
            <footer className="footer">
                <p>© 2025 唯二的白子 | 版权所有</p>
            </footer>
            <SnackbarProvider
                Components={{ alertSnackBar: AlertSnackbar }}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                autoHideDuration={3000}
                preventDuplicate={true}
                variant="alertSnackBar"
            />
        </>
    );
}
