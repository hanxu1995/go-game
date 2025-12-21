import './App.css';
import { Game } from './Game';
import { MessageDisplay } from './MessageDisplay.tsx';

export function App() {
    return (
        <>
            <Game />
            <footer className="footer">
                <p>© 2025 唯二的白子 | 版权所有</p>
            </footer>
            <MessageDisplay />
        </>
    );
}
