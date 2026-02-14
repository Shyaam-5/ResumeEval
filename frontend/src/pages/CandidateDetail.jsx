import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCandidate, generateTest } from '../api';
import { ArrowLeft, Github, Linkedin, Code, Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import Toast from '../components/Toast';

export default function CandidateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => { loadCandidate(); }, [id]);

    const loadCandidate = async () => {
        try {
            const res = await getCandidate(id);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTest = async () => {
        setGenerating(true);
        try {
            await generateTest(id);
            setToast({ message: 'Test generated successfully!', type: 'success' });
            loadCandidate();
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed', type: 'error' });
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div className="text-center" style={{ padding: '3rem' }}><div className="loading-spinner" /></div>;
    if (!data) return <p>Candidate not found</p>;

    const { candidate, mcq_test, coding_test, interview, report, violations } = data;

    return (
        <div className="animate-fade-in">
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}

            <button className="btn btn-secondary mb-4" onClick={() => navigate('/admin/candidates')}>
                <ArrowLeft size={16} /> Back
            </button>

            {/* Header */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{candidate.name}</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{candidate.email} {candidate.phone && `• ${candidate.phone}`}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Candidate ID: #{candidate.id} • Added: {new Date(candidate.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {candidate.status === 'pending' && (
                            <button className="btn btn-success" onClick={handleGenerateTest} disabled={generating}>
                                {generating ? <span className="loading-spinner" /> : <><Play size={16} /> Generate Test</>}
                            </button>
                        )}
                    </div>
                </div>

                {/* Links */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {candidate.github_url && (
                        <a href={candidate.github_url} target="_blank" className="btn btn-sm btn-secondary">
                            <Github size={14} /> GitHub
                        </a>
                    )}
                    {candidate.linkedin_url && (
                        <a href={candidate.linkedin_url} target="_blank" className="btn btn-sm btn-secondary">
                            <Linkedin size={14} /> LinkedIn
                        </a>
                    )}
                    {Object.entries(candidate.coding_platforms || {}).map(([p, url]) => (
                        <a key={p} href={url} target="_blank" className="btn btn-sm btn-secondary">
                            <Code size={14} /> {p}
                        </a>
                    ))}
                </div>

                {/* Skills */}
                <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Skills ({candidate.skills?.length})</label>
                    <div className="skill-tags" style={{ marginTop: '0.35rem' }}>
                        {(candidate.skills || []).map((s, i) => <span key={i} className="badge badge-skill">{s}</span>)}
                    </div>
                </div>
            </div>

            {/* Test Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* MCQ Test */}
                <div className="card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        📝 MCQ Test
                        {mcq_test && <span className={`badge ${mcq_test.status === 'passed' ? 'badge-passed' : mcq_test.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>{mcq_test.status}</span>}
                    </h3>
                    {mcq_test ? (
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: mcq_test.score >= 60 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {Math.round(mcq_test.score)}%
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Total Questions: {mcq_test.total_marks} • Duration: {mcq_test.duration_minutes}min
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Violations: {mcq_test.violation_count}
                            </p>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Not yet generated</p>
                    )}
                </div>

                {/* Coding Test */}
                <div className="card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        💻 Coding Test
                        {coding_test && <span className={`badge ${coding_test.status === 'passed' ? 'badge-passed' : coding_test.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>{coding_test.status}</span>}
                    </h3>
                    {coding_test ? (
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: coding_test.score >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {Math.round(coding_test.score)}%
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Total Problems: {coding_test.total_marks / 10}
                            </p>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Not yet generated</p>
                    )}
                </div>

                {/* AI Interview */}
                <div className="card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        🤖 AI Interview
                        {interview && <span className={`badge ${interview.status === 'passed' ? 'badge-passed' : interview.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>{interview.status}</span>}
                    </h3>
                    {interview ? (
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: interview.overall_score >= 6 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                {(interview.overall_score || 0).toFixed(1)}/10
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Questions: {interview.total_questions} • Violations: {interview.violation_count}
                            </p>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Not yet available</p>
                    )}
                </div>
            </div>

            {/* Violations */}
            {violations && violations.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3><AlertTriangle size={18} style={{ color: 'var(--accent-warning)' }} /> Proctoring Violations ({violations.length})</h3>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Details</th>
                                    <th>Severity</th>
                                    <th>Test</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {violations.slice(0, 20).map((v, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{v.event_type?.replace(/_/g, ' ')}</td>
                                        <td style={{ color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.details}</td>
                                        <td>
                                            <span className={`badge ${v.severity === 'high' ? 'badge-danger' : v.severity === 'medium' ? 'badge-pending' : 'badge-in-progress'}`}>
                                                {v.severity}
                                            </span>
                                        </td>
                                        <td>{v.test_type}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(v.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Report Link */}
            {report && (
                <div style={{ marginTop: '1rem' }}>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate(`/admin/reports/${id}`)}>
                        📊 View Detailed Report
                    </button>
                </div>
            )}
        </div>
    );
}
