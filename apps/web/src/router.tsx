import { App } from './components/App.tsx';
import { createBrowserRouter } from 'react-router';

export const router = createBrowserRouter([
    {
        path: '/go-game',
        element: <App />,
    },
]);
