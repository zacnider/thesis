import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useAPI';
import TradingPanel from '../components/market/TradingPanel';
import type { CSSProperties } from 'react';

interface MarketResponse {
    market: {
        id: number;
        question: string;
        description: string;
        category: string;
        status: string;
        end_block: number;
        market_address: string;
        yes_token: string;
        no_token: string;
        collateral_token: string;
        creator: string;
        created_at: string;
        winning_outcome: number | null;
        ai_prediction: number | null;
        ai_confidence: number | null;
        ai_reasoning: string | null;
    };
}

interface TradesResponse {
    trades: Array<{
        id: number;
        trader: string;
        side: string;
        action: string;
        collateral_amount: string;
        token_amount: string;
        price: string;
        tx_hash: string;
        created_at: string;
    }>;
}

export default function MarketDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: marketData, loading } = useApi<MarketResponse>(`/markets/${id}`);
    const { data: tradesData } = useApi<TradesResponse>(`/markets/${id}/trades`);

    const aiConf = marketData?.market?.ai_confidence;
    const aiPred = marketData?.market?.ai_prediction;
    const initialYes = (aiConf && aiPred)
        ? (aiPred === 1 ? aiConf / 100 : (100 - aiConf) / 100)
        : 0.5;

    const [yesPrice, setYesPrice] = useState(initialYes);
    const [noPrice, setNoPrice] = useState(1 - initialYes);

    const handlePriceUpdate = useCallback((yp: number, np: number) => {
        setYesPrice(yp);
        setNoPrice(np);
    }, []);

    const market = marketData?.market;
    const trades = tradesData?.trades || [];
    const yesPercent = Math.round(yesPrice * 100);
    const noPercent = Math.round(noPrice * 100);

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <p style={{ color: '#6b6b5e', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading market...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!market) {
        return (
            <div className="page">
                <div className="container">
                    <div style={s.emptyCard}>
                        <h2 style={{ fontSize: 18, fontFamily: "'Syne', sans-serif", fontWeight: 800, marginBottom: 8 }}>MARKET NOT FOUND</h2>
                        <p style={{ color: '#6b6b5e', marginBottom: 20, fontSize: 12, fontFamily: "'DM Mono', monospace" }}>This market doesn't exist or has been removed.</p>
                        <Link to="/explore" style={{ textDecoration: 'none' }}>
                            <button className="btn btn-primary">EXPLORE MARKETS</button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div style={s.bread}>
                    <Link to="/explore" style={{ color: '#6b6b5e', textDecoration: 'none', fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>MARKETS</Link>
                    <span style={{ color: '#6b6b5e' }}>/</span>
                    <span style={{ color: '#f5c842', fontSize: 11, textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>{market.category}</span>
                </div>

                <div style={s.layout}>
                    <div style={s.main}>
                        {/* Market info */}
                        <div style={s.card}>
                            <div style={s.cardInner}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                    <span style={{
                                        ...s.statusBadge,
                                        color: market.status === 'active' ? '#4ade80' : '#6366f1',
                                        borderColor: market.status === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(99,102,241,0.2)',
                                    }}>
                                        {market.status === 'active' && <span style={s.liveDot} />}
                                        {market.status.toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#6b6b5e', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace" }}>{market.category}</span>
                                </div>

                                <h1 style={s.question}>{market.question}</h1>
                                {market.description && <p style={s.desc}>{market.description}</p>}

                                {/* Probability */}
                                <div style={s.probArea}>
                                    <div style={s.probSide}>
                                        <div style={{ ...s.probBox, border: '1px solid rgba(74,222,128,0.2)' }}>
                                            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#4ade80' }}>{yesPercent}%</span>
                                        </div>
                                        <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>YES</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="probability-bar" style={{ height: 6 }}>
                                            <div className="yes-fill" style={{ width: `${yesPercent}%` }} />
                                            <div className="no-fill" style={{ width: `${noPercent}%` }} />
                                        </div>
                                    </div>
                                    <div style={s.probSide}>
                                        <div style={{ ...s.probBox, border: '1px solid rgba(248,113,113,0.2)' }}>
                                            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f87171' }}>{noPercent}%</span>
                                        </div>
                                        <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>NO</span>
                                    </div>
                                </div>

                                {/* Meta */}
                                <div style={s.meta}>
                                    {[
                                        { label: 'Created', value: new Date(market.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                                        { label: 'End Block', value: `#${market.end_block.toLocaleString()}` },
                                        { label: 'Creator', value: market.creator.slice(0, 14) + '...', mono: true },
                                        ...(market.market_address ? [{ label: 'Contract', value: market.market_address.slice(0, 14) + '...', mono: true }] : []),
                                    ].map(item => (
                                        <div key={item.label} style={s.metaItem}>
                                            <span style={s.metaLabel}>{item.label.toUpperCase()}</span>
                                            <span style={{ ...s.metaVal, ...((item as any).mono ? { fontFamily: "'DM Mono', monospace", fontSize: 11 } : {}) }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* AI Card */}
                        {market.ai_prediction !== null && market.ai_prediction !== undefined && (
                            <div style={{ ...s.card, borderColor: 'rgba(245,200,66,0.15)' }}>
                                <div style={s.cardInner}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <div style={s.aiIcon}>
                                            <span style={{ fontSize: 18, color: '#f5c842' }}>&#x2B21;</span>
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: '0.04em' }}>BOB AI PREDICTION</h3>
                                            <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>Powered by Claude AI</span>
                                        </div>
                                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#f5c842', border: '1px solid rgba(245,200,66,0.15)', padding: '4px 10px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>
                                            {market.ai_confidence}% CONFIDENT
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'inline-flex', padding: '8px 20px',
                                        fontSize: 16, fontWeight: 800, fontFamily: "'Syne', sans-serif",
                                        letterSpacing: '0.08em',
                                        border: `1px solid ${market.ai_prediction === 1 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                                        color: market.ai_prediction === 1 ? '#4ade80' : '#f87171',
                                    }}>
                                        {market.ai_prediction === 1 ? 'YES' : 'NO'}
                                    </div>

                                    {market.ai_reasoning && (
                                        <p style={{ color: '#6b6b5e', fontSize: 12, lineHeight: 1.7, marginTop: 16, paddingLeft: 14, borderLeft: '2px solid rgba(245,200,66,0.15)', fontFamily: "'DM Mono', monospace" }}>
                                            {market.ai_reasoning}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Trades */}
                        <div style={s.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(245,200,66,0.08)' }}>
                                <h3 style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em' }}>RECENT ACTIVITY</h3>
                                <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>{trades.length} trades</span>
                            </div>
                            {trades.length > 0 ? (
                                <div>
                                    {trades.slice(0, 20).map((t) => (
                                        <div key={t.id} style={s.tradeRow}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{
                                                    padding: '3px 8px', fontSize: 10, fontWeight: 700,
                                                    border: `1px solid ${t.side === 'YES' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                                                    color: t.side === 'YES' ? '#4ade80' : '#f87171',
                                                    fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em',
                                                }}>
                                                    {t.action?.toUpperCase() || 'BUY'} {t.side}
                                                </span>
                                                <span style={{ fontSize: 11, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>{t.trader.slice(0, 10)}...</span>
                                            </div>
                                            <div style={{ textAlign: 'right' as const }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace", color: '#f0ede6' }}>{Number(t.collateral_amount).toLocaleString()} tUSDT</div>
                                                <div style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: 40, textAlign: 'center' as const, color: '#6b6b5e', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                    No trades yet. Be the first to trade!
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={s.sidebar}>
                        <TradingPanel
                            marketAddress={market.market_address}
                            yesTokenAddress={market.yes_token}
                            noTokenAddress={market.no_token}
                            collateralTokenAddress={market.collateral_token}
                            yesPrice={yesPrice}
                            noPrice={noPrice}
                            resolved={market.status === 'resolved'}
                            onPriceUpdate={handlePriceUpdate}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    emptyCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 48, textAlign: 'center' },
    bread: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
    layout: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' },
    main: { display: 'flex', flexDirection: 'column', gap: 16 },
    sidebar: { position: 'sticky', top: 82 },
    card: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', overflow: 'hidden' },
    cardInner: { padding: 24 },
    statusBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" },
    liveDot: { display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.5)' },
    question: { fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 8, fontFamily: "'Syne', sans-serif", color: '#f0ede6', letterSpacing: '-0.02em' },
    desc: { color: '#6b6b5e', fontSize: 12, lineHeight: 1.7, marginBottom: 8, fontFamily: "'DM Mono', monospace" },
    probArea: { display: 'flex', alignItems: 'center', gap: 20, padding: '20px 0' },
    probSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 68 },
    probBox: { width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    meta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, paddingTop: 16, borderTop: '1px solid rgba(245,200,66,0.08)' },
    metaItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', background: 'rgba(245,200,66,0.02)' },
    metaLabel: { fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' },
    metaVal: { fontSize: 12, color: '#f0ede6', fontWeight: 500, fontFamily: "'Syne', sans-serif" },
    aiIcon: { width: 36, height: 36, border: '1px solid rgba(245,200,66,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    tradeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid rgba(245,200,66,0.06)' },
};
