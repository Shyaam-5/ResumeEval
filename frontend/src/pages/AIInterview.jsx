import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startInterview, answerInterview } from '../api';
import ProctoringGuard from '../components/ProctoringGuard';
import { Send, Brain, MessageCircle, CheckCircle, Loader, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export default function AIInterview() {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const [questionData, setQuestionData] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [finalResult, setFinalResult] = useState(null);
    const [questionNum, setQuestionNum] = useState(1);
    const [totalQ, setTotalQ] = useState(10);

    // Speech states
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);

    const chatEndRef = useRef(null);
    const candidateRef = useRef(null);
    const recognitionRef = useRef(null);
    const synthRef = useRef(null);

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript = transcript;
                    }
                }
                setAnswer(finalTranscript + interimTranscript);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'aborted') {
                    setIsListening(false);
                }
            };

            recognition.onend = () => {
                // Auto-restart if still in listening mode
                if (recognitionRef.current?._shouldListen) {
                    try { recognition.start(); } catch (e) { /* ignore */ }
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;
            recognitionRef.current._shouldListen = false;
        }

        synthRef.current = window.speechSynthesis;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current._shouldListen = false;
                try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
            }
            if (synthRef.current) {
                synthRef.current.cancel();
            }
        };
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('candidate');
        if (!stored) { navigate('/candidate/login'); return; }
        candidateRef.current = JSON.parse(stored);
        loadInterview();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // Speak a question using TTS
    const speakText = useCallback((text) => {
        if (!synthRef.current || !ttsEnabled) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        // Try to use a good voice
        const voices = synthRef.current.getVoices();
        const goodVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
            || voices.find(v => v.lang.startsWith('en'));
        if (goodVoice) utterance.voice = goodVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    }, [ttsEnabled]);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current._shouldListen = false;
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            // Reset answer for new speech session if empty
            setAnswer('');
            recognitionRef.current._shouldListen = true;
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error('Failed to start speech recognition:', e);
            }
        }
    };

    const stopTTS = () => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    };

    const loadInterview = async () => {
        try {
            const res = await startInterview(interviewId);
            setQuestionData({
                question: res.data.question,
                category: res.data.category,
                difficulty: res.data.difficulty,
            });
            setQuestionNum(res.data.question_number);
            setTotalQ(res.data.total_questions);

            setChatHistory([{
                type: 'ai',
                content: res.data.question,
                category: res.data.category,
                difficulty: res.data.difficulty,
            }]);

            // Speak the first question
            setTimeout(() => speakText(res.data.question), 500);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to start interview');
            navigate('/candidate/portal');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim() || submitting) return;

        // Stop listening if active
        if (isListening) {
            recognitionRef.current._shouldListen = false;
            recognitionRef.current.stop();
            setIsListening(false);
        }
        stopTTS();

        const userAnswer = answer.trim();
        setAnswer('');

        // Add user message to chat
        setChatHistory(prev => [...prev, { type: 'user', content: userAnswer }]);

        setSubmitting(true);
        try {
            const res = await answerInterview({
                candidate_id: candidateRef.current.id,
                interview_id: parseInt(interviewId),
                answer: userAnswer,
            });

            // Add evaluation feedback
            if (res.data.evaluation) {
                setChatHistory(prev => [...prev, {
                    type: 'feedback',
                    score: res.data.evaluation.score,
                    feedback: res.data.evaluation.feedback,
                    strengths: res.data.evaluation.strengths,
                    weaknesses: res.data.evaluation.weaknesses,
                }]);
            }

            if (res.data.is_complete) {
                setIsComplete(true);
                setFinalResult({
                    score: res.data.overall_score,
                    passed: res.data.passed,
                });
            } else {
                // Add next question
                setQuestionNum(res.data.question_number);
                setChatHistory(prev => [...prev, {
                    type: 'ai',
                    content: res.data.next_question,
                    category: res.data.next_category,
                    difficulty: res.data.next_difficulty,
                }]);
                setQuestionData({
                    question: res.data.next_question,
                    category: res.data.next_category,
                    difficulty: res.data.next_difficulty,
                });

                // Speak the next question
                setTimeout(() => speakText(res.data.next_question), 300);
            }
        } catch (err) {
            console.error(err);
            setChatHistory(prev => [...prev, {
                type: 'error',
                content: 'Failed to submit answer. Please try again.',
            }]);
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitAnswer();
        }
    };

    if (loading) return (
        <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Preparing your AI interview...</p>
        </div>
    );

    if (isComplete && finalResult) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card animate-scale-in" style={{ maxWidth: '500px', width: '90%', textAlign: 'center', padding: '2.5rem' }}>
                    <div className={`score-circle ${finalResult.passed ? 'pass' : 'fail'}`} style={{ margin: '0 auto 1.5rem' }}>
                        {finalResult.score?.toFixed(1)}
                    </div>
                    <h2 style={{ marginBottom: '0.5rem' }}>
                        {finalResult.passed ? '🎉 Interview Passed!' : '😔 Interview Not Passed'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Your average score: {finalResult.score?.toFixed(1)}/10
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        {finalResult.passed
                            ? 'Excellent! You have successfully completed the entire assessment.'
                            : 'You needed at least 1/10 to pass. Contact your admin for feedback.'}
                    </p>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/candidate/portal')}>
                        Back to Portal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ProctoringGuard
            candidateId={candidateRef.current?.id}
            testType="interview"
            testId={parseInt(interviewId)}
        >
            <div className="interview-container" style={{ paddingBottom: '140px' }}>
                {/* Header */}
                <div className="test-header" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Brain size={24} style={{ color: 'var(--accent-primary-light)' }} />
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>AI Technical Interview</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Question {questionNum} of {totalQ}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* TTS toggle */}
                        <button
                            onClick={() => { setTtsEnabled(!ttsEnabled); stopTTS(); }}
                            className="btn btn-sm btn-secondary"
                            title={ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                            {ttsEnabled ? 'Voice On' : 'Voice Off'}
                        </button>
                        <div className="progress-bar" style={{ width: '120px' }}>
                            <div className="progress-fill" style={{ width: `${(questionNum / totalQ) * 100}%` }} />
                        </div>
                    </div>
                </div>

                {/* Chat */}
                <div className="interview-chat">
                    {chatHistory.map((msg, i) => {
                        if (msg.type === 'ai') {
                            return (
                                <div key={i} className="chat-bubble ai">
                                    <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Brain size={14} /> AI INTERVIEWER
                                        {msg.category && <span className="badge badge-skill" style={{ fontSize: '0.65rem' }}>{msg.category}</span>}
                                        {msg.difficulty && (
                                            <span className={`badge ${msg.difficulty === 'easy' ? 'badge-passed' : msg.difficulty === 'hard' ? 'badge-failed' : 'badge-pending'}`}
                                                style={{ fontSize: '0.65rem' }}>
                                                {msg.difficulty}
                                            </span>
                                        )}
                                        {/* Replay voice button */}
                                        <button
                                            onClick={() => speakText(msg.content)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary-light)', padding: 0 }}
                                            title="Read question aloud"
                                        >
                                            <Volume2 size={14} />
                                        </button>
                                    </div>
                                    <p>{msg.content}</p>
                                </div>
                            );
                        }

                        if (msg.type === 'user') {
                            return (
                                <div key={i} className="chat-bubble user">
                                    <div className="label">
                                        <MessageCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                        YOUR ANSWER
                                    </div>
                                    <p>{msg.content}</p>
                                </div>
                            );
                        }

                        if (msg.type === 'feedback') {
                            return (
                                <div key={i} style={{
                                    padding: '1rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    animation: 'fadeIn 0.3s ease',
                                    maxWidth: '85%',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>📊 EVALUATION</span>
                                        <span style={{
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            color: msg.score >= 7 ? 'var(--accent-success)' : msg.score >= 5 ? 'var(--accent-warning)' : 'var(--accent-danger)'
                                        }}>
                                            {msg.score}/10
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{msg.feedback}</p>
                                    {msg.strengths?.length > 0 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            {msg.strengths.map((s, j) => (
                                                <span key={j} style={{ fontSize: '0.8rem', color: 'var(--accent-success)', marginRight: '0.5rem' }}>✓ {s}</span>
                                            ))}
                                        </div>
                                    )}
                                    {msg.weaknesses?.length > 0 && (
                                        <div style={{ marginTop: '0.25rem' }}>
                                            {msg.weaknesses.map((w, j) => (
                                                <span key={j} style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', marginRight: '0.5rem' }}>✗ {w}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        if (msg.type === 'error') {
                            return (
                                <div key={i} style={{
                                    padding: '0.75rem',
                                    background: 'rgba(225, 112, 85, 0.1)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--accent-danger)',
                                    color: 'var(--accent-danger)',
                                    fontSize: '0.9rem'
                                }}>
                                    {msg.content}
                                </div>
                            );
                        }
                        return null;
                    })}

                    {submitting && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem',
                            padding: '0.5rem'
                        }}>
                            <Loader size={16} className="loading-spinner" style={{ borderWidth: '2px', animation: 'spin 0.6s linear infinite' }} />
                            AI is evaluating your answer...
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Answer Input with Speech */}
                {!isComplete && (
                    <div style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '1rem 2rem',
                        background: 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border-color)',
                        zIndex: 50,
                    }}>
                        {/* Listening indicator */}
                        {isListening && (
                            <div style={{
                                textAlign: 'center',
                                marginBottom: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                            }}>
                                <span style={{
                                    width: '10px', height: '10px',
                                    borderRadius: '50%', background: '#ff4444',
                                    animation: 'pulse 1s ease-in-out infinite',
                                    display: 'inline-block',
                                }} />
                                <span style={{ fontSize: '0.8rem', color: '#ff4444', fontWeight: 600 }}>
                                    Listening... Speak your answer clearly
                                </span>
                            </div>
                        )}

                        {/* Speaking indicator */}
                        {isSpeaking && (
                            <div style={{
                                textAlign: 'center',
                                marginBottom: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                            }}>
                                <Volume2 size={14} style={{ color: 'var(--accent-primary-light)', animation: 'pulse 1s ease-in-out infinite' }} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary-light)', fontWeight: 600 }}>
                                    AI is speaking...
                                </span>
                                <button onClick={stopTTS} className="btn btn-sm" style={{ background: 'rgba(255,68,68,0.2)', color: '#ff4444', padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                                    Stop
                                </button>
                            </div>
                        )}

                        <div className="answer-input" style={{ maxWidth: '768px', margin: '0 auto', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                            {/* Mic button */}
                            {speechSupported && (
                                <button
                                    className="btn"
                                    onClick={toggleListening}
                                    disabled={submitting}
                                    style={{
                                        height: '60px', width: '60px', minWidth: '60px',
                                        borderRadius: '50%',
                                        background: isListening
                                            ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)'
                                            : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                                        color: 'white',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: isListening ? '0 0 20px rgba(255,68,68,0.4)' : '0 4px 15px rgba(0,0,0,0.2)',
                                        transition: 'all 0.3s ease',
                                        animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',
                                    }}
                                    title={isListening ? 'Stop listening' : 'Start speaking'}
                                >
                                    {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                                </button>
                            )}

                            {/* Text input */}
                            <div style={{ flex: 1, position: 'relative' }}>
                                <textarea
                                    className="form-textarea"
                                    style={{
                                        minHeight: '60px', maxHeight: '120px', resize: 'none', width: '100%',
                                        paddingRight: '1rem',
                                        border: isListening ? '2px solid #ff4444' : undefined,
                                        transition: 'border-color 0.3s ease',
                                    }}
                                    placeholder={isListening ? '🎤 Listening... your speech will appear here' : 'Type or click 🎤 to speak your answer...'}
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={submitting}
                                />
                            </div>

                            {/* Send button */}
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmitAnswer}
                                disabled={!answer.trim() || submitting}
                                style={{ height: '60px', width: '60px', minWidth: '60px' }}
                            >
                                {submitting ? <div className="loading-spinner" /> : <Send size={20} />}
                            </button>
                        </div>

                        {/* Help text */}
                        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '768px', margin: '0.4rem auto 0' }}>
                            🎤 Click the mic to speak • ⌨️ Or type your answer • Press Enter to submit
                        </p>
                    </div>
                )}
            </div>
        </ProctoringGuard>
    );
}
