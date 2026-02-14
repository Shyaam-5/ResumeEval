import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidateLogin } from '../api';
import { Mail, Hash } from 'lucide-react';

export default function CandidateLogin() {
    const [email, setEmail] = useState('');
    const [candidateId, setCandidateId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await candidateLogin({ email, candidate_id: parseInt(candidateId) });
            localStorage.setItem('candidate', JSON.stringify(res.data.candidate));
            navigate('/candidate/portal');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check your email and candidate ID.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h1>🛡️ SkillProctor</h1>
                <p className="subtitle">Candidate Assessment Portal</p>

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(225, 112, 85, 0.1)',
                        border: '1px solid var(--accent-danger)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-danger)',
                        fontSize: '0.85rem',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Candidate ID</label>
                        <div style={{ position: 'relative' }}>
                            <Hash size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                type="number"
                                placeholder="Enter your candidate ID"
                                value={candidateId}
                                onChange={(e) => setCandidateId(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
                        {loading ? <span className="loading-spinner" /> : 'Access Portal'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Your admin will provide your Candidate ID and email
                </p>
            </div>
        </div>
    );
}
