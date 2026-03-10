import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';

export default function Footer() {
    return (
        <footer style={s.footer}>
            <div style={s.inner}>
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <img src="/logo.png" alt="Thesis Protocol" style={s.logoImg} />
                </Link>
                <div style={s.copy}>&copy; 2026 Thesis Protocol &middot; Built on Bitcoin L1</div>
                <ul style={s.links}>
                    <li><Link to="/explore" style={s.link}>Markets</Link></li>
                    <li><Link to="/lending" style={s.link}>Borrow</Link></li>
                    <li><Link to="/portfolio" style={s.link}>Portfolio</Link></li>
                    <li><Link to="/leaderboard" style={s.link}>Board</Link></li>
                    <li><Link to="/docs" style={s.link}>Docs</Link></li>
                </ul>
                <div style={s.socials}>
                    <a href="https://x.com/prematrkurtcuk" target="_blank" rel="noopener noreferrer" style={s.socialLink}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                    <a href="https://github.com/zacnider" target="_blank" rel="noopener noreferrer" style={s.socialLink}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                    </a>
                </div>
            </div>
        </footer>
    );
}

const s: Record<string, CSSProperties> = {
    footer: {
        marginTop: 'auto',
        borderTop: '1px solid rgba(245, 200, 66, 0.15)',
        padding: '48px',
    },
    inner: {
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: 24,
    },
    logoImg: {
        height: 128,
        display: 'block',
    },
    copy: {
        fontSize: 11,
        color: '#6b6b5e',
        letterSpacing: '0.06em',
    },
    links: {
        display: 'flex',
        gap: 32,
        listStyle: 'none',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
    },
    link: {
        color: '#6b6b5e',
        textDecoration: 'none',
        transition: 'color 0.2s',
    },
    socials: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
    },
    socialLink: {
        color: '#6b6b5e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        border: '1px solid rgba(245,200,66,0.12)',
        transition: 'color 0.2s, border-color 0.2s',
    },
};
