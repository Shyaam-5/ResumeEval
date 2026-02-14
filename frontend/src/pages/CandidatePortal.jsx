import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTestInfo } from '../api';
import { CheckCircle, XCircle, Clock, PlayCircle, Lock, ArrowRight, LogOut } from 'lucide-react';

export default function CandidatePortal() {
    const [candidate, setCandidate] = useState(null);
    const [testInfo, setTestInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const stored = localStorage.getItem('candidate');
        if (!stored) {
            navigate('/candidate/login');
            return;
        }
        const c = JSON.parse(stored);
        setCandidate(c);
        loadTestInfo(c.id);
    }, []);

    const loadTestInfo = async (candidateId) => {
        try {
            const res = await getTestInfo(candidateId);
            setTestInfo(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('candidate');
        navigate('/candidate/login');
    };

    if (loading) return (
        <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Loading your assessment...</p>
        </div>
    );

    const mcq = testInfo?.mcq_test;
    const coding = testInfo?.coding_test;
    const interview = testInfo?.interview;
    const status = testInfo?.candidate?.status;

    const canStartMCQ = mcq && ['pending', 'in_progress'].includes(mcq.status);
    const canStartCoding = coding && mcq?.status === 'passed' && ['pending', 'in_progress'].includes(coding.status);
    const canStartInterview = interview && ['pending', 'in_progress'].includes(interview.status);

    const getStepStatus = (step) => {
        if (step === 'mcq') {
            if (!mcq) return 'locked';
            if (mcq.status === 'passed') return 'passed';
            if (mcq.status === 'failed') return 'failed';
            if (mcq.status === 'in_progress') return 'active';
            if (mcq.status === 'pending') return 'ready';
            return 'locked';
        }
        if (step === 'coding') {
            if (!coding) return 'locked';
            if (coding.status === 'passed') return 'passed';
            if (coding.status === 'failed') return 'failed';
            if (coding.status === 'in_progress') return 'active';
            if (mcq?.status === 'passed' && coding.status === 'pending') return 'ready';
            return 'locked';
        }
        if (step === 'sql') {
            if (testInfo?.candidate?.sql_passed) return 'passed';
            if (coding?.status === 'passed') return 'ready';
            return 'locked';
        }
        if (step === 'interview') {
            if (!interview) return 'locked';
            // Lock interview until SQL is passed
            if (!testInfo?.candidate?.sql_passed) return 'locked';

            if (interview.status === 'passed') return 'passed';
            if (interview.status === 'failed') return 'failed';
            if (interview.status === 'in_progress') return 'active';
            if (interview.status === 'pending') return 'ready';
            return 'locked';
        }
        return 'locked';
    };

    const steps = [
        {
            key: 'mcq',
            title: 'Technical MCQ Test',
            description: 'Multiple choice questions based on your skills',
            icon: '📝',
            details: mcq ? `${mcq.total_marks} questions • ${mcq.duration_minutes} minutes • Pass: 60%` : 'Not generated yet',
            score: mcq?.score,
        },
        {
            key: 'coding',
            title: 'Coding Challenge',
            description: 'Solve coding problems to prove your skills',
            icon: '💻',
            details: coding ? `${coding.total_marks / 10} problems • Pass: 50%` : 'Complete MCQ first',
            score: coding?.score,
        },
        {
            key: 'sql',
            title: 'SQL Challenge',
            description: 'Write SQL queries to solve database problems',
            icon: '🗄️',
            details: '4 problems • Practice with real database',
            score: testInfo?.candidate?.sql_passed ? 'Completed' : null,
        },
        {
            key: 'interview',
            title: 'AI Interview',
            description: 'Interactive interview based on your resume & projects',
            icon: '🤖',
            details: interview ? `${interview.total_questions} questions • Pass: 6/10` : 'Complete Test 1 first',
            score: interview?.overall_score,
        },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div style={{
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
            }}>
                <div>
                    <h1 style={{
                        fontSize: '1.3rem',
                        fontWeight: 800,
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>🛡️ SkillProctor</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Welcome, <strong style={{ color: 'var(--text-primary)' }}>{candidate?.name}</strong>
                    </span>
                    <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
                <div className="animate-fade-in">
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Your Assessment Journey</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Complete all stages to finish your assessment. Each stage must be passed before moving to the next.
                    </p>

                    {!mcq && (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginBottom: '2rem' }}>
                            <Clock size={48} style={{ color: 'var(--accent-warning)', marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Assessment Not Ready Yet</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Your admin hasn't generated your test yet. Please check back later.</p>
                        </div>
                    )}

                    {/* Steps */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {steps.map((step, i) => {
                            const stepStatus = getStepStatus(step.key);
                            const isLocked = stepStatus === 'locked';
                            const isPassed = stepStatus === 'passed';
                            const isFailed = stepStatus === 'failed';
                            const isReady = stepStatus === 'ready';
                            const isActive = stepStatus === 'active';

                            return (
                                <div
                                    key={step.key}
                                    className="card"
                                    style={{
                                        opacity: isLocked ? 0.5 : 1,
                                        border: isActive ? '1px solid var(--accent-primary)' : isPassed ? '1px solid var(--accent-success)' : isFailed ? '1px solid var(--accent-danger)' : undefined,
                                        animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{
                                                fontSize: '2rem',
                                                width: '56px', height: '56px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderRadius: 'var(--radius-md)',
                                                background: isPassed ? 'rgba(0, 184, 148, 0.1)' : isFailed ? 'rgba(225, 112, 85, 0.1)' : 'var(--bg-tertiary)',
                                            }}>
                                                {isPassed ? <CheckCircle size={28} style={{ color: 'var(--accent-success)' }} /> :
                                                    isFailed ? <XCircle size={28} style={{ color: 'var(--accent-danger)' }} /> :
                                                        isLocked ? <Lock size={24} style={{ color: 'var(--text-muted)' }} /> :
                                                            step.icon}
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.15rem' }}>
                                                    Stage {i + 1}: {step.title}
                                                </h3>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{step.description}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{step.details}</p>
                                                {(isPassed || isFailed) && step.score !== undefined && (
                                                    <p style={{
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        color: isPassed ? 'var(--accent-success)' : 'var(--accent-danger)',
                                                        marginTop: '0.25rem'
                                                    }}>
                                                        Score: {typeof step.score === 'number' ? (step.key === 'interview' ? `${step.score.toFixed(1)}/10` : `${Math.round(step.score)}%`) : step.score}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {(isReady || isActive) && (
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => {
                                                    if (step.key === 'mcq') navigate(`/candidate/mcq/${mcq.id}`);
                                                    if (step.key === 'coding') navigate(`/candidate/coding/${coding.id}`);
                                                    if (step.key === 'sql') navigate('/candidate/sql');
                                                    if (step.key === 'interview') navigate(`/candidate/interview/${interview.id}`);
                                                }}
                                            >
                                                {isActive ? 'Resume' : 'Start'} <ArrowRight size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Completion */}
                    {status === 'completed' && (
                        <div className="card animate-scale-in" style={{
                            marginTop: '2rem',
                            textAlign: 'center',
                            padding: '2rem',
                            border: '1px solid var(--accent-success)',
                            background: 'rgba(0, 184, 148, 0.05)'
                        }}>
                            <CheckCircle size={48} style={{ color: 'var(--accent-success)', marginBottom: '1rem' }} />
                            <h3 style={{ color: 'var(--accent-success)', marginBottom: '0.5rem' }}>Assessment Complete!</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Congratulations! You have completed all stages. Your results will be reviewed by the admin.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
