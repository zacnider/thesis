import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';

interface MarketCardProps {
    id: number;
    question: string;
    category: string;
    status: string;
    yesPrice?: number;
    noPrice?: number;
    totalVolume?: string;
    aiPrediction?: number | null;
    aiConfidence?: number | null;
    endBlock?: number;
    hasPosition?: boolean;
}

const categoryLabels: Record<string, string> = {
    crypto: 'Crypto',
    politics: 'Politics',
    sports: 'Sports',
    technology: 'Tech',
    entertainment: 'Entertainment',
    science: 'Science',
    general: 'General',
};

export default function MarketCard({
    id,
    question,
    category,
    status,
    yesPrice = 0.5,
    noPrice = 0.5,
    totalVolume = '0',
    aiPrediction,
    aiConfidence,
    hasPosition,
}: MarketCardProps) {
    const yesPercent = Math.round(yesPrice * 100);
    const noPercent = Math.round(noPrice * 100);

    return (
        <Link to={`/market/${id}`} style={{ textDecoration: 'none' }}>
            <div style={{ ...s.card, ...(hasPosition ? { borderColor: 'rgba(245,200,66,0.4)' } : {}) }}>
                {hasPosition && (
                    <div style={s.posBadge}>
                        <span style={s.posDot} />
                        YOUR POSITION
                    </div>
                )}
                <div style={s.header}>
                    <span style={s.category}>{categoryLabels[category] || category}</span>
                    <span style={{
                        ...s.status,
                        color: status === 'active' ? '#4ade80' : '#6366f1',
                        borderColor: status === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(99,102,241,0.2)',
                    }}>
                        {status === 'active' && <span style={s.liveDot} />}
                        {status.toUpperCase()}
                    </span>
                </div>

                <h3 style={s.question}>{question}</h3>

                {/* Probability */}
                <div style={s.probSection}>
                    <div style={s.probRow}>
                        <div style={s.probSide}>
                            <span style={{ ...s.percent, color: '#f5c842' }}>{yesPercent}%</span>
                            <span style={s.label}>YES</span>
                        </div>
                        <div style={{ ...s.probSide, justifyContent: 'flex-end' }}>
                            <span style={s.label}>NO</span>
                            <span style={{ ...s.percent, color: '#f87171' }}>{noPercent}%</span>
                        </div>
                    </div>
                    <div className="probability-bar">
                        <div className="yes-fill" style={{ width: `${yesPercent}%` }} />
                        <div className="no-fill" style={{ width: `${noPercent}%` }} />
                    </div>
                </div>

                {/* AI prediction */}
                {aiPrediction !== null && aiPrediction !== undefined && aiConfidence && (
                    <div style={s.aiRow}>
                        <span style={s.aiIcon}>&#x2B21;</span>
                        <span style={s.aiLabel}>BOB AI</span>
                        <span style={{
                            fontFamily: "'Syne', sans-serif",
                            fontWeight: 700,
                            fontSize: 12,
                            color: aiPrediction === 1 ? '#4ade80' : '#f87171',
                        }}>
                            {aiPrediction === 1 ? 'YES' : 'NO'}
                        </span>
                        <span style={s.aiConf}>{aiConfidence}%</span>
                    </div>
                )}

                {/* Footer */}
                <div style={s.footer}>
                    <span style={s.volume}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        {Number(totalVolume).toLocaleString()} tUSDT
                    </span>
                    <div style={s.btns}>
                        <button className="btn btn-yes" style={s.tBtn}>YES</button>
                        <button className="btn btn-no" style={s.tBtn}>NO</button>
                    </div>
                </div>
            </div>
        </Link>
    );
}

const s: Record<string, CSSProperties> = {
    card: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    posBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'rgba(245,200,66,0.08)',
        border: '1px solid rgba(245,200,66,0.2)',
        fontSize: 9,
        fontWeight: 700,
        color: '#f5c842',
        letterSpacing: '0.1em',
        fontFamily: "'DM Mono', monospace",
        alignSelf: 'flex-start' as const,
    },
    posDot: {
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: '#f5c842',
        boxShadow: '0 0 6px rgba(245,200,66,0.5)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    category: {
        fontSize: 10,
        color: '#6b6b5e',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: "'DM Mono', monospace",
    },
    status: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        border: '1px solid',
        fontFamily: "'DM Mono', monospace",
    },
    liveDot: {
        display: 'inline-block',
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: '#4ade80',
        boxShadow: '0 0 6px rgba(74,222,128,0.5)',
    },
    question: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: '#f0ede6',
        lineHeight: 1.45,
        minHeight: 38,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as never,
        overflow: 'hidden',
    },
    probSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    probRow: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    probSide: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 5,
    },
    percent: {
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: 24,
    },
    label: {
        fontSize: 10,
        color: '#6b6b5e',
        fontWeight: 500,
        letterSpacing: '0.06em',
        fontFamily: "'DM Mono', monospace",
    },
    aiRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'rgba(245,200,66,0.04)',
        border: '1px solid rgba(245,200,66,0.12)',
        fontSize: 12,
    },
    aiIcon: {
        color: '#f5c842',
        fontSize: 14,
    },
    aiLabel: {
        color: '#6b6b5e',
        fontWeight: 500,
        fontSize: 10,
        letterSpacing: '0.06em',
        fontFamily: "'DM Mono', monospace",
    },
    aiConf: {
        color: '#6b6b5e',
        fontSize: 11,
        marginLeft: 'auto',
        fontFamily: "'DM Mono', monospace",
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTop: '1px solid rgba(245,200,66,0.08)',
    },
    volume: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: '#6b6b5e',
        fontFamily: "'DM Mono', monospace",
    },
    btns: {
        display: 'flex',
        gap: 6,
    },
    tBtn: {
        padding: '5px 14px',
        fontSize: 11,
        letterSpacing: '0.06em',
    },
};
