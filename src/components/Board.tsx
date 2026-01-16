import {
    type CellState,
    CellStates,
    type Coordinates,
} from '../types/common.ts';
import './Board.css';
import { Stone } from './Stone.tsx';

// The distance between each line/intersection
const GRID_LINE_WIDTH = 2;

export interface BoardProps {
    cellSizePx: number; // in px
    boardSize: number; // e.g., 19 for 19x19
    dots: Coordinates[];
    boardState: CellState[][];
    onIntersectionClick: ([row, col]: Coordinates) => void;
}

export function Board({
    cellSizePx,
    boardSize,
    dots,
    boardState,
    onIntersectionClick,
}: BoardProps) {
    // Renders the board lines (from index 0 to size)
    const renderGridLines = () => {
        const lines = [];
        const numLines = boardSize + 1;

        for (let i = 0; i < numLines; ++i) {
            // 1. Horizontal Lines
            lines.push(
                <line
                    key={`h-${i}`}
                    x1={cellSizePx / 2}
                    y1={(i + 1 / 2) * cellSizePx}
                    x2={(boardSize - 1 / 2) * cellSizePx}
                    y2={(i + 1 / 2) * cellSizePx}
                    stroke="black"
                    strokeWidth={GRID_LINE_WIDTH}
                />,
            );

            // 2. Vertical Lines
            lines.push(
                <line
                    key={`v-${i}`}
                    x1={(i + 1 / 2) * cellSizePx}
                    y1={cellSizePx / 2}
                    x2={(i + 1 / 2) * cellSizePx}
                    y2={(boardSize - 1 / 2) * cellSizePx}
                    stroke="black"
                    strokeWidth={GRID_LINE_WIDTH}
                />,
            );
        }
        return lines;
    };

    const renderDots = () => {
        return dots.map(([i, j]) => {
            const cx = (j + 1 / 2) * cellSizePx;
            const cy = (i + 1 / 2) * cellSizePx;
            const radius = cellSizePx * 0.1; // Small dot

            return (
                <circle
                    key={`d-${i}-${j}`}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="black"
                />
            );
        });
    };

    // Renders invisible target areas on intersections for clicking
    const renderIntersections = () => {
        const targets = [];
        // Board indices run from 0 to size-1
        for (let i = 0; i < boardSize; ++i) {
            for (let j = 0; j < boardSize; ++j) {
                // Calculate the upper-left corner of the invisible box
                const x = j * cellSizePx;
                const y = i * cellSizePx;

                targets.push(
                    <rect
                        key={`t-${i}-${j}`}
                        x={x}
                        y={y}
                        width={cellSizePx}
                        height={cellSizePx}
                        fill="transparent"
                        stroke="transparent" // Invisible
                        onClick={() => onIntersectionClick([i, j])}
                        style={{ cursor: 'pointer' }}
                    />,
                );
            }
        }
        return targets;
    };

    const renderStones = () => {
        const stones = [];
        for (let i = 0; i < boardSize; ++i) {
            for (let j = 0; j < boardSize; ++j) {
                const stone = boardState[i][j];
                let color: 'black' | 'white';
                if (stone == CellStates.Black) {
                    color = 'black';
                } else if (stone == CellStates.White) {
                    color = 'white';
                } else {
                    continue;
                }
                stones.push(
                    <Stone
                        key={`s-${i}-${j}-${color}`}
                        coordinates={[i, j]}
                        color={color}
                        cellSizePx={cellSizePx}
                    />,
                );
            }
        }
        return stones;
    };

    const svgSizePx = boardSize * cellSizePx;
    return (
        <svg
            className="board"
            width={svgSizePx}
            height={svgSizePx}
            viewBox={`0 0 ${svgSizePx} ${svgSizePx}`}
        >
            {renderGridLines()}
            {renderDots()}
            {renderIntersections()}
            {renderStones()}
        </svg>
    );
}
