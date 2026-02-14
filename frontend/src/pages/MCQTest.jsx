import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startMCQ, submitMCQ } from '../api';
import ProctoringGuard from '../components/ProctoringGuard';
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react';

export default function MCQTest() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [currentQ, setCurrentQ] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3600);
    const [endTime, setEndTime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [testReady, setTestReady] = useState(false);
    const candidateRef = useRef(null);

    useEffect(() => {
        const stored = localStorage.getItem('candidate');
        if (!stored) { navigate('/candidate/login'); return; }
        candidateRef.current = JSON.parse(stored);
        loadTest();
    }, []);

    const loadTest = async () => {
        try {
            const res = await startMCQ(testId);
            setQuestions(res.data.questions);
            // Fix: ensure end_time is parsed as UTC by appending 'Z' if missing
            let endTimeStr = res.data.end_time;
            if (endTimeStr && !endTimeStr.endsWith('Z') && !endTimeStr.includes('+')) {
                endTimeStr += 'Z';
            }
            const parsedEnd = new Date(endTimeStr);
            console.log('End time (UTC):', endTimeStr, 'Parsed:', parsedEnd, 'Now:', new Date());
            setEndTime(parsedEnd);
            if (res.data.existing_answers) setAnswers(res.data.existing_answers);
            // Give a 3-second grace period before proctoring kicks in
            setTimeout(() => setTestReady(true), 3000);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to load test');
            navigate('/candidate/portal');
        } finally {
            setLoading(false);
        }
    };

    // Timer
    useEffect(() => {
        if (!endTime || submitted) return;
        // Initial diff check — if end time is already far in the past, it's a timezone issue
        const initialDiff = Math.floor((endTime - new Date()) / 1000);
        if (initialDiff < -60) {
            console.warn('End time appears to be in the past — possible timezone issue. Using duration fallback.');
            return;
        }
        const interval = setInterval(() => {
            const diff = Math.max(0, Math.floor((endTime - new Date()) / 1000));
            setTimeLeft(diff);
            if (diff <= 0 && testReady) {
                clearInterval(interval);
                handleSubmit();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime, testReady, submitted]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswer = (questionId, optionIndex) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        if (submitting || submitted) return;
        setSubmitting(true);
        try {
            const res = await submitMCQ({
                candidate_id: candidateRef.current.id,
                test_id: parseInt(testId),
                answers,
            });
            setResult(res.data);
            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
            setShowConfirm(false);
        }
    };

    const handleViolation = useCallback((count, type) => {
        // Only auto-submit after test is ready (grace period passed) and many violations
        if (count >= 15 && testReady) {
            handleSubmit();
        }
    }, [testReady]);

    if (loading) return (
        <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Loading your test...</p>
        </div>
    );

    if (submitted && result) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card animate-scale-in" style={{ maxWidth: '500px', width: '90%', textAlign: 'center', padding: '2.5rem' }}>
                    <div className={`score-circle ${result.passed ? 'pass' : 'fail'}`} style={{ margin: '0 auto 1.5rem' }}>
                        {Math.round(result.score)}%
                    </div>
                    <h2 style={{ marginBottom: '0.5rem' }}>
                        {result.passed ? '🎉 Congratulations!' : '😔 Not Passed'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        You got {result.correct} out of {result.total} questions correct.
                    </p>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="progress-bar">
                            <div
                                className={`progress-fill ${result.passed ? 'success' : 'danger'}`}
                                style={{ width: `${result.score}%` }}
                            />
                        </div>
                    </div>
                    {result.passed ? (
                        <p style={{ color: 'var(--accent-success)', fontWeight: 600, marginBottom: '1.5rem' }}>
                            ✅ You passed! Proceed to the coding challenge.
                        </p>
                    ) : (
                        <p style={{ color: 'var(--accent-danger)', fontWeight: 600, marginBottom: '1.5rem' }}>
                            You needed 60% to pass. Contact your admin for next steps.
                        </p>
                    )}
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/candidate/portal')}>
                        Back to Portal
                    </button>
                </div>
            </div>
        );
    }

    const q = questions[currentQ];
    const answeredCount = Object.keys(answers).length;

    return (
        <ProctoringGuard
            candidateId={candidateRef.current?.id}
            testType="mcq"
            testId={parseInt(testId)}
            onViolation={handleViolation}
        >
            <div className="test-container">
                {/* Header */}
                <div className="test-header">
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>📝 Technical MCQ Test</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {answeredCount}/{questions.length} answered
                        </p>
                    </div>
                    <div className={`timer ${timeLeft < 300 ? 'danger' : timeLeft < 600 ? 'warning' : ''}`}>
                        <Clock size={20} />
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Progress */}
                <div className="progress-bar" style={{ marginBottom: '1rem' }}>
                    <div className="progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
                </div>

                {/* Question Navigator */}
                <div className="question-nav">
                    {questions.map((_, i) => (
                        <button
                            key={i}
                            className={`question-nav-btn ${i === currentQ ? 'active' : ''} ${answers[questions[i]?.id] !== undefined ? 'answered' : ''}`}
                            onClick={() => setCurrentQ(i)}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                {/* Question */}
                {q && (
                    <div className="question-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span className="question-number">Question {currentQ + 1} of {questions.length}</span>
                            {q.skill && <span className="badge badge-skill">{q.skill}</span>}
                            {q.difficulty && (
                                <span className={`badge ${q.difficulty === 'easy' ? 'badge-passed' : q.difficulty === 'hard' ? 'badge-failed' : 'badge-pending'}`}>
                                    {q.difficulty}
                                </span>
                            )}
                        </div>
                        <p className="question-text">{q.question}</p>

                        <div className="option-list">
                            {q.options?.map((opt, i) => (
                                <div
                                    key={i}
                                    className={`option-item ${answers[q.id] === i ? 'selected' : ''}`}
                                    onClick={() => handleAnswer(q.id, i)}
                                >
                                    <div className="option-radio" />
                                    <span>{opt}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                        disabled={currentQ === 0}
                    >
                        <ChevronLeft size={18} /> Previous
                    </button>

                    {currentQ < questions.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => setCurrentQ(currentQ + 1)}>
                            Next <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="btn btn-success btn-lg" onClick={() => setShowConfirm(true)}>
                            <Send size={18} /> Submit Test
                        </button>
                    )}
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '450px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} style={{ color: 'var(--accent-warning)', marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Submit Test?</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                You've answered {answeredCount} of {questions.length} questions.
                            </p>
                            {answeredCount < questions.length && (
                                <p style={{ color: 'var(--accent-warning)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                    ⚠️ {questions.length - answeredCount} questions are unanswered!
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Review Answers</button>
                                <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? <span className="loading-spinner" /> : 'Confirm Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ProctoringGuard>
    );
}
