import type { ScoreResult } from '@go-game/shared';

export interface ScoreBannerProps {
    score: ScoreResult;
    gameOver: boolean;
}

export function ScoreBanner({ score, gameOver }: ScoreBannerProps) {
    const result =
        score.winner === 'draw'
            ? '平局'
            : `${score.winner === 'black' ? '黑' : '白'}胜 ${score.margin} 子`;
    return (
        <div
            style={{
                margin: '8px auto',
                padding: '8px 12px',
                maxWidth: 'fit-content',
                border: '1px solid #bbb',
                borderRadius: 6,
                background: '#f6f6f6',
            }}
        >
            <div>{`${gameOver ? '对局结束' : '数子'} · ${result}`}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {`黑 ${score.blackArea} 子 · 白 ${score.whiteArea} 子（贴目 ${score.komi} 子 / ${score.komi * 2} 目）`}
            </div>
        </div>
    );
}
