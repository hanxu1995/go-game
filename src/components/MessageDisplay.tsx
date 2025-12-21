import { useMessageStore } from '../utils/message.ts';
import './MessageDisplay.css';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Stack from '@mui/material/Stack';
import { createPortal } from 'react-dom';

export function MessageDisplay() {
    const { messages, removeMessage } = useMessageStore();
    return createPortal(
        <Stack className="message-stack" spacing={1}>
            {messages.map(({ id, content, title, severity }) => (
                <Alert
                    key={`alert-${id}`}
                    severity={severity}
                    onClose={() => {
                        removeMessage(id);
                    }}
                >
                    {title && <AlertTitle>{title}</AlertTitle>}
                    {content}
                </Alert>
            ))}
        </Stack>,
        document.body,
    );
}
