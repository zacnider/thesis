import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { useApi } from '../hooks/useAPI';
import { useProvider } from '../context/ProviderContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { OP20_ABI } from '../config/abis';
import type { CSSProperties } from 'react';

import { API_BASE } from '../config/constants';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;

interface MarketWithLending {
    id: number;
    question: string;
    category: string;
    status: string;
    lending_pool_address: string;
    lending_pool_pub_key: string;
    yes_token: string;
    no_token: string;
    ai_prediction: number | null;
    ai_confidence: number | null;
}

function formatAmount(val: bigint): string {
    const num = Number(val) / 1e18;
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.01) return num.toFixed(4);
    return num.toFixed(6);
}

export default function LendingPage() {
    const { walletAddress, openConnectModal, address, network } = useWalletConnect();
    const provider = useProvider();
    const net = network || opnetTestnet;
    const { data: marketsData } = useApi<{ markets: MarketWithLending[] }>('/markets?limit=50', []);
    const [selectedMarket, setSelectedMarket] = useState<MarketWithLending | null>(null);
    const [tab, setTab] = useState<'deposit' | 'borrow' | 'repay' | 'withdraw'>('deposit');
    const [amount, setAmount] = useState('');
    const [isYes, setIsYes] = useState(true);
    const [userPositions, setUserPositions] = useState<any[]>([]);
    const [myPoolIds, setMyPoolIds] = useState<Set<number>>(new Set());
    const [myPoolsOnly, setMyPoolsOnly] = useState(false);
    const [poolScanning, setPoolScanning] = useState(false);

    const { balance: yesBalance } = useTokenBalance(selectedMarket?.yes_token || undefined, address, net);
    const { balance: noBalance } = useTokenBalance(selectedMarket?.no_token || undefined, address, net);
    const fmtBal = (v: bigint) => (Number(v) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });

    const lendingMarkets = (marketsData?.markets || []).filter(m => m.lending_pool_address);

    const {
        loading, error, lendingStatus, resetStatus,
        position, poolInfo,
        depositCollateral, borrow, repay, withdrawCollateral,
    } = useLendingPool(
        selectedMarket?.lending_pool_address,
        selectedMarket?.yes_token,
        selectedMarket?.no_token,
    );

    useEffect(() => {
        if (!walletAddress) return;
        fetch(`${API_BASE}/users/${walletAddress}/lending`)
            .then(r => r.json())
            .then(d => setUserPositions(d.positions || []))
            .catch(() => {});
    }, [walletAddress]);

    // Scan on-chain holdings across all lending pools
    const scanMyPools = useCallback(async () => {
        if (!address || !provider || !marketsData?.markets) return;
        setPoolScanning(true);
        const ids = new Set<number>();
        for (const m of marketsData.markets) {
            if (!m.lending_pool_address) continue;
            for (const tokenAddr of [m.yes_token, m.no_token]) {
                if (!tokenAddr) continue;
                try {
                    const contract = getContract(tokenAddr, OP20_ABI as any, provider, net) as any;
                    const result = await contract.balanceOf(address);
                    const bal = result?.properties?.balance;
                    if (bal !== undefined && bal !== null && BigInt(bal.toString()) > 0n) {
                        ids.add(m.id);
                        break;
                    }
                } catch {}
            }
        }
        // Also include markets with active lending positions from API
        for (const pos of userPositions) {
            if (pos.status === 'active') ids.add(pos.market_id);
        }
        setMyPoolIds(ids);
        setPoolScanning(false);
    }, [address, provider, marketsData?.markets, net, userPositions]);

    useEffect(() => {
        if (address && marketsData?.markets) scanMyPools();
        else setMyPoolIds(new Set());
    }, [address, marketsData?.markets, scanMyPools]);

    const handleAction = async () => {
        if (!amount) return;
        const amt = BigInt(Math.floor(parseFloat(amount) * 1e18));
        if (amt <= 0n) return;
        if (tab === 'deposit') await depositCollateral(isYes, amt);
        else if (tab === 'borrow') await borrow(amt);
        else if (tab === 'repay') await repay(amt);
        else if (tab === 'withdraw') await withdrawCollateral(isYes, amt);
        setAmount('');
    };

    if (!walletAddress) {
        return (
            <div className="page">
                <div className="container">
                    <div style={s.connectBox}>
                        <div style={{ fontSize: 36, color: '#f5c842', marginBottom: 16 }}>&#x25C8;</div>
                        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#f0ede6', marginBottom: 8 }}>PREDICTION LENDING</h2>
                        <p style={{ color: '#6b6b5e', fontSize: 12, marginBottom: 24, maxWidth: 400, textAlign: 'center' as const, lineHeight: 1.6, fontFamily: "'DM Mono', monospace" }}>
                            Use YES/NO tokens as collateral to borrow tUSDT. First lending protocol on Bitcoin prediction markets.
                        </p>
                        <button style={s.goldBtn} onClick={openConnectModal}>CONNECT WALLET</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div style={s.top}>
                    <div style={s.sectionLabel}>// Borrow Interface</div>
                    <h1 className="page-title">Prediction Lending</h1>
                    <p className="page-subtitle">Borrow against your prediction positions</p>
                </div>

                <div style={s.stats}>
                    {[
                        { label: 'Pools', value: lendingMarkets.length.toString() },
                        { label: 'Positions', value: userPositions.filter(p => p.status === 'active').length.toString() },
                        { label: 'LTV', value: poolInfo ? `${(Number(poolInfo.ltvNumerator) / 100).toFixed(0)}%` : '—' },
                        { label: 'APY', value: poolInfo ? `${(Number(poolInfo.interestRate) / 100).toFixed(1)}%` : '—' },
                    ].map(st => (
                        <div key={st.label} style={s.statCard}>
                            <span style={s.statLabel}>{st.label}</span>
                            <span style={s.statVal}>{st.value}</span>
                        </div>
                    ))}
                </div>

                <div style={s.grid}>
                    <div style={s.left}>
                        <div style={s.card}>
                            <div style={{ ...s.cardHead, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>LENDING POOLS</span>
                                {address && myPoolIds.size > 0 && (
                                    <button
                                        onClick={() => setMyPoolsOnly(!myPoolsOnly)}
                                        style={{ ...s.myPoolsBtn, ...(myPoolsOnly ? s.myPoolsBtnOn : {}) }}
                                    >
                                        {poolScanning ? 'SCANNING...' : `MY POOLS (${myPoolIds.size})`}
                                    </button>
                                )}
                            </div>
                            {lendingMarkets.length === 0 ? (
                                <p style={{ color: '#6b6b5e', fontSize: 12, padding: '16px 20px', fontFamily: "'DM Mono', monospace" }}>No lending pools deployed yet.</p>
                            ) : (
                                <div style={{ maxHeight: 340, overflowY: 'auto' as const }}>
                                    {[...lendingMarkets]
                                        .filter(m => !myPoolsOnly || myPoolIds.has(m.id))
                                        .sort((a, b) => {
                                            const aHas = myPoolIds.has(a.id) ? 1 : 0;
                                            const bHas = myPoolIds.has(b.id) ? 1 : 0;
                                            return bHas - aHas;
                                        })
                                        .map(m => (
                                        <div key={m.id} onClick={() => { setSelectedMarket(m); resetStatus(); }} style={{ ...s.poolItem, ...(selectedMarket?.id === m.id ? s.poolSel : {}), ...(myPoolIds.has(m.id) ? { borderLeft: '3px solid #4ade80' } : {}) }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 12, color: '#f0ede6', lineHeight: 1.4, fontFamily: "'Syne', sans-serif", fontWeight: 600, flex: 1 }}>{m.question}</span>
                                                {myPoolIds.has(m.id) && <span style={s.holdingBadge}>HOLDING</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                                <span style={s.catBadge}>{m.category.toUpperCase()}</span>
                                                {m.ai_confidence && <span style={{ fontSize: 10, color: '#4ade80', fontFamily: "'DM Mono', monospace" }}>AI: {m.ai_confidence}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedMarket && poolInfo && (
                            <div style={s.card}>
                                <div style={s.cardHead}>POOL STATISTICS</div>
                                <div style={{ padding: '12px 20px' }}>
                                    {[
                                        { k: 'YES Collateral', v: formatAmount(poolInfo.totalYesCollateral) },
                                        { k: 'NO Collateral', v: formatAmount(poolInfo.totalNoCollateral) },
                                        { k: 'Total Borrowed', v: formatAmount(poolInfo.totalBorrowed) },
                                        { k: 'Active Loans', v: poolInfo.loanCount.toString() },
                                        { k: 'Status', v: poolInfo.resolved ? 'RESOLVED' : 'ACTIVE', color: poolInfo.resolved ? '#f87171' : '#4ade80' },
                                    ].map(row => (
                                        <div key={row.k} style={s.statRow}>
                                            <span style={{ fontSize: 10, color: '#6b6b5e', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: "'DM Mono', monospace" }}>{row.k}</span>
                                            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace", color: (row as any).color || '#f0ede6' }}>{row.v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={s.right}>
                        {!selectedMarket ? (
                            <div style={{ ...s.card, padding: 40, textAlign: 'center' as const }}>
                                <p style={{ color: '#6b6b5e', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Select a lending pool to get started</p>
                            </div>
                        ) : (
                            <>
                                {position && (
                                    <div style={s.card}>
                                        <div style={s.cardHead}>YOUR POSITION</div>
                                        <div style={s.posGrid}>
                                            {[
                                                { k: 'YES Collateral', v: formatAmount(position.yesCollateral), c: '#4ade80' },
                                                { k: 'NO Collateral', v: formatAmount(position.noCollateral), c: '#f87171' },
                                                { k: 'Borrowed', v: formatAmount(position.borrowed), c: '#f5c842' },
                                                { k: 'Max Borrow', v: formatAmount(position.maxBorrow), c: '#f0ede6' },
                                                { k: 'Interest', v: formatAmount(position.interestOwed), c: '#6366f1' },
                                            ].map(p => (
                                                <div key={p.k} style={s.posItem}>
                                                    <span style={s.posLabel}>{p.k}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: p.c }}>{p.v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={s.card}>
                                    <div style={s.actionTabs}>
                                        {(['deposit', 'borrow', 'repay', 'withdraw'] as const).map(t => (
                                            <button key={t} onClick={() => { setTab(t); resetStatus(); }} style={{ ...s.aTab, ...(tab === t ? s.aTabOn : {}) }}>{t.toUpperCase()}</button>
                                        ))}
                                    </div>
                                    <div style={{ padding: '16px 20px 20px' }}>
                                        {/* YES/NO Balance Display */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', background: '#0a0a08', border: '1px solid rgba(245,200,66,0.08)' }}>
                                            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#4ade80' }}>YES: {fmtBal(yesBalance)}</span>
                                            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#f87171' }}>NO: {fmtBal(noBalance)}</span>
                                        </div>
                                        {(tab === 'deposit' || tab === 'withdraw') && (
                                            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                                                <button onClick={() => setIsYes(true)} style={{ ...s.tokBtn, ...(isYes ? { background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.25)', color: '#4ade80' } : {}) }}>YES TOKEN</button>
                                                <button onClick={() => setIsYes(false)} style={{ ...s.tokBtn, ...(!isYes ? { background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.25)', color: '#f87171' } : {}) }}>NO TOKEN</button>
                                            </div>
                                        )}
                                        <div style={{ position: 'relative' as const, marginBottom: 8 }}>
                                            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} style={s.amtInput} />
                                            <span style={s.inputSuffix}>{tab === 'borrow' || tab === 'repay' ? 'tUSDT' : (isYes ? 'YES' : 'NO')}</span>
                                        </div>
                                        {/* Percentage Buttons */}
                                        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                                            {[25, 50, 75, 100].map(pct => {
                                                let maxVal = 0n;
                                                if (tab === 'deposit') maxVal = isYes ? yesBalance : noBalance;
                                                else if (tab === 'borrow') maxVal = position?.maxBorrow || 0n;
                                                else if (tab === 'repay') maxVal = (position?.borrowed || 0n) + (position?.interestOwed || 0n);
                                                else if (tab === 'withdraw') maxVal = isYes ? (position?.yesCollateral || 0n) : (position?.noCollateral || 0n);
                                                const val = maxVal * BigInt(pct) / 100n;
                                                const numVal = Number(val) / 1e18;
                                                return (
                                                    <button
                                                        key={pct}
                                                        onClick={() => setAmount(numVal > 0 ? numVal.toString() : '')}
                                                        style={s.pctBtn}
                                                    >
                                                        {pct === 100 ? 'MAX' : `${pct}%`}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {lendingStatus.active && (
                                            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                                {lendingStatus.steps.map((step, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: step.status === 'done' ? '#4ade80' : step.status === 'active' ? '#f5c842' : step.status === 'error' ? '#f87171' : '#6b6b5e' }} />
                                                        <span style={{ fontSize: 11, color: step.status === 'active' ? '#f0ede6' : '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>{step.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {error && <div style={s.errBox}>{error}</div>}
                                        <button onClick={handleAction} disabled={loading || !amount} style={{ ...s.actionBtn, opacity: loading || !amount ? 0.5 : 1 }}>{loading ? 'PROCESSING...' : tab.toUpperCase()}</button>
                                        <Link to={`/market/${selectedMarket.id}`} style={s.detailLink}>VIEW MARKET DETAILS &rarr;</Link>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    connectBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center', minHeight: 400, background: '#111110', border: '1px solid rgba(245,200,66,0.15)' },
    goldBtn: { background: '#f5c842', color: '#0a0a08', border: 'none', padding: '12px 28px', fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em' },
    sectionLabel: { fontSize: 11, letterSpacing: '0.16em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'DM Mono', monospace" },
    top: { marginBottom: 24 },
    stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginBottom: 24 },
    statCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
    statLabel: { fontSize: 10, color: '#6b6b5e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, fontFamily: "'DM Mono', monospace" },
    statVal: { fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f0ede6' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
    left: { display: 'flex', flexDirection: 'column', gap: 16 },
    right: { display: 'flex', flexDirection: 'column', gap: 16 },
    card: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', overflow: 'hidden' },
    cardHead: { fontSize: 11, fontWeight: 700, padding: '14px 20px', borderBottom: '1px solid rgba(245,200,66,0.08)', fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em', color: '#f0ede6' },
    poolItem: { padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(245,200,66,0.06)', transition: 'background 0.15s' },
    poolSel: { background: 'rgba(245,200,66,0.04)', borderLeft: '3px solid #f5c842' },
    catBadge: { fontSize: 10, color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '2px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' },
    myPoolsBtn: { padding: '4px 10px', fontSize: 9, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(74,222,128,0.2)', color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' },
    myPoolsBtnOn: { background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80' },
    holdingBadge: { fontSize: 8, fontWeight: 700, padding: '2px 6px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace", flexShrink: 0 },
    statRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(245,200,66,0.06)' },
    posGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(245,200,66,0.06)' },
    posItem: { display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px', background: '#111110' },
    posLabel: { fontSize: 10, color: '#6b6b5e', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" },
    actionTabs: { display: 'flex', gap: 0, borderBottom: '1px solid rgba(245,200,66,0.08)' },
    aTab: { flex: 1, padding: '12px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: 'none', color: '#6b6b5e', borderBottom: '2px solid transparent', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' },
    aTabOn: { color: '#f0ede6', borderBottomColor: '#f5c842' },
    tokBtn: { flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(245,200,66,0.12)', color: '#6b6b5e', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' },
    amtInput: { width: '100%', padding: '14px 60px 14px 16px', fontSize: 16, fontFamily: "'DM Mono', monospace", background: '#0a0a08', border: '1px solid rgba(245,200,66,0.15)', color: '#f0ede6', outline: 'none', boxSizing: 'border-box' as const },
    inputSuffix: { position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' },
    errBox: { padding: '10px 14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', fontSize: 11, marginBottom: 16, fontFamily: "'DM Mono', monospace" },
    actionBtn: { width: '100%', padding: '14px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#f5c842', border: 'none', color: '#0a0a08', fontFamily: "'Syne', sans-serif", letterSpacing: '0.08em' },
    pctBtn: { flex: 1, padding: '8px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(245,200,66,0.12)', color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' as const, transition: 'all 0.15s' },
    detailLink: { display: 'block', textAlign: 'center', marginTop: 12, fontSize: 11, color: '#f5c842', textDecoration: 'none', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' },
};
