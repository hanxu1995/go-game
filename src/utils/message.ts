import type { AlertSnackbarProps } from '../components/AlertSnackbar.tsx';
import { enqueueSnackbar } from 'notistack';

export function displayMessage(
    content: string,
    severity: AlertSnackbarProps['severity'],
    title?: string,
) {
    enqueueSnackbar(content, { severity, title } as any);
}
