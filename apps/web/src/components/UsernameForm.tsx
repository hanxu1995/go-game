import { useState } from 'react';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

export interface UsernameFormProps {
    defaultValue: string;
    onSubmit: (username: string) => void;
}

export function UsernameForm({ defaultValue, onSubmit }: UsernameFormProps) {
    const [name, setName] = useState(defaultValue);
    const trimmed = name.trim();
    const submit = () => {
        if (trimmed) {
            onSubmit(trimmed);
        }
    };
    return (
        <div className="game">
            <h1>联机</h1>
            <p>输入一个用户名即可开始（暂不需要注册）。</p>
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'center',
                    margin: '8px 0',
                }}
            >
                <TextField
                    label="用户名"
                    size="small"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            submit();
                        }
                    }}
                />
                <Button
                    variant="contained"
                    disabled={!trimmed}
                    onClick={submit}
                >
                    进入
                </Button>
            </div>
        </div>
    );
}
