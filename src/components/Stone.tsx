import { memo } from 'react';

import type { Coordinates } from '../types/common.ts';

export interface StoneProps {
    coordinates: Coordinates;
    color: 'black' | 'white';
    cellSizePx: number; // Cell size for positioning
}

function Stone_({ coordinates, color, cellSizePx }: StoneProps) {
    // Calculate the center of the intersection
    const cx = (coordinates[1] + 1 / 2) * cellSizePx;
    const cy = (coordinates[0] + 1 / 2) * cellSizePx;

    // Radius is slightly less than half the cell size
    const radius = cellSizePx * 0.45;

    return (
        <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={color}
            stroke="black"
            strokeWidth={1}
        />
    );
}

export const Stone = memo(Stone_);
