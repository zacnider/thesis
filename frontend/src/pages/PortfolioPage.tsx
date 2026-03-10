import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { useApi } from '../hooks/useAPI';
import { useProvider } from '../context/ProviderContext';
import { OP20_ABI, LENDING_POOL_ABI } from '../config/abis';
import { API_BASE } from '../config/constants';
import type { CSSProperties } from 'react';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;
const MAX_SAT = 1_000_000n;

interface MarketRow {
    id: number;
    question: string;
    status: string;
    category: string;
    collateral_token: string;
    yes_token: string;
    no_token: string;
    market_address: string;
    lending_pool_address: string;
    ai_prediction_outcome: number | null;
    ai_prediction_confidence: number | null;
}

interface PortfolioResponse {
    user: {
        address: string;
        totalPredictions: number;
        correctPredictions: number;
        accuracy: number;
        winStreak: number;
        bestStreak: number;
        totalProfit: string;
    };
    positions: Array<{
        market: MarketRow;
        trades: Array<{
            id: number;
            side: string;
            collateral_amount: string;
            outcome_tokens: string;
            tx_hash: string;
            created_at: string;
        }>;
    }>;
}

interface TokenHolding {
    market: MarketRow;
    yesBalance: bigint;
    noBalance: bigint;
}

interface OnChainLending {
    market: MarketRow;
    yesCollateral: bigint;
    noCollateral: bigint;
    borrowed: bigint;
    interestOwed: bigint;
}

type Tab = 'predictions' | 'lending';

export default function PortfolioPage() {
    const { walletAddress, openConnectModal, address, network } = useWalletConnect();
    const provider = useProvider();
    const net = network || opnetTestnet;
    const [tab, setTab] = useState<Tab>('predictions');
    const [usdtBalance, setUsdtBalance] = useState<bigint>(0n);
    const [collateralAddr, setCollateralAddr] = useState('');
    const [faucetLoading, setFaucetLoading] = useState(false);
    const [faucetMsg, setFaucetMsg] = useState('');
    const [holdings, setHoldings] = useState<TokenHolding[]>([]);
    const [holdingsLoading, setHoldingsLoading] = useState(false);
    const [onChainLending, setOnChainLending] = useState<OnChainLending[]>([]);
    const [lendingScanning, setLendingScanning] = useState(false);

    const { data, loading } = useApi<PortfolioResponse>(
        walletAddress ? `/users/${walletAddress}/portfolio` : null,
        [walletAddress],
    );

    // Fetch all markets to scan on-chain holdings
    const { data: allMarketsData } = useApi<{ markets: MarketRow[] }>(
        '/markets?limit=50',
        [],
    );

    // Scan on-chain YES/NO balances for all deployed markets
    const scanHoldings = useCallback(async () => {
        const markets = allMarketsData?.markets || [];
        const deployed = markets.filter(m => m.yes_token && m.no_token);
        if (!deployed.length || !address || !provider) return;

        setHoldingsLoading(true);
        const results: TokenHolding[] = [];

        for (const market of deployed) {
            try {
                let yesBal = 0n;
                let noBal = 0n;

                if (market.yes_token) {
                    const yc = getContract(market.yes_token, OP20_ABI as any, provider, net) as any;
                    const yr = await yc.balanceOf(address);
                    const yb = yr?.properties?.balance;
                    if (yb !== undefined && yb !== null) yesBal = BigInt(yb.toString());
                }

                if (market.no_token) {
                    const nc = getContract(market.no_token, OP20_ABI as any, provider, net) as any;
                    const nr = await nc.balanceOf(address);
                    const nb = nr?.properties?.balance;
                    if (nb !== undefined && nb !== null) noBal = BigInt(nb.toString());
                }

                if (yesBal > 0n || noBal > 0n) {
                    results.push({ market, yesBalance: yesBal, noBalance: noBal });
                }
            } catch {
                // skip failed queries
            }
        }

        setHoldings(results);
        setHoldingsLoading(false);
    }, [allMarketsData, address, provider, net]);

    // Scan on-chain lending positions for all markets with lending pools
    const scanLending = useCallback(async () => {
        const markets = allMarketsData?.markets || [];
        const withPool = markets.filter(m => m.lending_pool_address);
        if (!withPool.length || !address || !provider) return;

        setLendingScanning(true);
        const results: OnChainLending[] = [];

        for (const market of withPool) {
            try {
                const contract = getContract(market.lending_pool_address, LENDING_POOL_ABI as any, provider, net) as any;
                const res = await contract.getPositionInfo(address);
                if (res?.revert) continue;
                const p = res?.properties;
                if (!p) continue;
                const yesCol = BigInt(p.yesCollateral?.toString() || '0');
                const noCol = BigInt(p.noCollateral?.toString() || '0');
                const borrowed = BigInt(p.borrowed?.toString() || '0');
                const interest = BigInt(p.interestOwed?.toString() || '0');
                if (yesCol > 0n || noCol > 0n || borrowed > 0n) {
                    results.push({ market, yesCollateral: yesCol, noCollateral: noCol, borrowed, interestOwed: interest });
                }
            } catch {
                // skip
            }
        }

        setOnChainLending(results);
        setLendingScanning(false);
    }, [allMarketsData, address, provider, net]);

    useEffect(() => {
        scanHoldings();
        scanLending();
        const iv = setInterval(() => { scanHoldings(); scanLending(); }, 30000);
        return () => clearInterval(iv);
    }, [scanHoldings, scanLending]);

    useEffect(() => {
        fetch(`${API_BASE}/collateral-token`)
            .then(r => r.json())
            .then(d => {
                console.log('[Thesis] collateral-token:', d);
                if (d.address) setCollateralAddr(d.address);
            })
            .catch((err) => console.error('[Thesis] collateral-token fetch failed:', err));
    }, []);

    const fetchBalance = useCallback(async () => {
        if (!collateralAddr || !provider) return;
        if (!address) {
            console.log('[Thesis] fetchBalance skipped: address is null, walletAddress=', walletAddress);
            return;
        }
        try {
            console.log('[Thesis] fetchBalance: address type=', typeof address, 'hasEquals=', !!(address as any)?.equals, 'collateral=', collateralAddr);
            const contract = getContract(collateralAddr, OP20_ABI as any, provider, net) as any;
            const result = await contract.balanceOf(address);
            console.log('[Thesis] balanceOf raw result:', result);
            if (result?.revert) {
                console.warn('[Thesis] balanceOf reverted:', result.revert);
                return;
            }
            if (result) {
                const bal = result.properties?.balance;
                console.log('[Thesis] balanceOf properties:', result.properties, 'bal=', bal);
                if (bal !== undefined && bal !== null) {
                    const bigVal = BigInt(bal.toString());
                    console.log('[Thesis] Setting balance to:', bigVal.toString());
                    setUsdtBalance(bigVal);
                }
            }
        } catch (err: any) {
            console.error('[Thesis] fetchBalance error:', err?.message || String(err), err);
        }
    }, [address, walletAddress, collateralAddr, provider, net]);

    useEffect(() => {
        fetchBalance();
        const iv = setInterval(fetchBalance, 15000);
        return () => clearInterval(iv);
    }, [fetchBalance]);

    const claimFaucet = async () => {
        if (!walletAddress || !collateralAddr) return;
        setFaucetLoading(true);
        setFaucetMsg('');
        try {
            const contract = getContract(collateralAddr, OP20_ABI as any, provider, net, (address as any) || undefined) as any;
            const sim = await contract.faucet();
            console.log('[Thesis] faucet sim:', sim);
            if (sim.revert) throw new Error('Faucet simulation failed: ' + sim.revert);
            if ('error' in sim) throw new Error('Faucet simulation failed: ' + sim.error);
            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress,
                maximumAllowedSatToSpend: MAX_SAT,
                network: net,
            });
            setFaucetMsg('1000 tUSDT claimed! Balance updates after block confirmation (~10 min)');
        } catch (err: any) {
            setFaucetMsg(err.message || 'Faucet failed');
        } finally {
            setFaucetLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <div className="page">
                <div className="container">
                    <div style={s.connectBox}>
                        <div style={{ fontSize: 36, color: '#f5c842', marginBottom: 16 }}>&#x25C8;</div>
                        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#f0ede6', marginBottom: 8 }}>CONNECT YOUR WALLET</h2>
                        <p style={{ color: '#6b6b5e', fontSize: 12, marginBottom: 24, maxWidth: 380, textAlign: 'center' as const, lineHeight: 1.6, fontFamily: "'DM Mono', monospace" }}>
                            Connect to view your portfolio, claim tUSDT, and manage positions.
                        </p>
                        <button style={s.goldBtn} onClick={openConnectModal}>CONNECT WALLET</button>
                    </div>
                </div>
            </div>
        );
    }

    const fmt = (v: bigint) => (Number(v) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });

    return (
        <div className="page">
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' as const, gap: 12 }}>
                    <div>
                        <h1 className="page-title">Portfolio</h1>
                        <p className="page-subtitle" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {walletAddress.slice(0, 16)}...{walletAddress.slice(-6)}
                        </p>
                    </div>
                    <Link to="/explore" style={{ textDecoration: 'none' }}>
                        <button style={s.outlineBtn}>EXPLORE MARKETS</button>
                    </Link>
                </div>

                {/* tUSDT Balance Card */}
                <div style={s.balanceCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={s.tokenIcon}>$</div>
                        <div>
                            <div style={{ fontSize: 10, color: '#6b6b5e', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: "'DM Mono', monospace" }}>tUSDT Balance</div>
                            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f5c842' }}>
                                {fmt(usdtBalance)}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
                        <button style={s.faucetBtn} onClick={claimFaucet} disabled={faucetLoading}>
                            {faucetLoading ? 'CLAIMING...' : 'CLAIM 1000 tUSDT'}
                        </button>
                        <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>Free testnet tokens</span>
                    </div>
                </div>
                {faucetMsg && (
                    <div style={{
                        padding: '10px 14px', fontSize: 11, marginBottom: 16, fontFamily: "'DM Mono', monospace",
                        background: faucetMsg.includes('claimed') ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
                        color: faucetMsg.includes('claimed') ? '#4ade80' : '#f87171',
                        border: `1px solid ${faucetMsg.includes('claimed') ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
                    }}>
                        {faucetMsg}
                    </div>
                )}

                {/* Stats Row */}
                <div style={s.statsGrid}>
                    {[
                        { label: 'Holdings', value: holdings.length },
                        { label: 'Active', value: holdings.filter(h => h.market.status === 'active').length },
                        { label: 'Resolved', value: holdings.filter(h => h.market.status === 'resolved').length },
                        { label: 'Lending', value: onChainLending.length },
                    ].map((st) => (
                        <div key={st.label} style={s.statCard}>
                            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f0ede6' }}>{st.value}</div>
                            <div style={{ fontSize: 10, color: '#6b6b5e', marginTop: 4, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: "'DM Mono', monospace" }}>{st.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={s.tabs}>
                    {(['predictions', 'lending'] as Tab[]).map(t => (
                        <button
                            key={t}
                            style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}
                            onClick={() => setTab(t)}
                        >
                            {t.toUpperCase()}
                            {t === 'predictions' && holdings.length > 0 && (
                                <span style={s.badge}>{holdings.length}</span>
                            )}
                            {t === 'lending' && onChainLending.length > 0 && (
                                <span style={s.badge}>{onChainLending.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="loading-pulse" style={{ height: 64, background: '#111110', border: '1px solid rgba(245,200,66,0.08)' }} />
                        ))}
                    </div>
                ) : (
                    <>
                        {tab === 'predictions' && (
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
                                {holdingsLoading ? (
                                    <div style={s.emptySmall}>Scanning on-chain balances...</div>
                                ) : holdings.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                                        {holdings.map(h => (
                                            <Link key={h.market.id} to={`/market/${h.market.id}`} style={{ textDecoration: 'none' }}>
                                                <div style={s.posCard}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', color: h.market.status === 'active' ? '#4ade80' : '#6366f1', border: `1px solid ${h.market.status === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(99,102,241,0.2)'}`, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" }}>{h.market.status}</span>
                                                            {h.market.category && <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>{h.market.category}</span>}
                                                        </div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0ede6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: "'Syne', sans-serif" }}>{h.market.question}</div>
                                                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                                                            {h.yesBalance > 0n && (
                                                                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#4ade80' }}>
                                                                    YES: {fmt(h.yesBalance)}
                                                                </span>
                                                            )}
                                                            {h.noBalance > 0n && (
                                                                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#f87171' }}>
                                                                    NO: {fmt(h.noBalance)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b5e" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState text="No predictions yet. Buy YES or NO tokens to start." btnLabel="EXPLORE MARKETS" btnTo="/explore" />
                                )}
                            </div>
                        )}
                        {tab === 'lending' && (
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                                {lendingScanning ? (
                                    <div style={s.emptySmall}>Scanning on-chain lending positions...</div>
                                ) : onChainLending.length > 0 ? onChainLending.map(l => (
                                    <Link key={l.market.id} to={`/market/${l.market.id}`} style={{ textDecoration: 'none' }}>
                                        <div style={s.posCard}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0ede6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>{l.market.question}</div>
                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                                                    {l.yesCollateral > 0n && (
                                                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#4ade80' }}>
                                                            YES Collateral: {fmt(l.yesCollateral)}
                                                        </span>
                                                    )}
                                                    {l.noCollateral > 0n && (
                                                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#f87171' }}>
                                                            NO Collateral: {fmt(l.noCollateral)}
                                                        </span>
                                                    )}
                                                    {l.borrowed > 0n && (
                                                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#f5c842' }}>
                                                            Borrowed: {fmt(l.borrowed)} tUSDT
                                                        </span>
                                                    )}
                                                    {l.interestOwed > 0n && (
                                                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#6b6b5e' }}>
                                                            Interest: {fmt(l.interestOwed)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b5e" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                                        </div>
                                    </Link>
                                )) : <EmptyState text="No lending positions." btnLabel="GO TO LENDING" btnTo="/lending" />}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}


function EmptyState({ text, btnLabel, btnTo }: { text: string; btnLabel: string; btnTo: string }) {
    return (
        <div style={s.emptyBox}>
            <p style={{ color: '#6b6b5e', fontSize: 12, marginBottom: 16, fontFamily: "'DM Mono', monospace" }}>{text}</p>
            <Link to={btnTo} style={{ textDecoration: 'none' }}><button style={s.goldBtn}>{btnLabel}</button></Link>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    connectBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center', minHeight: 400, background: '#111110', border: '1px solid rgba(245,200,66,0.15)' },
    goldBtn: { background: '#f5c842', color: '#0a0a08', border: 'none', padding: '12px 28px', fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' },
    outlineBtn: { background: 'transparent', color: '#6b6b5e', border: '1px solid rgba(245,200,66,0.15)', padding: '8px 16px', fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 500, cursor: 'pointer', letterSpacing: '0.06em' },
    balanceCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '20px 24px', marginBottom: 16, background: 'rgba(245,200,66,0.04)', border: '1px solid rgba(245,200,66,0.15)' },
    tokenIcon: { width: 44, height: 44, border: '1px solid rgba(245,200,66,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#f5c842' },
    faucetBtn: { padding: '10px 20px', fontSize: 12, fontWeight: 700, background: '#f5c842', color: '#0a0a08', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, marginBottom: 24 },
    statCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 18, textAlign: 'center' },
    tabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid rgba(245,200,66,0.15)' },
    tabBtn: { padding: '10px 16px', fontSize: 11, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#6b6b5e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' },
    tabActive: { color: '#f0ede6', borderBottom: '2px solid #f5c842' },
    badge: { fontSize: 10, fontWeight: 700, padding: '1px 6px', background: 'rgba(245,200,66,0.12)', color: '#f5c842', fontFamily: "'DM Mono', monospace" },
    sectionTitle: { fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#f0ede6', marginBottom: 10, letterSpacing: '0.02em' },
    posCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.12)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s' },
    tradeRow: { background: '#111110', border: '1px solid rgba(245,200,66,0.08)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    emptyBox: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    emptySmall: { padding: '24px 16px', textAlign: 'center', color: '#6b6b5e', fontSize: 12, background: '#111110', border: '1px solid rgba(245,200,66,0.08)', fontFamily: "'DM Mono', monospace" },
};
