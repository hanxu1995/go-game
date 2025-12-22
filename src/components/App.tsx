import { AlertSnackbar } from './AlertSnackbar.tsx';
import './App.css';
import { Game } from './Game';
import { SnackbarProvider } from 'notistack';

export function App() {
    return (
        <>
            <Game />
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
