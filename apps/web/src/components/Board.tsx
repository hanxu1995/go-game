import './Board.css';
import { Stone } from './Stone.tsx';
import { type CellState, CellStates, type Coordinates } from '@go-game/shared';

// The distance between each line/intersection
const GRID_LINE_WIDTH = 2;
// Go column labels run left→right and skip 'I' by convention (A..T for 19x19).
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

export interface BoardProps {
    cellSizePx: number; // in px
    boardSize: number; // e.g., 19 for 19x19
    dots: Coordinates[];
    boardState: CellState[][];
    moveNumberBoard?: number[][]; // move number that placed each stone (0 = empty)
    minVisibleMoveNumber?: number; // paint numbers >= this (omit/Infinity hides all)
    showCoordinates: boolean;
    onIntersectionClick: ([row, col]: Coordinates) => void;
}

export function Board({
    cellSizePx,
    boardSize,
    dots,
    boardState,
    moveNumberBoard,
    minVisibleMoveNumber,
    showCoordinates,
    onIntersectionClick,
}: BoardProps) {
    const gridSizePx = boardSize * cellSizePx;
    const firstLine = cellSizePx / 2;
    const lastLine = gridSizePx - cellSizePx / 2;
    // Gap from the outermost lines out to the coordinate labels.
    const labelGap = cellSizePx * 0.6;
    const labelMargin = showCoordinates ? labelGap : 0;
    const svgSizePx = gridSizePx + 2 * labelMargin;

    // Renders the board lines (one per row/column of intersections).
    const renderGridLines = () => {
        const lines = [];
        for (let i = 0; i < boardSize; ++i) {
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
                const moveNumber = moveNumberBoard?.[i]?.[j] ?? 0;
                stones.push(
                    <Stone
                        key={`s-${i}-${j}-${color}`}
                        coordinates={[i, j]}
                        color={color}
                        cellSizePx={cellSizePx}
                        moveNumber={
                            moveNumber >=
                            (minVisibleMoveNumber ?? Number.POSITIVE_INFINITY)
                                ? moveNumber
                                : undefined
                        }
                    />,
                );
            }
        }
        return stones;
    };

    // Edge coordinates: columns A.. (left→right) on top & bottom, rows
    // boardSize..1 (top→bottom, i.e. 1 at the bottom) on left & right.
    const renderCoordinates = () => {
        const labels = [];
        const textProps = {
            textAnchor: 'middle',
            dominantBaseline: 'central',
            fontSize: cellSizePx * 0.32,
            fill: '#555',
            pointerEvents: 'none',
        } as const;
        for (let i = 0; i < boardSize; ++i) {
            const center = (i + 1 / 2) * cellSizePx;
            const letter = COLUMN_LETTERS[i];
            const rowNumber = boardSize - i;
            labels.push(
                <text
                    key={`col-top-${i}`}
                    x={center}
                    y={firstLine - labelGap}
                    {...textProps}
                >
                    {letter}
                </text>,
                <text
                    key={`col-bottom-${i}`}
                    x={center}
                    y={lastLine + labelGap}
                    {...textProps}
                >
                    {letter}
                </text>,
                <text
                    key={`row-left-${i}`}
                    x={firstLine - labelGap}
                    y={center}
                    {...textProps}
                >
                    {rowNumber}
                </text>,
                <text
                    key={`row-right-${i}`}
                    x={lastLine + labelGap}
                    y={center}
                    {...textProps}
                >
                    {rowNumber}
                </text>,
            );
        }
        return labels;
    };

    return (
        <svg
            className="board"
            width={svgSizePx}
            height={svgSizePx}
            viewBox={`0 0 ${svgSizePx} ${svgSizePx}`}
        >
            <g transform={`translate(${labelMargin}, ${labelMargin})`}>
                {renderGridLines()}
                {renderDots()}
                {renderIntersections()}
                {renderStones()}
                {showCoordinates && renderCoordinates()}
            </g>
        </svg>
    );
}
