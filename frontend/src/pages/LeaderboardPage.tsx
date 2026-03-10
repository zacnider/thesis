import { useApi } from '../hooks/useAPI';
import type { CSSProperties } from 'react';

interface LeaderboardResponse {
    leaderboard: Array<{
        rank: number;
        address: string;
        totalPredictions: number;
        correctPredictions: number;
        accuracy: number;
        winStreak: number;
        bestStreak: number;
        totalProfit: string;
    }>;
}

export default function LeaderboardPage() {
    const { data, loading } = useApi<LeaderboardResponse>('/leaderboard');
    const leaderboard = data?.leaderboard || [];

    return (
        <div className="page">
            <div className="container">
                <div style={s.sectionLabel}>// Leaderboard</div>
                <h1 className="page-title">Leaderboard</h1>
                <p className="page-subtitle">Top predictors — Can you beat Bob the AI?</p>

                {/* AI vs Human */}
                <div style={s.vsCard}>
                    <div style={s.vsInner}>
                        <div style={s.vsSide}>
                            <div style={{ ...s.vsIcon, border: '1px solid rgba(245,200,66,0.15)' }}>
                                <span style={{ fontSize: 22, color: '#f5c842' }}>&#x2B21;</span>
                            </div>
                            <div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#f5c842', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>BOB AI</span>
                                <span style={{ display: 'block', fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#f5c842' }}>72%</span>
                                <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>ACCURACY</span>
                            </div>
                        </div>

                        <div style={s.vsCenter}>
                            <div style={s.vsLine} />
                            <span style={s.vsText}>VS</span>
                            <div style={s.vsLine} />
                        </div>

                        <div style={s.vsSide}>
                            <div style={{ ...s.vsIcon, border: '1px solid rgba(99,102,241,0.2)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', fontFamily: "'Syne', sans-serif", letterSpacing: '0.06em' }}>BEST HUMAN</span>
                                <span style={{ display: 'block', fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#6366f1' }}>
                                    {leaderboard[0]?.accuracy || 0}%
                                </span>
                                <span style={{ fontSize: 10, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" }}>
                                    {leaderboard[0]?.address?.slice(0, 10) || 'N/A'}...
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="loading-pulse" style={{ height: 52, background: '#111110', border: '1px solid rgba(245,200,66,0.08)' }} />
                        ))}
                    </div>
                ) : leaderboard.length > 0 ? (
                    <div style={s.tableCard}>
                        <table style={s.table}>
                            <thead>
                                <tr style={s.thead}>
                                    <th style={s.th}>#</th>
                                    <th style={s.th}>PREDICTOR</th>
                                    <th style={s.th}>PREDICTIONS</th>
                                    <th style={s.th}>CORRECT</th>
                                    <th style={s.th}>ACCURACY</th>
                                    <th style={s.th}>STREAK</th>
                                    <th style={s.th}>BEST</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((u) => (
                                    <tr key={u.address} style={s.row}>
                                        <td style={s.td}>
                                            {u.rank <= 3 ? (
                                                <span style={{
                                                    ...s.medal,
                                                    border: `1px solid ${u.rank === 1 ? 'rgba(245,200,66,0.25)' : u.rank === 2 ? 'rgba(148,163,184,0.2)' : 'rgba(180,83,9,0.2)'}`,
                                                    color: u.rank === 1 ? '#f5c842' : u.rank === 2 ? '#94a3b8' : '#b45309',
                                                }}>
                                                    {u.rank}
                                                </span>
                                            ) : (
                                                <span style={{ fontWeight: 600, color: '#6b6b5e', paddingLeft: 8 }}>{u.rank}</span>
                                            )}
                                        </td>
                                        <td style={{ ...s.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                                            {u.address.slice(0, 12)}...{u.address.slice(-4)}
                                        </td>
                                        <td style={s.td}>{u.totalPredictions}</td>
                                        <td style={s.td}>{u.correctPredictions}</td>
                                        <td style={s.td}>
                                            <span style={{
                                                padding: '3px 8px', fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace",
                                                border: `1px solid ${u.accuracy >= 70 ? 'rgba(74,222,128,0.2)' : u.accuracy >= 50 ? 'rgba(245,200,66,0.2)' : 'rgba(248,113,113,0.2)'}`,
                                                color: u.accuracy >= 70 ? '#4ade80' : u.accuracy >= 50 ? '#f5c842' : '#f87171',
                                            }}>
                                                {u.accuracy}%
                                            </span>
                                        </td>
                                        <td style={s.td}>{u.winStreak}</td>
                                        <td style={s.td}>{u.bestStreak}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={s.empty}>
                        <p style={{ color: '#6b6b5e', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                            No predictions yet. Be the first predictor and claim the top spot!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

const s: Record<string, CSSProperties> = {
    sectionLabel: { fontSize: 11, letterSpacing: '0.16em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'DM Mono', monospace" },
    vsCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', marginBottom: 28, overflow: 'hidden' },
    vsInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, padding: '32px 28px' },
    vsSide: { display: 'flex', alignItems: 'center', gap: 16 },
    vsIcon: { width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    vsCenter: { display: 'flex', alignItems: 'center', gap: 12 },
    vsLine: { width: 28, height: 1, background: 'rgba(245,200,66,0.15)' },
    vsText: { fontSize: 14, fontWeight: 800, color: '#6b6b5e', fontFamily: "'Syne', sans-serif", letterSpacing: '2px' },
    tableCard: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { borderBottom: '1px solid rgba(245,200,66,0.15)' },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: 10, color: '#6b6b5e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'DM Mono', monospace" },
    row: { borderBottom: '1px solid rgba(245,200,66,0.06)' },
    td: { padding: '12px 16px', fontSize: 12, color: '#6b6b5e', fontFamily: "'DM Mono', monospace" },
    medal: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, fontSize: 14, fontWeight: 800, fontFamily: "'Syne', sans-serif" },
    empty: { background: '#111110', border: '1px solid rgba(245,200,66,0.15)', padding: 48, textAlign: 'center' },
};
