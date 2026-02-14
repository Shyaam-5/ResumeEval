import { useState, useEffect } from 'react';
import { getDashboard, resetDatabase } from '../api';
import { Users, Clock, CheckCircle, XCircle, FileText, TrendingUp, RotateCcw, AlertTriangle } from 'lucide-react';
import Toast from '../components/Toast';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const res = await getDashboard();
            setStats(res.data.stats);
            setRecent(res.data.recent_candidates);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="loading-overlay" style={{ position: 'relative', background: 'transparent' }}>
            <div className="loading-spinner" />
            <p>Loading dashboard...</p>
        </div>
    );

    const statCards = [
        { label: 'Total Candidates', value: stats?.total_candidates || 0, icon: <Users size={22} />, color: 'purple' },
        { label: 'Pending', value: stats?.pending || 0, icon: <Clock size={22} />, color: 'yellow' },
        { label: 'In Progress', value: stats?.in_test || 0, icon: <TrendingUp size={22} />, color: 'blue' },
        { label: 'Completed', value: stats?.completed || 0, icon: <FileText size={22} />, color: 'teal' },
        { label: 'Passed All', value: stats?.passed || 0, icon: <CheckCircle size={22} />, color: 'green' },
        { label: 'Failed', value: stats?.failed || 0, icon: <XCircle size={22} />, color: 'orange' },
    ];

    const getStatusBadge = (status) => {
        const map = {
            pending: 'badge-pending',
            test1_ready: 'badge-pending',
            test1_in_progress: 'badge-in-progress',
            test1_passed: 'badge-passed',
            test1_failed: 'badge-failed',
            test2_in_progress: 'badge-in-progress',
            completed: 'badge-completed',
            test2_failed: 'badge-failed',
        };
        return map[status] || 'badge-pending';
    };

    const handleResetDB = async () => {
        setResetting(true);
        try {
            await resetDatabase();
            setToast({ message: '✅ Database reset successfully!', type: 'success' });
            setShowResetConfirm(false);
            loadDashboard();
        } catch (err) {
            setToast({ message: 'Failed to reset database', type: 'error' });
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Dashboard</h2>
                    <p>Overview of all assessment activities</p>
                </div>
                <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(225, 112, 85, 0.15)', color: 'var(--accent-danger)', border: '1px solid var(--accent-danger)' }}
                    onClick={() => setShowResetConfirm(true)}
                >
                    <RotateCcw size={14} /> Reset Database
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                {statCards.map((s, i) => (
                    <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                        <div className="stat-info">
                            <h4>{s.value}</h4>
                            <p>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Candidates */}
            <div className="card">
                <div className="card-header">
                    <h3>Recent Candidates</h3>
                </div>
                {recent.length > 0 ? (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Added</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map((c, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(c.status)}`}>
                                                {c.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Users size={48} />
                        <h3>No candidates yet</h3>
                        <p>Upload a resume to get started</p>
                    </div>
                )}
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} style={{ color: 'var(--accent-danger)', marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Reset Database?</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                This will permanently delete <strong>ALL candidates, tests, interviews, reports, and proctoring logs</strong>.
                            </p>
                            <p style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                                ⚠️ This action cannot be undone!
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                                <button
                                    className="btn"
                                    style={{ background: 'var(--accent-danger)', color: 'white' }}
                                    onClick={handleResetDB}
                                    disabled={resetting}
                                >
                                    {resetting ? <><span className="loading-spinner" /> Resetting...</> : <><RotateCcw size={14} /> Yes, Reset Everything</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
