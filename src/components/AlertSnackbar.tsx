import { forwardRef } from 'react';

import './AlertSnackbar.css';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import {
    type CustomContentProps,
    SnackbarContent,
    useSnackbar,
} from 'notistack';

declare module 'notistack' {
    interface VariantOverrides {
        alertSnackBar: {
            severity: 'success' | 'info' | 'warning' | 'error';
            title?: string;
        };
    }
}

export interface AlertSnackbarProps extends CustomContentProps {
    severity: 'success' | 'info' | 'warning' | 'error';
    title?: string;
}

export const AlertSnackbar = forwardRef<HTMLDivElement, AlertSnackbarProps>(
    (props, ref) => {
        const { id, message, severity, title } = props;
        const { closeSnackbar } = useSnackbar();

        return (
            <SnackbarContent ref={ref}>
                <Alert
                    className="alert-snackbar"
                    severity={severity}
                    onClose={() => {
                        closeSnackbar(id);
                    }}
                >
                    {title && <AlertTitle>{title}</AlertTitle>}
                    {message}
                </Alert>
            </SnackbarContent>
        );
    },
);
