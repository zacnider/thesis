import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useAPI';
import MarketCard from '../components/market/MarketCard';
import type { CSSProperties } from 'react';

interface MarketsResponse {
    markets: Array<{
        id: number;
        question: string;
        category: string;
        status: string;
        ai_prediction: number | null;
        ai_confidence: number | null;
    }>;
}

interface StatsResponse {
    stats: {
        totalMarkets: number;
        activeMarkets: number;
        resolvedMarkets: number;
        totalTrades: number;
        totalUsers: number;
    };
}

export default function HomePage() {
    const { data: marketsData } = useApi<MarketsResponse>('/markets?status=active&limit=2');
    const { data: statsData } = useApi<StatsResponse>('/stats');
    const stats = statsData?.stats;
    const markets = marketsData?.markets || [];

    return (
        <div>
            {/* Hero */}
            <section style={s.hero}>
                {/* Grid background */}
                <div style={s.gridBg} />
                {/* Gold glow */}
                <div style={s.glow} />

                <div className="container" style={{ position: 'relative', zIndex: 2 }}>
                    <div style={s.heroGrid}>
                        {/* Left column */}
                        <div style={s.heroLeft}>
                            <div style={s.badge}>
                                <span style={s.badgeDot} />
                                Bitcoin-Native Protocol &middot; Testnet Live
                            </div>
                            <h1 style={s.title}>
                                Predict outcomes.
                                <br />
                                <span style={s.titleAccent}>Fund your</span>
                                <br />
                                thesis.
                            </h1>
                            <p style={s.subtitle}>
                                The first prediction market where your positions become collateral.
                                Trade with AMM pricing, borrow tUSDT against your YES/NO tokens,
                                and compete with Bob the AI oracle — all trustlessly on Bitcoin L1.
                            </p>
                            <div style={s.ctas}>
                                <Link to="/explore" style={{ textDecoration: 'none' }}>
                                    <button style={s.ctaPrimary}>
                                        EXPLORE MARKETS
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </Link>
                                <Link to="/lending" style={{ textDecoration: 'none' }}>
                                    <button style={s.ctaGhost}>BORROW tUSDT</button>
                                </Link>
                            </div>
                        </div>

                        {/* Right column — live market cards (show first 2) */}
                        <div style={s.heroRight}>
                            {markets.slice(0, 2).map((m) => (
                                <MarketCard
                                    key={m.id}
                                    id={m.id}
                                    question={m.question}
                                    category={m.category}
                                    status={m.status}
                                    aiPrediction={m.ai_prediction}
                                    aiConfidence={m.ai_confidence}
                                />
                            ))}
                            {markets.length === 0 && (
                                <div style={s.heroPlaceholder}>
                                    <p style={{ color: '#6b6b5e', fontSize: 12 }}>Markets loading...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats strip */}
                    <div style={s.statsStrip}>
                        {[
                            { label: 'Active Markets', value: stats?.activeMarkets || 0 },
                            { label: 'Total Trades', value: stats?.totalTrades || 0 },
                            { label: 'Max LTV', value: '60%' },
                            { label: 'Predictors', value: stats?.totalUsers || 0 },
                        ].map((stat, i) => (
                            <div key={stat.label} style={{ ...s.statItem, borderLeft: i === 0 ? 'none' : '1px solid rgba(245,200,66,0.15)' }}>
                                <span style={s.statVal}>{stat.value}</span>
                                <span style={s.statLabel}>{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Ticker */}
            <div style={s.ticker}>
                <div style={s.tickerTrack}>
                    {[1, 2].map((n) => (
                        <span key={n} style={s.tickerContent}>
                            Prediction Markets &diams; Collateralized Lending &diams; Bitcoin Native &diams; AI Oracle &diams; OP_NET Powered &diams; CPMM AMM &diams; Trustless &diams;&nbsp;
                        </span>
                    ))}
                </div>
            </div>

            <div className="container">
                {/* How It Works */}
                <section style={s.section}>
                    <div style={s.sectionLabel}>// How It Works</div>
                    <h2 style={s.sectionTitle}>
                        Four steps.
                        <br />
                        <span style={{ color: '#6b6b5e' }}>Full liquidity.</span>
                    </h2>
                    <div style={s.flowGrid}>
                        {[
                            { n: '01', title: 'Open a Position', desc: 'Browse markets on crypto, politics, sports, tech. Buy YES or NO tokens via AMM.' },
                            { n: '02', title: 'Collateralize It', desc: 'Deposit your prediction tokens as collateral in the lending protocol.' },
                            { n: '03', title: 'Borrow tUSDT', desc: 'Borrow up to 60% LTV against your position. Instant liquidity.' },
                            { n: '04', title: 'Oracle Resolves', desc: 'AI + admin resolution. Winning tokens redeem 1:1. Repay loans to unlock.' },
                        ].map((item, i) => (
                            <div key={item.n} style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                                <div style={s.flowStep}>
                                    <div style={s.flowNum}>{item.n}</div>
                                    <h3 style={s.flowTitle}>{item.title}</h3>
                                    <p style={s.flowDesc}>{item.desc}</p>
                                </div>
                                {i < 3 && <div style={s.flowArrow}>&rarr;</div>}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Why Thesis */}
                <section style={s.section}>
                    <div style={s.sectionLabel}>// Why Thesis</div>
                    <h2 style={s.sectionTitle}>Built Different.</h2>
                    <div style={s.featureGrid}>
                        {[
                            {
                                icon: '\u20BF',
                                title: 'Bitcoin Native',
                                desc: 'Runs directly on Bitcoin L1 via OP_NET. Not a sidechain, not an L2. Real Bitcoin security.',
                            },
                            {
                                icon: '\u2B21',
                                title: 'AI Oracle',
                                desc: 'Bob AI predicts every market using Claude. Track accuracy on the leaderboard.',
                            },
                            {
                                icon: '\u25C8',
                                title: 'Positions as Collateral',
                                desc: 'The first prediction market with built-in lending. Use your YES/NO tokens as collateral to borrow tUSDT — unlocking liquidity without closing positions.',
                            },
                        ].map((f) => (
                            <div key={f.title} style={s.featureCard}>
                                <div style={s.featureIcon}>{f.icon}</div>
                                <h3 style={s.featureTitle}>{f.title}</h3>
                                <p style={s.featureDesc}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    /* ─── Hero ─── */
    hero: {
        position: 'relative',
        padding: '80px 0 0',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(245,200,66,0.15)',
    },
    gridBg: {
        position: 'absolute',
        inset: 0,
        backgroundImage:
            'linear-gradient(rgba(245,200,66,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.03) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        zIndex: 0,
    },
    glow: {
        position: 'absolute',
        top: '-200px',
        right: '-200px',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(245,200,66,0.06) 0%, transparent 70%)',
        zIndex: 0,
    },
    heroGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 64,
        alignItems: 'center',
    },
    heroLeft: {},
    heroRight: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
    },
    heroPlaceholder: {
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 48,
        textAlign: 'center' as const,
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        border: '1px solid rgba(245,200,66,0.15)',
        color: '#f5c842',
        fontSize: 10,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        marginBottom: 32,
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#4ade80',
        boxShadow: '0 0 8px rgba(74,222,128,0.6)',
        animation: 'pulse 2s ease-in-out infinite',
    },
    title: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 'clamp(48px, 5.5vw, 80px)' as string,
        fontWeight: 800,
        lineHeight: 1.02,
        letterSpacing: '-0.03em',
        color: '#f0ede6',
        marginBottom: 24,
    },
    titleAccent: {
        color: '#f5c842',
    },
    subtitle: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 14,
        color: '#6b6b5e',
        lineHeight: 1.7,
        marginBottom: 40,
        maxWidth: 460,
    },
    ctas: {
        display: 'flex',
        gap: 12,
    },
    ctaPrimary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 32px',
        background: '#f5c842',
        color: '#0a0a08',
        border: 'none',
        fontSize: 12,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        cursor: 'pointer',
    },
    ctaGhost: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 32px',
        background: 'transparent',
        color: '#6b6b5e',
        border: '1px solid rgba(245,200,66,0.15)',
        fontSize: 12,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        cursor: 'pointer',
    },

    /* ─── Stats strip ─── */
    statsStrip: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        marginTop: 64,
        borderTop: '1px solid rgba(245,200,66,0.15)',
    },
    statItem: {
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
    },
    statVal: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 32,
        fontWeight: 800,
        color: '#f0ede6',
    },
    statLabel: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: '#6b6b5e',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.12em',
    },

    /* ─── Ticker ─── */
    ticker: {
        background: '#f5c842',
        overflow: 'hidden',
        padding: '10px 0',
        whiteSpace: 'nowrap' as const,
    },
    tickerTrack: {
        display: 'inline-flex',
        animation: 'ticker 20s linear infinite',
    },
    tickerContent: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        color: '#0a0a08',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
    },

    /* ─── Sections ─── */
    section: {
        padding: '64px 0',
        borderBottom: '1px solid rgba(245,200,66,0.08)',
    },
    sectionLabel: {
        fontSize: 11,
        letterSpacing: '0.16em',
        color: '#f5c842',
        textTransform: 'uppercase' as const,
        marginBottom: 16,
        fontFamily: "'DM Mono', monospace",
    },
    sectionTitle: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 36,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: '#f0ede6',
        marginBottom: 8,
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    viewAllBtn: {
        background: 'transparent',
        color: '#6b6b5e',
        border: '1px solid rgba(245,200,66,0.15)',
        padding: '8px 20px',
        fontSize: 11,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.06em',
        cursor: 'pointer',
    },

    /* ─── Flow / How It Works ─── */
    flowGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        marginTop: 40,
    },
    flowStep: {
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        flex: 1,
        position: 'relative' as const,
    },
    flowNum: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 48,
        fontWeight: 800,
        color: 'rgba(245,200,66,0.1)',
        lineHeight: 1,
    },
    flowTitle: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color: '#f0ede6',
        letterSpacing: '-0.01em',
    },
    flowDesc: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        color: '#6b6b5e',
        lineHeight: 1.6,
    },
    flowArrow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f5c842',
        fontSize: 20,
        fontWeight: 700,
        padding: '0 8px',
    },

    /* ─── Features ─── */
    featureGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 2,
        marginTop: 40,
    },
    featureCard: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 32,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 16,
    },
    featureIcon: {
        width: 48,
        height: 48,
        border: '1px solid rgba(245,200,66,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        color: '#f5c842',
    },
    featureTitle: {
        fontFamily: "'Syne', sans-serif",
        fontSize: 16,
        fontWeight: 700,
        color: '#f0ede6',
    },
    featureDesc: {
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        color: '#6b6b5e',
        lineHeight: 1.7,
    },

    /* ─── Empty state ─── */
    empty: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 48,
        textAlign: 'center' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 16,
    },
};
