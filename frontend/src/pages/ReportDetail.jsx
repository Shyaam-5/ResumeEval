import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCandidateReport } from '../api';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Star, Target, TrendingUp } from 'lucide-react';

export default function ReportDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadReport(); }, [id]);

    const loadReport = async () => {
        try {
            const res = await getCandidateReport(id);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center" style={{ padding: '3rem' }}><div className="loading-spinner" /></div>;
    if (!data) return <p>Report not found</p>;

    const { report, candidate, interview_qa, mcq_details, violations } = data;
    const feedback = typeof report.detailed_feedback === 'string' ? JSON.parse(report.detailed_feedback) : report.detailed_feedback || {};
    const proctoring = typeof report.proctoring_summary === 'string' ? JSON.parse(report.proctoring_summary) : report.proctoring_summary || {};

    return (
        <div className="animate-fade-in">
            <button className="btn btn-secondary mb-4" onClick={() => navigate('/admin/reports')}>
                <ArrowLeft size={16} /> Back to Reports
            </button>

            {/* Report Header */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{candidate.name}</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{candidate.email}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div className={`score-circle ${report.overall_status === 'passed' ? 'pass' : 'fail'}`}>
                            {report.overall_status === 'passed' ? '✓' : report.overall_status === 'partial' ? '~' : '✗'}
                        </div>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'capitalize' }}>{report.overall_status}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Status</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>MCQ Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: report.mcq_passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {Math.round(report.mcq_score || 0)}%
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        {report.mcq_passed ? <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} /> : <XCircle size={20} style={{ color: 'var(--accent-danger)' }} />}
                    </div>
                </div>

                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Coding Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: report.coding_passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {Math.round(report.coding_score || 0)}%
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        {report.coding_passed ? <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} /> : <XCircle size={20} style={{ color: 'var(--accent-danger)' }} />}
                    </div>
                </div>

                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Interview Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: report.interview_passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {(report.interview_score || 0).toFixed(1)}/10
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        {report.interview_passed ? <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} /> : <XCircle size={20} style={{ color: 'var(--accent-danger)' }} />}
                    </div>
                </div>

                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Violations</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: proctoring.total_violations > 5 ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                        {proctoring.total_violations || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Tab: {proctoring.tab_switches || 0} | Face: {proctoring.face_not_detected || 0}
                    </div>
                </div>
            </div>

            {/* AI Report */}
            {feedback.summary && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Star size={18} style={{ color: 'var(--accent-warning)' }} /> AI Assessment Summary
                    </h3>
                    <p style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>{feedback.summary}</p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Strengths */}
                {feedback.strengths?.length > 0 && (
                    <div className="card">
                        <h3 style={{ color: 'var(--accent-success)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={18} /> Strengths
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {feedback.strengths.map((s, i) => (
                                <li key={i} style={{ padding: '0.4rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--accent-success)', flexShrink: 0 }}>✓</span> {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Areas for Improvement */}
                {feedback.areas_for_improvement?.length > 0 && (
                    <div className="card">
                        <h3 style={{ color: 'var(--accent-warning)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Target size={18} /> Areas for Improvement
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {feedback.areas_for_improvement.map((s, i) => (
                                <li key={i} style={{ padding: '0.4rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--accent-warning)', flexShrink: 0 }}>→</span> {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Recommendation */}
            {feedback.recommendation && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.75rem' }}>📋 Recommendation</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{feedback.recommendation}</p>
                </div>
            )}

            {/* Suggested Role Fit */}
            {feedback.suggested_role_fit?.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.75rem' }}>🎯 Suggested Role Fit</h3>
                    <div className="skill-tags">
                        {feedback.suggested_role_fit.map((r, i) => (
                            <span key={i} className="badge badge-skill" style={{ fontSize: '0.85rem', padding: '0.35rem 0.8rem' }}>{r}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Interview Q&A */}
            {interview_qa?.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>🎤 Interview Transcript</h3>
                    {interview_qa.map((qa, i) => (
                        <div key={i} style={{
                            padding: '1rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '0.75rem',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary-light)' }}>Q{i + 1}: {qa.question_data?.category || 'General'}</span>
                                {qa.score !== null && (
                                    <span style={{
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        color: qa.score >= 7 ? 'var(--accent-success)' : qa.score >= 5 ? 'var(--accent-warning)' : 'var(--accent-danger)'
                                    }}>
                                        {qa.score}/10
                                    </span>
                                )}
                            </div>
                            <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{qa.question}</p>
                            {qa.answer && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    <strong>Answer:</strong> {qa.answer}
                                </p>
                            )}
                            {qa.evaluation?.feedback && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    💡 {qa.evaluation.feedback}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
