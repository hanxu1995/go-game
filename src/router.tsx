import { createBrowserRouter } from 'react-router';
import { App } from './components/App.tsx';

export const router = createBrowserRouter([
    {
        path: '/go-game',
        element: <App />,
    },
]);
