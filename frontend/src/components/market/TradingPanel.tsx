import { useState, useEffect, useCallback } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getContract } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { usePredictionMarket } from '../../hooks/usePredictionMarket';
import { useProvider } from '../../context/ProviderContext';
import { OP20_ABI } from '../../config/abis';
import type { CSSProperties } from 'react';

import { API_BASE } from '../../config/constants';

const opnetTestnet = (networks as Record<string, typeof networks.testnet>).opnetTestnet;
const MAX_SAT = 1_000_000n;

interface TradingPanelProps {
    marketAddress: string;
    yesTokenAddress?: string;
    noTokenAddress?: string;
    collateralTokenAddress?: string;
    yesPrice: number;
    noPrice: number;
    resolved: boolean;
    onPriceUpdate?: (yesPrice: number, noPrice: number) => void;
}

export default function TradingPanel({
    marketAddress,
    yesTokenAddress,
    noTokenAddress,
    collateralTokenAddress,
    yesPrice: initialYesPrice,
    noPrice: initialNoPrice,
    resolved,
    onPriceUpdate,
}: TradingPanelProps) {
    const { walletAddress, openConnectModal, address, network } = useWalletConnect();
    const provider = useProvider();
    const net = network || opnetTestnet;
    const [side, setSide] = useState<'YES' | 'NO'>('YES');
    const [amount, setAmount] = useState('');
    const [tab, setTab] = useState<'buy' | 'sell'>('buy');
    const [yesBalance, setYesBalance] = useState<bigint>(0n);
    const [noBalance, setNoBalance] = useState<bigint>(0n);
    const [usdtBalance, setWbtcBalance] = useState<bigint>(0n);
    const [faucetLoading, setFaucetLoading] = useState(false);
    const [faucetMsg, setFaucetMsg] = useState('');

    const isDeployed = !!(marketAddress && marketAddress.length > 5);
    const [deployStatus, setDeployStatus] = useState<{
        status: string;
        step?: number;
        totalSteps?: number;
        stepLabel?: string;
        marketId?: number;
    } | null>(null);

    const checkDeployStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/deploy-status`);
            if (res.ok) {
                const data = await res.json();
                setDeployStatus(data);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (isDeployed) return;
        checkDeployStatus();
        const interval = setInterval(checkDeployStatus, 10000);
        return () => clearInterval(interval);
    }, [isDeployed, checkDeployStatus]);

    const {
        loading: tradeLoading,
        error: tradeError,
        tradeStatus,
        resetTradeStatus,
        priceInfo,
        buyOutcome,
        sellOutcome,
        redeem,
        getTokenBalance,
        getQuote,
        setError,
    } = usePredictionMarket(
        isDeployed ? marketAddress : undefined,
        yesTokenAddress,
        noTokenAddress,
        collateralTokenAddress,
    );

    const [quotedTokens, setQuotedTokens] = useState<string | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);

    const yesPrice = isDeployed ? priceInfo.yesPrice : initialYesPrice;
    const noPrice = isDeployed ? priceInfo.noPrice : initialNoPrice;

    useEffect(() => {
        if (onPriceUpdate && isDeployed) {
            onPriceUpdate(priceInfo.yesPrice, priceInfo.noPrice);
        }
    }, [priceInfo, onPriceUpdate, isDeployed]);

    useEffect(() => {
        if (!walletAddress || !isDeployed) return;
        const fetchBalances = async () => {
            if (yesTokenAddress) {
                const b = await getTokenBalance(yesTokenAddress);
                setYesBalance(b);
            }
            if (noTokenAddress) {
                const b = await getTokenBalance(noTokenAddress);
                setNoBalance(b);
            }
            if (collateralTokenAddress) {
                const b = await getTokenBalance(collateralTokenAddress);
                setWbtcBalance(b);
            }
        };
        fetchBalances();
        const interval = setInterval(fetchBalances, 30000);
        return () => clearInterval(interval);
    }, [walletAddress, yesTokenAddress, noTokenAddress, collateralTokenAddress, isDeployed, getTokenBalance]);

    const requestFaucet = async () => {
        if (!walletAddress || !collateralTokenAddress) return;
        setFaucetLoading(true);
        setFaucetMsg('');
        try {
            const contract = getContract(
                collateralTokenAddress,
                OP20_ABI as any,
                provider,
                net,
                (address as any) || undefined,
            ) as any;

            const sim = await contract.faucet();
            if (sim.revert) throw new Error('Faucet simulation failed: ' + sim.revert);

            await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress,
                maximumAllowedSatToSpend: MAX_SAT,
                network: net,
            });

            setFaucetMsg('1000 tUSDT claimed! Balance updates after block confirmation (~10 min)');
        } catch (err: any) {
            setFaucetMsg(err.message || 'Faucet request failed');
        } finally {
            setFaucetLoading(false);
        }
    };

    const price = side === 'YES' ? yesPrice : noPrice;

    // Fetch real quote from on-chain CPMM when amount/side changes
    useEffect(() => {
        if (!amount || Number(amount) <= 0 || !isDeployed) {
            setQuotedTokens(null);
            return;
        }
        const DECIMALS = 10n ** 18n;
        const amountBigInt = BigInt(Math.floor(Number(amount))) * DECIMALS;
        setQuoteLoading(true);
        const timer = setTimeout(() => {
            getQuote(side === 'YES', amountBigInt)
                .then(result => {
                    if (result !== null) {
                        setQuotedTokens((Number(result) / 1e18).toFixed(2));
                    } else {
                        setQuotedTokens(null);
                    }
                })
                .catch(() => setQuotedTokens(null))
                .finally(() => setQuoteLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [amount, side, isDeployed, getQuote]);

    const naiveEstimate = amount ? (Number(amount) / price).toFixed(2) : '0';
    const estimatedTokens = quotedTokens || naiveEstimate;
    const potentialReturn = estimatedTokens;

    const handleTrade = async () => {
        if (!walletAddress) {
            openConnectModal();
            return;
        }
        if (!isDeployed) {
            setError('Market contracts not yet deployed on-chain');
            return;
        }
        if (!amount || Number(amount) <= 0) return;

        const DECIMALS = 10n ** 18n;
        const amountBigInt = BigInt(Math.floor(Number(amount))) * DECIMALS;

        if (tab === 'buy') {
            await buyOutcome(side === 'YES', amountBigInt);
        } else {
            await sellOutcome(side === 'YES', amountBigInt);
        }
    };

    const handleRedeem = async () => {
        if (!walletAddress) {
            openConnectModal();
            return;
        }
        const balance = side === 'YES' ? yesBalance : noBalance;
        if (balance > 0n) {
            await redeem(balance);
        }
    };

    const quickAmounts = [1, 10, 100, 1000];

    // Resolved state
    if (resolved) {
        return (
            <div style={st.panel}>
                <div style={st.resolvedBanner}>
                    <div style={st.resolvedIcon}>&#x2713;</div>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#f0ede6' }}>MARKET RESOLVED</h3>
                    <p style={st.resolvedText}>This market has been resolved. Redeem your winning tokens.</p>
                </div>
                {walletAddress ? (
                    <>
                        <div style={{ padding: '0 20px', fontSize: 11, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>
                            YES: {(Number(yesBalance) / 1e18).toFixed(4)} | NO: {(Number(noBalance) / 1e18).toFixed(4)}
                        </div>
                        <button style={st.goldBtn} onClick={handleRedeem} disabled={tradeLoading}>
                            {tradeLoading ? 'REDEEMING...' : 'REDEEM WINNINGS'}
                        </button>
                    </>
                ) : (
                    <button style={st.goldBtn} onClick={openConnectModal}>
                        CONNECT WALLET TO REDEEM
                    </button>
                )}
            </div>
        );
    }

    // Active trade progress overlay
    if (tradeStatus.active) {
        return (
            <div style={st.panel}>
                <div style={{ padding: '24px 20px' }}>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: '#f0ede6', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>
                        {tradeStatus.type === 'buy' ? 'Buying' : tradeStatus.type === 'sell' ? 'Selling' : 'Redeeming'}...
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                        {tradeStatus.steps.map((step, i) => (
                            <div key={i} style={st.stepRow}>
                                <span style={{
                                    ...st.stepDot,
                                    background: step.status === 'done' ? '#4ade80'
                                        : step.status === 'active' ? '#f5c842'
                                            : step.status === 'error' ? '#f87171'
                                                : 'rgba(245,200,66,0.1)',
                                    boxShadow: step.status === 'active' ? '0 0 8px rgba(245,200,66,0.5)' : 'none',
                                }} />
                                <span style={{
                                    fontSize: 12,
                                    fontFamily: "'DM Mono', monospace",
                                    color: step.status === 'done' ? '#4ade80'
                                        : step.status === 'active' ? '#f0ede6'
                                            : step.status === 'error' ? '#f87171'
                                                : '#6b6b5e',
                                    fontWeight: step.status === 'active' ? 600 : 400,
                                }}>
                                    {step.label}
                                    {step.status === 'active' && <span className="loading-pulse"> ...</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                    {tradeStatus.error && (
                        <div style={{ ...st.errorMsg, marginTop: 12 }}>
                            {tradeStatus.error}
                        </div>
                    )}
                    {(tradeStatus.success || tradeStatus.error) && (
                        <button style={{ ...st.goldBtn, margin: '16px 0 0' }} onClick={resetTradeStatus}>
                            {tradeStatus.success ? 'DONE' : 'TRY AGAIN'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={st.panel}>
            {/* Deploy status */}
            {!isDeployed && (
                <div style={st.deployBanner}>
                    <div style={st.deployHeader}>
                        <span className="loading-pulse" style={st.deployDot} />
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Deploying to Bitcoin</span>
                    </div>
                    {deployStatus && deployStatus.status !== 'idle' && deployStatus.status !== 'complete' ? (
                        <div style={st.deployProgress}>
                            <div style={st.deployProgressBar}>
                                <div style={{
                                    ...st.deployProgressFill,
                                    width: `${((deployStatus.step || 0) / (deployStatus.totalSteps || 4)) * 100}%`,
                                }} />
                            </div>
                            <span style={st.deployStep}>
                                Step {deployStatus.step}/{deployStatus.totalSteps}: {deployStatus.stepLabel || 'Processing...'}
                            </span>
                        </div>
                    ) : (
                        <span style={st.deployStep}>
                            Queued — waiting for deployment slot...
                        </span>
                    )}
                </div>
            )}

            {/* Tab selector */}
            <div style={st.tabs}>
                <button
                    style={{ ...st.tab, ...(tab === 'buy' ? st.tabActive : {}) }}
                    onClick={() => setTab('buy')}
                >
                    BUY
                </button>
                <button
                    style={{ ...st.tab, ...(tab === 'sell' ? st.tabActive : {}) }}
                    onClick={() => setTab('sell')}
                >
                    SELL
                </button>
            </div>

            {/* Outcome selector */}
            <div style={st.sideSelector}>
                <button
                    style={{
                        ...st.sideBtn,
                        ...(side === 'YES' ? st.yesBtnActive : st.sideBtnInactive),
                    }}
                    onClick={() => setSide('YES')}
                >
                    <span style={st.sideLabel}>YES</span>
                    <span style={{
                        ...st.sidePrice,
                        color: side === 'YES' ? '#4ade80' : '#6b6b5e',
                    }}>
                        {Math.round(yesPrice * 100)}%
                    </span>
                </button>
                <button
                    style={{
                        ...st.sideBtn,
                        ...(side === 'NO' ? st.noBtnActive : st.sideBtnInactive),
                    }}
                    onClick={() => setSide('NO')}
                >
                    <span style={st.sideLabel}>NO</span>
                    <span style={{
                        ...st.sidePrice,
                        color: side === 'NO' ? '#f87171' : '#6b6b5e',
                    }}>
                        {Math.round(noPrice * 100)}%
                    </span>
                </button>
            </div>

            {/* Balances (if connected) */}
            {walletAddress && isDeployed && (
                <div style={{ padding: '8px 20px 0' }}>
                    <div style={st.balanceRow}>
                        <span style={{ fontSize: 11, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>
                            YES: {(Number(yesBalance) / 1e18).toFixed(2)}
                        </span>
                        <span style={{ fontSize: 11, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>
                            NO: {(Number(noBalance) / 1e18).toFixed(2)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#f5c842', fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
                            tUSDT: {(Number(usdtBalance) / 1e18).toFixed(2)}
                        </span>
                        {usdtBalance === 0n && (
                            <button
                                style={st.faucetBtn}
                                onClick={requestFaucet}
                                disabled={faucetLoading}
                            >
                                {faucetLoading ? 'MINTING...' : 'CLAIM 1000 tUSDT'}
                            </button>
                        )}
                    </div>
                    {faucetMsg && (
                        <div style={{ fontSize: 10, color: '#f5c842', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                            {faucetMsg}
                        </div>
                    )}
                </div>
            )}

            {/* Amount input */}
            <div style={st.inputGroup}>
                <div style={st.inputHeader}>
                    <label style={st.label}>AMOUNT</label>
                    <span style={st.unit}>tUSDT</span>
                </div>
                <input
                    className="input"
                    type="number"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ fontSize: 18, fontWeight: 600, padding: '14px 16px', fontFamily: "'DM Mono', monospace" }}
                />
                <div style={st.quickAmounts}>
                    {quickAmounts.map((a) => (
                        <button key={a} style={st.quickBtn} onClick={() => setAmount(String(a))}>
                            {a >= 1000 ? `${a / 1000}k` : a}
                        </button>
                    ))}
                    <button style={{ ...st.quickBtn, color: '#f5c842', borderColor: 'rgba(245,200,66,0.25)' }} onClick={() => {
                        const bal = tab === 'buy' ? usdtBalance : (side === 'YES' ? yesBalance : noBalance);
                        setAmount(String(Math.floor(Number(bal) / 1e18)));
                    }}>
                        MAX
                    </button>
                </div>
            </div>

            {/* Estimate */}
            <div style={st.estimates}>
                <div style={st.estimateRow}>
                    <span style={st.estimateLabel}>PRICE PER TOKEN</span>
                    <span style={st.estimateValue}>{(price * 100).toFixed(1)}%</span>
                </div>
                <div style={st.estimateRow}>
                    <span style={st.estimateLabel}>{quotedTokens ? 'REAL QUOTE' : 'EST. TOKENS'}</span>
                    <span style={{ ...st.estimateValue, ...(quotedTokens ? { color: '#4ade80' } : {}) }}>
                        {quoteLoading ? '...' : `${estimatedTokens} ${side}`}
                    </span>
                </div>
                <div style={st.divider} />
                <div style={st.estimateRow}>
                    <span style={st.estimateLabel}>POTENTIAL RETURN</span>
                    <span style={{ ...st.estimateValue, color: '#4ade80', fontWeight: 700 }}>
                        {quoteLoading ? '...' : `${potentialReturn} tUSDT`}
                    </span>
                </div>
            </div>

            {/* Error */}
            {tradeError && (
                <div style={st.errorMsg}>{tradeError}</div>
            )}

            {/* Trade button */}
            {walletAddress ? (
                <button
                    style={{
                        ...st.goldBtn,
                        ...(side === 'NO' ? { background: '#f87171', color: '#0a0a08' } : {}),
                    }}
                    onClick={handleTrade}
                    disabled={!amount || Number(amount) <= 0 || tradeLoading || !isDeployed}
                >
                    {!isDeployed ? 'DEPLOYING CONTRACT...'
                        : tradeLoading ? 'PROCESSING...'
                        : `${tab === 'buy' ? 'BUY' : 'SELL'} ${side} ${amount ? `FOR ${Number(amount).toLocaleString()} tUSDT` : ''}`}
                </button>
            ) : (
                <button style={st.goldBtn} onClick={openConnectModal}>
                    CONNECT WALLET TO TRADE
                </button>
            )}

            <p style={st.disclaimer}>
                Trading on prediction markets involves risk. Only trade what you can afford to lose.
            </p>
        </div>
    );
}

const st: Record<string, CSSProperties> = {
    panel: {
        background: '#111110',
        border: '1px solid rgba(245,200,66,0.15)',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    deployBanner: {
        padding: '14px 20px',
        background: 'rgba(245,200,66,0.04)',
        borderBottom: '1px solid rgba(245,200,66,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    deployHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: '#f5c842',
    },
    deployDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#f5c842',
    },
    deployProgress: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    deployProgressBar: {
        height: 4,
        background: 'rgba(245,200,66,0.1)',
        overflow: 'hidden',
    },
    deployProgressFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #e8a820, #f5c842)',
        transition: 'width 0.5s ease',
    },
    deployStep: {
        fontSize: 10,
        color: '#6b6b5e',
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.04em',
    },
    tabs: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderBottom: '1px solid rgba(245,200,66,0.15)',
    },
    tab: {
        padding: '14px',
        fontSize: 12,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        background: 'transparent',
        border: 'none',
        color: '#6b6b5e',
        cursor: 'pointer',
        transition: 'all 0.2s',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
    },
    tabActive: {
        color: '#f0ede6',
        borderBottom: '2px solid #f5c842',
        background: 'rgba(245,200,66,0.04)',
    },
    sideSelector: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        padding: '16px 20px 0',
    },
    sideBtn: {
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid transparent',
        background: 'transparent',
    },
    sideBtnInactive: {
        background: 'rgba(245,200,66,0.02)',
        border: '1px solid rgba(245,200,66,0.08)',
        opacity: 0.6,
    },
    yesBtnActive: {
        background: 'rgba(74,222,128,0.06)',
        border: '1px solid rgba(74,222,128,0.25)',
    },
    noBtnActive: {
        background: 'rgba(248,113,113,0.06)',
        border: '1px solid rgba(248,113,113,0.25)',
    },
    sideLabel: {
        fontSize: 12,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        color: '#f0ede6',
        letterSpacing: '0.06em',
    },
    sidePrice: {
        fontSize: 22,
        fontWeight: 800,
        fontFamily: "'Syne', sans-serif",
    },
    balanceRow: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    faucetBtn: {
        padding: '3px 10px',
        fontSize: 10,
        fontWeight: 600,
        background: 'rgba(245,200,66,0.08)',
        border: '1px solid rgba(245,200,66,0.2)',
        color: '#f5c842',
        cursor: 'pointer',
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 20px 0',
    },
    inputHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 10,
        color: '#6b6b5e',
        fontWeight: 500,
        letterSpacing: '0.1em',
        fontFamily: "'DM Mono', monospace",
    },
    unit: {
        fontSize: 10,
        color: '#6b6b5e',
        fontWeight: 500,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
    },
    quickAmounts: {
        display: 'flex',
        gap: 4,
    },
    quickBtn: {
        flex: 1,
        padding: '6px',
        fontSize: 11,
        fontWeight: 600,
        background: 'transparent',
        border: '1px solid rgba(245,200,66,0.12)',
        color: '#6b6b5e',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: "'DM Mono', monospace",
    },
    estimates: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        margin: '12px 20px 0',
        background: '#1a1a17',
        border: '1px solid rgba(245,200,66,0.08)',
    },
    estimateRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    estimateLabel: {
        fontSize: 10,
        color: '#6b6b5e',
        letterSpacing: '0.06em',
        fontFamily: "'DM Mono', monospace",
    },
    estimateValue: {
        fontSize: 12,
        fontWeight: 600,
        color: '#f0ede6',
        fontFamily: "'DM Mono', monospace",
    },
    divider: {
        height: 1,
        background: 'rgba(245,200,66,0.08)',
    },
    errorMsg: {
        margin: '8px 20px 0',
        padding: '8px 12px',
        background: 'rgba(248,113,113,0.06)',
        color: '#f87171',
        fontSize: 11,
        border: '1px solid rgba(248,113,113,0.2)',
        fontFamily: "'DM Mono', monospace",
    },
    goldBtn: {
        margin: '12px 20px 16px',
        padding: '14px',
        fontSize: 12,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#f5c842',
        color: '#0a0a08',
        border: 'none',
        cursor: 'pointer',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
    },
    disclaimer: {
        fontSize: 10,
        color: '#6b6b5e',
        textAlign: 'center',
        padding: '0 20px 16px',
        lineHeight: 1.4,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.02em',
    },
    resolvedBanner: {
        padding: '32px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
    },
    resolvedIcon: {
        width: 48,
        height: 48,
        border: '1px solid rgba(245,200,66,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        color: '#6366f1',
        marginBottom: 4,
    },
    resolvedText: {
        color: '#6b6b5e',
        fontSize: 12,
        maxWidth: 260,
        fontFamily: "'DM Mono', monospace",
    },
    stepRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        transition: 'all 0.3s',
    },
};
