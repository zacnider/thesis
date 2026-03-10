import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import type { CSSProperties } from 'react';

const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/explore', label: 'Markets' },
    { path: '/lending', label: 'Borrow' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/leaderboard', label: 'Board' },
];

export default function Header() {
    const location = useLocation();
    const { walletAddress, connecting, openConnectModal, disconnect, walletBalance } = useWalletConnect();
    const [copied, setCopied] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const wasConnected = useRef(!!walletAddress);

    useEffect(() => {
        if (walletAddress && !wasConnected.current) {
            wasConnected.current = true;
        }
        if (!walletAddress) {
            wasConnected.current = false;
        }
    }, [walletAddress]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 900px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const copyAddress = async () => {
        if (!walletAddress) return;
        try { await navigator.clipboard.writeText(walletAddress); } catch {
            const el = document.createElement('textarea');
            el.value = walletAddress;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const balanceBtc = walletBalance
        ? (Number(
            typeof walletBalance === 'object' && 'confirmed' in walletBalance
                ? walletBalance.confirmed
                : walletBalance,
        ) / 100_000_000).toFixed(4)
        : null;

    return (
        <>
            <header style={s.header}>
                <div style={s.inner}>
                    <Link to="/" style={s.logoLink}>
                        <span style={s.logoText}>THESIS</span>
                        <span style={s.logoDot}>.</span>
                        <span style={s.logoBtc}>PROTOCOL</span>
                    </Link>

                    {!isMobile && (
                        <nav style={s.nav}>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    style={{
                                        ...s.navLink,
                                        ...(location.pathname === link.path ? s.navActive : {}),
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    <div style={s.right}>
                        {walletAddress ? (
                            <div style={s.walletGroup}>
                                {balanceBtc && !isMobile && (
                                    <div style={s.balance}>{balanceBtc} BTC</div>
                                )}
                                {!isMobile && (
                                    <button onClick={copyAddress} style={s.addrBtn}>
                                        {copied ? 'COPIED' : truncate(walletAddress)}
                                    </button>
                                )}
                                <button onClick={disconnect} style={s.dcBtn}>
                                    {isMobile ? 'DC' : 'DISCONNECT'}
                                </button>
                            </div>
                        ) : (
                            <button onClick={openConnectModal} disabled={connecting} style={s.connectBtn}>
                                {connecting ? 'CONNECTING...' : 'CONNECT WALLET'}
                            </button>
                        )}
                        {isMobile && (
                            <button onClick={() => setMobileOpen(!mobileOpen)} style={s.burger}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0ede6" strokeWidth="2" strokeLinecap="round">
                                    {mobileOpen ? (
                                        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                                    ) : (
                                        <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
                                    )}
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {isMobile && mobileOpen && (
                <>
                    <div style={s.overlay} onClick={() => setMobileOpen(false)} />
                    <div style={s.mobileMenu}>
                        {walletAddress && balanceBtc && (
                            <div style={s.mobileBalance}>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#4ade80' }}>{balanceBtc} BTC</span>
                                <span onClick={copyAddress} style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b5e', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                                    {copied ? 'COPIED' : truncate(walletAddress)}
                                </span>
                            </div>
                        )}
                        <nav style={{ display: 'flex', flexDirection: 'column' as const }}>
                            {navLinks.map((link) => (
                                <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}
                                    style={{ ...s.mobileLink, ...(location.pathname === link.path ? { color: '#f5c842', borderLeft: '2px solid #f5c842' } : {}) }}>
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </>
            )}
        </>
    );
}

const s: Record<string, CSSProperties> = {
    header: { position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(245,200,66,0.15)', background: 'rgba(10,10,8,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
    inner: { maxWidth: 1200, width: '100%', margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 },
    logoLink: { display: 'flex', alignItems: 'baseline', textDecoration: 'none' },
    logoText: { fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#f0ede6', letterSpacing: '-0.5px' },
    logoDot: { fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#f5c842' },
    logoBtc: { fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#f0ede6', letterSpacing: '-0.5px' },
    nav: { display: 'flex', gap: 40 },
    navLink: { fontSize: 12, color: '#6b6b5e', textDecoration: 'none', textTransform: 'uppercase' as const, letterSpacing: '0.08em', transition: 'color 0.2s', fontFamily: "'DM Mono', monospace" },
    navActive: { color: '#f5c842' },
    right: { display: 'flex', alignItems: 'center', gap: 8 },
    walletGroup: { display: 'flex', alignItems: 'center', gap: 8 },
    balance: { fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#4ade80', padding: '7px 12px', border: '1px solid rgba(74,222,128,0.15)', letterSpacing: '0.04em' },
    addrBtn: { background: 'transparent', border: '1px solid rgba(245,200,66,0.15)', padding: '7px 12px', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#6b6b5e', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
    dcBtn: { background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)', padding: '7px 12px', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' },
    connectBtn: { background: '#f5c842', color: '#0a0a08', border: 'none', padding: '10px 24px', fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
    burger: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: 'transparent', border: '1px solid rgba(245,200,66,0.15)', cursor: 'pointer' },
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 98 },
    mobileMenu: { position: 'fixed' as const, top: 64, left: 0, right: 0, background: '#111110', borderBottom: '1px solid rgba(245,200,66,0.15)', zIndex: 99, padding: '12px 0' },
    mobileBalance: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderBottom: '1px solid rgba(245,200,66,0.08)', marginBottom: 4 },
    mobileLink: { display: 'flex', alignItems: 'center', padding: '12px 24px', fontSize: 12, color: '#6b6b5e', textDecoration: 'none', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace", borderLeft: '2px solid transparent' },
};
