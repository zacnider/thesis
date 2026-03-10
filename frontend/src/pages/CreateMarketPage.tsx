import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { apiPost } from '../hooks/useAPI';
import { CATEGORIES } from '../config/constants';
import type { CSSProperties } from 'react';

export default function CreateMarketPage() {
    const navigate = useNavigate();
    const { walletAddress, openConnectModal } = useWalletConnect();
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('general');
    const [endBlock, setEndBlock] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!walletAddress) { openConnectModal(); return; }
        if (!question.trim()) return setError('Question is required');
        if (!endBlock) return setError('End block is required');
        if (question.length < 10) return setError('Question must be at least 10 characters');

        setLoading(true);
        setError('');
        try {
            const result = await apiPost<{ marketId: number }>('/markets', {
                question: question.trim(),
                description: description.trim(),
                category,
                endBlock: parseInt(endBlock),
                collateralToken: 'native',
                creator: walletAddress,
            });
            navigate(`/market/${result.marketId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create market');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 640 }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={s.sectionLabel}>// Create Market</div>
                    <h1 className="page-title">Create Market</h1>
                    <p className="page-subtitle">Launch a new prediction market for the community</p>
                </div>

                <div style={s.form}>
                    <div style={s.field}>
                        <label style={s.label}>
                            QUESTION
                            <span style={s.charCount}>{question.length}/200</span>
                        </label>
                        <input
                            className="input"
                            placeholder="Will Bitcoin reach $200K by end of 2026?"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
                            style={{ fontSize: 14, padding: '12px 14px' }}
                        />
                        <span style={s.hint}>Write a clear yes/no question that can be objectively resolved</span>
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>DESCRIPTION</label>
                        <textarea
                            className="input"
                            placeholder="Add resolution criteria and context..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{ minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
                        />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>CATEGORY</label>
                        <div style={s.catGrid}>
                            {CATEGORIES.map((c) => (
                                <button
                                    key={c}
                                    style={{ ...s.catBtn, ...(category === c ? s.catBtnOn : {}) }}
                                    onClick={() => setCategory(c)}
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
                            value={endBlock}
                            onChange={(e) => setEndBlock(e.target.value)}
                        />
                        <span style={s.hint}>Market ends at this Bitcoin block height</span>
                    </div>

                    {question && (
                        <div style={s.preview}>
                            <span style={s.previewLabel}>PREVIEW</span>
                            <div style={s.previewCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontSize: 10, color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', padding: '3px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em' }}>ACTIVE</span>
                                    <span style={{ fontSize: 10, color: '#6b6b5e', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>{category}</span>
                                </div>
                                <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, fontFamily: "'Syne', sans-serif", color: '#f0ede6' }}>{question}</p>
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

                    {error && (
                        <div style={s.error}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {walletAddress ? (
                        <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
                            {loading ? 'CREATING...' : 'CREATE MARKET'}
                        </button>
                    ) : (
                        <button style={s.submitBtn} onClick={openConnectModal}>
                            CONNECT WALLET TO CREATE
                        </button>
                    )}

                    {walletAddress && (
                        <p style={{ fontSize: 10, color: '#6b6b5e', textAlign: 'center' as const, fontFamily: "'DM Mono', monospace" }}>
                            Creating as: <span style={{ color: '#f0ede6' }}>
                                {walletAddress.slice(0, 14)}...{walletAddress.slice(-6)}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    sectionLabel: { fontSize: 11, letterSpacing: '0.16em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'DM Mono', monospace" },
    form: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 28, display: 'flex', flexDirection: 'column', gap: 22 },
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
