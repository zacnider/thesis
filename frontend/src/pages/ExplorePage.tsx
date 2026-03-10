import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { useApi, apiPost } from '../hooks/useAPI';
import { useProvider } from '../context/ProviderContext';
import { OP20_ABI } from '../config/abis';
import MarketCard from '../components/market/MarketCard';
import { CATEGORIES } from '../config/constants';
import type { CSSProperties } from 'react';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;

interface MarketItem {
    id: number;
    question: string;
    category: string;
    status: string;
    ai_prediction: number | null;
    ai_confidence: number | null;
    yes_token: string;
    no_token: string;
    market_address: string;
}

interface MarketsResponse {
    markets: MarketItem[];
}

export default function ExplorePage() {
    const navigate = useNavigate();
    const { address, network, walletAddress, openConnectModal } = useWalletConnect();
    const provider = useProvider();
    const net = network || opnetTestnet;
    const [status, setStatus] = useState('');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [myOnly, setMyOnly] = useState(false);
    const [positionIds, setPositionIds] = useState<Set<number>>(new Set());
    const [scanning, setScanning] = useState(false);

    // Create Market modal state
    const [showModal, setShowModal] = useState(false);
    const [cmQuestion, setCmQuestion] = useState('');
    const [cmDescription, setCmDescription] = useState('');
    const [cmCategory, setCmCategory] = useState('general');
    const [cmEndBlock, setCmEndBlock] = useState('');
    const [cmLoading, setCmLoading] = useState(false);
    const [cmError, setCmError] = useState('');

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    params.set('limit', '50');

    const { data, loading } = useApi<MarketsResponse>(`/markets?${params}`, [status, category]);
    const allMarkets = (data?.markets || []).filter(
        (m) => !search || m.question.toLowerCase().includes(search.toLowerCase()),
    );

    // Scan on-chain balances to find user positions
    const scanPositions = useCallback(async () => {
        if (!address || !provider || !data?.markets) return;
        setScanning(true);
        const ids = new Set<number>();
        for (const m of data.markets) {
            if (!m.yes_token && !m.no_token) continue;
            try {
                for (const tokenAddr of [m.yes_token, m.no_token]) {
                    if (!tokenAddr) continue;
                    const contract = getContract(tokenAddr, OP20_ABI as any, provider, net) as any;
                    const result = await contract.balanceOf(address);
                    const bal = result?.properties?.balance;
                    if (bal !== undefined && bal !== null && BigInt(bal.toString()) > 0n) {
                        ids.add(m.id);
                        break;
                    }
                }
            } catch {}
        }
        setPositionIds(ids);
        setScanning(false);
    }, [address, provider, data?.markets, net]);

    useEffect(() => {
        if (address && data?.markets) {
            scanPositions();
        } else {
            setPositionIds(new Set());
        }
    }, [address, data?.markets, scanPositions]);

    // ESC to close modal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowModal(false);
        };
        if (showModal) {
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
        }
    }, [showModal]);

    const markets = myOnly ? allMarkets.filter(m => positionIds.has(m.id)) : allMarkets;
    const posCount = positionIds.size;

    const openModal = () => {
        setCmQuestion('');
        setCmDescription('');
        setCmCategory('general');
        setCmEndBlock('');
        setCmError('');
        setShowModal(true);
    };

    const handleCreateMarket = async () => {
        if (!walletAddress) { openConnectModal(); return; }
        if (!cmQuestion.trim()) return setCmError('Question is required');
        if (cmQuestion.length < 10) return setCmError('Question must be at least 10 characters');
        if (!cmEndBlock) return setCmError('End block is required');

        setCmLoading(true);
        setCmError('');
        try {
            const result = await apiPost<{ marketId: number }>('/markets', {
                question: cmQuestion.trim(),
                description: cmDescription.trim(),
                category: cmCategory,
                endBlock: parseInt(cmEndBlock),
                collateralToken: 'native',
                creator: walletAddress,
            });
            setShowModal(false);
            navigate(`/market/${result.marketId}`);
        } catch (err) {
            setCmError(err instanceof Error ? err.message : 'Failed to create market');
        } finally {
            setCmLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div style={s.sectionLabel}>// Explore Markets</div>
                <div style={s.header}>
                    <div>
                        <h1 className="page-title">Explore Markets</h1>
                        <p className="page-subtitle">Browse and trade prediction markets on Bitcoin L1</p>
                    </div>
                    <div style={s.headerRight}>
                        <button style={s.createBtn} onClick={openModal}>
                            + CREATE MARKET
                        </button>
                        <div style={s.count}>
                            <span style={s.countNum}>{markets.length}</span>
                            <span style={s.countLabel}>MARKETS</span>
                        </div>
                    </div>
                </div>

                <div style={s.searchWrap}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b5e" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        className="input"
                        placeholder="Search markets..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 40 }}
                    />
                </div>

                <div style={s.filters}>
                    <div style={s.pills}>
                        <button style={{ ...s.pill, ...(category === '' && !myOnly ? s.pillOn : {}) }} onClick={() => { setCategory(''); setMyOnly(false); }}>ALL</button>
                        {address && (
                            <button
                                style={{ ...s.pill, ...(myOnly ? s.myPillOn : {}) }}
                                onClick={() => setMyOnly(!myOnly)}
                            >
                                {scanning ? 'SCANNING...' : `MY POSITIONS${posCount > 0 ? ` (${posCount})` : ''}`}
                            </button>
                        )}
                        {CATEGORIES.map((c) => (
                            <button key={c} style={{ ...s.pill, ...(category === c ? s.pillOn : {}) }} onClick={() => { setCategory(category === c ? '' : c); setMyOnly(false); }}>
                                {c.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div style={s.tabs}>
                        {[
                            { value: '', label: 'ALL' },
                            { value: 'active', label: 'ACTIVE' },
                            { value: 'resolved', label: 'RESOLVED' },
                        ].map((t) => (
                            <button key={t.value} style={{ ...s.tab, ...(status === t.value ? s.tabOn : {}) }} onClick={() => setStatus(t.value)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="market-grid">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="loading-pulse" style={s.skel} />
                        ))}
                    </div>
                ) : markets.length > 0 ? (
                    <div className="market-grid">
                        {markets.map((m) => (
                            <MarketCard
                                key={m.id}
                                id={m.id}
                                question={m.question}
                                category={m.category}
                                status={m.status}
                                aiPrediction={m.ai_prediction}
                                aiConfidence={m.ai_confidence}
                                hasPosition={positionIds.has(m.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={s.empty}>
                        <p style={{ color: '#6b6b5e', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                            {myOnly ? 'You have no positions in any markets yet.' : search ? `No markets matching "${search}"` : 'No markets in this category yet.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Create Market Modal */}
            {showModal && (
                <div style={s.overlay} onClick={() => setShowModal(false)}>
                    <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={s.modalHeader}>
                            <div>
                                <div style={s.sectionLabel}>// Create Market</div>
                                <h2 style={s.modalTitle}>Create Market</h2>
                            </div>
                            <button style={s.closeBtn} onClick={() => setShowModal(false)}>X</button>
                        </div>

                        <div style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>
                                    QUESTION
                                    <span style={s.charCount}>{cmQuestion.length}/200</span>
                                </label>
                                <input
                                    className="input"
                                    placeholder="Will Bitcoin reach $200K by end of 2026?"
                                    value={cmQuestion}
                                    onChange={(e) => setCmQuestion(e.target.value.slice(0, 200))}
                                    style={{ fontSize: 14, padding: '12px 14px' }}
                                />
                                <span style={s.hint}>Write a clear yes/no question that can be objectively resolved</span>
                            </div>

                            <div style={s.field}>
                                <label style={s.label}>DESCRIPTION</label>
                                <textarea
                                    className="input"
                                    placeholder="Add resolution criteria and context..."
                                    value={cmDescription}
                                    onChange={(e) => setCmDescription(e.target.value)}
                                    style={{ minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
                                />
                            </div>

                            <div style={s.field}>
                                <label style={s.label}>CATEGORY</label>
                                <div style={s.catGrid}>
                                    {CATEGORIES.map((c) => (
                                        <button
                                            key={c}
                                            style={{ ...s.catBtn, ...(cmCategory === c ? s.catBtnOn : {}) }}
                                            onClick={() => setCmCategory(c)}
                                            type="button"
                                        >
                                            {c.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={s.field}>
                                <label style={s.label}>RESOLUTION BLOCK</label>
                                <input
                                    className="input"
                                    type="number"
                                    placeholder="e.g. 900000"
                                    value={cmEndBlock}
                                    onChange={(e) => setCmEndBlock(e.target.value)}
                                />
                                <span style={s.hint}>Market ends at this Bitcoin block height</span>
                            </div>

                            {cmQuestion && (
                                <div style={s.preview}>
                                    <span style={s.previewLabel}>PREVIEW</span>
                                    <div style={s.previewCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <span style={{ fontSize: 10, color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', padding: '3px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>ACTIVE</span>
                                            <span style={{ fontSize: 10, color: '#6b6b5e', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>{cmCategory}</span>
                                        </div>
                                        <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, fontFamily: "'Syne', sans-serif", color: '#f0ede6' }}>{cmQuestion}</p>
                                        <div style={{ height: 4, background: '#1a1a17', overflow: 'hidden' }}>
                                            <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, #e8a820, #f5c842)' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
                                            <span style={{ color: '#f5c842' }}>YES 50%</span>
                                            <span style={{ color: '#f87171' }}>NO 50%</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {cmError && (
                                <div style={s.error}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    {cmError}
                                </div>
                            )}

                            {walletAddress ? (
                                <button style={s.submitBtn} onClick={handleCreateMarket} disabled={cmLoading}>
                                    {cmLoading ? 'CREATING...' : 'CREATE MARKET'}
                                </button>
                            ) : (
                                <button style={s.submitBtn} onClick={openConnectModal}>
                                    CONNECT WALLET TO CREATE
                                </button>
                            )}

                            {walletAddress && (
                                <p style={{ fontSize: 10, color: '#6b6b5e', textAlign: 'center' as const, fontFamily: "'DM Mono', monospace", margin: 0 }}>
                                    Creating as: <span style={{ color: '#f0ede6' }}>
                                        {walletAddress.slice(0, 14)}...{walletAddress.slice(-6)}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    sectionLabel: { fontSize: 11, letterSpacing: '0.16em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'DM Mono', monospace" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 },
    count: { display: 'flex', alignItems: 'baseline', gap: 6 },
    countNum: { fontSize: 24, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f5c842' },
    countLabel: { fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' },
    createBtn: { padding: '10px 20px', background: '#f5c842', color: '#0a0a08', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em' },
    searchWrap: { position: 'relative', marginBottom: 16 },
    filters: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12, marginBottom: 24 },
    pills: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
    pill: { padding: '7px 14px', background: 'transparent', border: '1px solid rgba(245,200,66,0.12)', color: '#6b6b5e', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' },
    pillOn: { background: 'rgba(245,200,66,0.08)', borderColor: 'rgba(245,200,66,0.25)', color: '#f5c842' },
    myPillOn: { background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80' },
    tabs: { display: 'flex', gap: 0, border: '1px solid rgba(245,200,66,0.12)' },
    tab: { padding: '7px 16px', fontSize: 11, fontWeight: 700, background: 'transparent', border: 'none', color: '#6b6b5e', cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' },
    tabOn: { background: 'rgba(245,200,66,0.1)', color: '#f0ede6' },
    skel: { height: 240, background: '#111110', border: '1px solid rgba(245,200,66,0.08)' },
    empty: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 48, textAlign: 'center' },
    // Modal styles
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 },
    modal: { background: '#111110', border: '1px solid rgba(245,200,66,0.25)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' as const },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 0 24px' },
    modalTitle: { fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f0ede6', margin: '4px 0 0 0' },
    closeBtn: { background: 'transparent', border: '1px solid rgba(245,200,66,0.2)', color: '#6b6b5e', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 10px', fontFamily: "'DM Mono', monospace" },
    form: { padding: 24, display: 'flex', flexDirection: 'column', gap: 18 },
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 10, fontWeight: 700, color: '#6b6b5e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace" },
    charCount: { fontSize: 10, color: '#6b6b5e', fontWeight: 400 },
    hint: { fontSize: 10, color: '#6b6b5e', lineHeight: 1.4, fontFamily: "'DM Mono', monospace" },
    catGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 },
    catBtn: { padding: '10px 8px', background: 'transparent', border: '1px solid rgba(245,200,66,0.12)', color: '#6b6b5e', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.04em' },
    catBtnOn: { background: 'rgba(245,200,66,0.08)', borderColor: 'rgba(245,200,66,0.25)', color: '#f5c842' },
    preview: { display: 'flex', flexDirection: 'column', gap: 6 },
    previewLabel: { fontSize: 10, color: '#6b6b5e', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace" },
    previewCard: { padding: 16, background: '#0a0a08', border: '1px solid rgba(245,200,66,0.08)' },
    error: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(248,113,113,0.06)', color: '#f87171', fontSize: 11, border: '1px solid rgba(248,113,113,0.15)', fontFamily: "'DM Mono', monospace" },
    submitBtn: { width: '100%', padding: 14, fontSize: 12, fontWeight: 700, background: '#f5c842', color: '#0a0a08', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em' },
};
