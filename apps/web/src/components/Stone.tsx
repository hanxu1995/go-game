import { memo } from 'react';

import type { Coordinates } from '@go-game/shared';

export interface StoneProps {
    coordinates: Coordinates;
    color: 'black' | 'white';
    cellSizePx: number; // Cell size for positioning
    moveNumber?: number; // when set, painted on the stone as its 手顺 label
}

function Stone_({ coordinates, color, cellSizePx, moveNumber }: StoneProps) {
    // Calculate the center of the intersection
    const cx = (coordinates[1] + 1 / 2) * cellSizePx;
    const cy = (coordinates[0] + 1 / 2) * cellSizePx;

    // Radius is slightly less than half the cell size
    const radius = cellSizePx * 0.45;

    return (
        <g>
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                stroke="black"
                strokeWidth={1}
            />
            {moveNumber !== undefined && (
                <text
                    x={cx}
                    y={cy}
                    fill={color === 'black' ? 'white' : 'black'}
                    fontSize={cellSizePx * 0.4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                >
                    {moveNumber}
                </text>
            )}
        </g>
    );
}

export const Stone = memo(Stone_);
