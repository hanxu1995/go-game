export function emitMessage(message: string, level: 'ERROR' | 'INFO') {
    if (level === 'ERROR') {
        console.error(message);
    } else {
        console.log(message);
    }
}
