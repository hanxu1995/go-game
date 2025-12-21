import { create } from 'zustand';

export interface Message {
    id: number;
    content: string;
    title?: string;
    severity: 'success' | 'info' | 'warning' | 'error';
}

interface MessageState {
    id: number;
    messages: Message[];
    addMessage: (
        content: string,
        severity: Message['severity'],
        title?: string,
    ) => number;
    removeMessage: (id: number) => Message | undefined;
    displayMessage: (
        content: string,
        severity: Message['severity'],
        title?: string,
    ) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    id: 0,
    messages: [],
    addMessage: (
        content: string,
        severity: Message['severity'],
        title?: string,
    ) => {
        const { id, messages } = get();
        const newMessage: Message = {
            id: id + 1,
            content,
            severity,
            title,
        };
        set({
            id: newMessage.id,
            messages: [...messages, newMessage],
        });
        return newMessage.id;
    },
    removeMessage: (id: number) => {
        const { messages } = get();
        let resultMessage: Message | undefined = undefined;
        set({
            messages: messages.filter((message) => {
                if (message.id === id) {
                    resultMessage = message;
                    return false;
                }
                return true;
            }),
        });
        return resultMessage;
    },
    displayMessage: (
        content: string,
        severity: Message['severity'],
        title?: string,
        duration: number = 3000,
    ) => {
        const { addMessage, removeMessage } = get();
        const id = addMessage(content, severity, title);
        setTimeout(() => {
            removeMessage(id);
        }, duration);
    },
}));

export const displayMessage = useMessageStore.getState().displayMessage;
