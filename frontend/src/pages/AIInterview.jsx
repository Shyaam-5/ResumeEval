import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startInterview, answerInterview, textToSpeech } from '../api';
import ProctoringGuard from '../components/ProctoringGuard';
import Avatar3D from '../components/Avatar3D';
import { Send, Brain, MessageCircle, Mic, MicOff, Volume2, VolumeX, Loader } from 'lucide-react';

// Error Boundary for Avatar
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error("Avatar Error:", error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: '#ff7675', textAlign: 'center', background: 'rgba(0,0,0,0.5)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h4>Avatar Error</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{this.state.error?.message}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function AIInterview() {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const candidateRef = useRef(null);
    const chatEndRef = useRef(null);

    // State
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [questionData, setQuestionData] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [answer, setAnswer] = useState('');
    const [questionNum, setQuestionNum] = useState(1);
    const [totalQ, setTotalQ] = useState(5);
    const [ttsEnabled, setTtsEnabled] = useState(true);

    // Avatar State
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [avatarEmotion, setAvatarEmotion] = useState('neutral');

    // Speech Recognition
    const [speechSupported, setSpeechSupported] = useState(false);
    const recognitionRef = useRef(null);
    const audioRef = useRef(null);
    const blobUrlRef = useRef(null);
    const speakIdRef = useRef(0);

    useEffect(() => {
        // Load Candidate
        const stored = localStorage.getItem('candidate');
        if (!stored) { navigate('/candidate/login'); return; }
        candidateRef.current = JSON.parse(stored);

        // Init Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setSpeechSupported(true);
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setAnswer(prev => prev ? prev + ' ' + finalTranscript : finalTranscript);
                }
            };

            recognition.onerror = (event) => {
                console.error("Speech error", event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                if (isListening) setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        loadInterview();

        return () => {
            stopTTS();
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isThinking]);

    const loadInterview = async () => {
        try {
            setLoading(true);
            setIsThinking(true);
            const { data } = await startInterview(interviewId);
            setIsThinking(false);

            if (data.completed) {
                navigate('/candidate/portal');
                return;
            }

            setQuestionData(data);
            setQuestionNum(data.question_number || 1);
            setTotalQ(data.total_questions || 5);

            // Add initial question to chat
            if (data.question) {
                const msg = { type: 'ai', content: data.question };
                setChatHistory([msg]);
                speakText(data.question);
            }
        } catch (error) {
            console.error(error);
            setIsThinking(false);
            // navigate('/candidate/portal');
        } finally {
            setLoading(false);
        }
    };

    const stopTTS = () => {
        // Stop Deepgram audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        // Revoke blob URL to free memory
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
        // Also cancel any browser fallback speech
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    const speakText = async (text) => {
        if (!ttsEnabled) return;

        // Increment ID to invalidate any pending requests
        const currentId = ++speakIdRef.current;
        stopTTS();

        try {
            // Call Deepgram TTS via backend
            const { data: audioBlob } = await textToSpeech(text);

            // If a newer request started while fetching, ignore this one
            if (currentId !== speakIdRef.current) return;

            const url = URL.createObjectURL(audioBlob);
            blobUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onplay = () => setIsSpeaking(true);
            audio.onended = () => {
                if (currentId !== speakIdRef.current) return;
                setIsSpeaking(false);
                URL.revokeObjectURL(url);
                blobUrlRef.current = null;
            };
            audio.onerror = () => {
                if (currentId !== speakIdRef.current) return;
                setIsSpeaking(false);
                URL.revokeObjectURL(url);
                blobUrlRef.current = null;
                browserSpeak(text);
            };

            await audio.play();
        } catch (err) {
            if (currentId !== speakIdRef.current) return;
            console.warn('Deepgram TTS failed, using browser fallback:', err);
            browserSpeak(text);
        }
    };

    const browserSpeak = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            stopTTS(); // Stop speaking when listening starts
            recognitionRef.current.start();
            setIsListening(true);
            setAvatarEmotion('neutral');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitAnswer();
        }
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim() || submitting) return;

        if (isListening) toggleListening();
        stopTTS();

        const userAnswer = answer;
        setAnswer('');
        setSubmitting(true);
        setIsThinking(true); // Avatar enters thinking mode
        setAvatarEmotion('neutral');

        // Add user message
        setChatHistory(prev => [...prev, { type: 'user', content: userAnswer }]);

        try {
            const { data: result } = await answerInterview({
                interview_id: interviewId,
                candidate_id: candidateRef.current.id,
                answer: userAnswer
            });

            // Wait a bit for effect
            setTimeout(() => {
                setIsThinking(false);
                setSubmitting(false);

                // Show feedback
                if (result.feedback) {
                    setChatHistory(prev => [...prev, { type: 'feedback', content: 'Feedback', feedback: result.feedback, score: result.score }]);

                    // Update Emotion based on score
                    if (result.score >= 7) setAvatarEmotion('happy');
                    else if (result.score <= 4) setAvatarEmotion('concerned');
                    else setAvatarEmotion('neutral');
                }

                if (result.completed) {
                    setTimeout(() => navigate('/candidate/portal'), 3000);
                } else if (result.next_question) {
                    // Next Question
                    setTimeout(() => {
                        setQuestionData(prev => ({ ...prev, ...result }));
                        setQuestionNum(prev => prev + 1);
                        setChatHistory(prev => [...prev, { type: 'ai', content: result.next_question }]);
                        speakText(result.next_question);
                        setAvatarEmotion('neutral');
                    }, 2000);
                }
            }, 1000);

        } catch (error) {
            console.error(error);
            setIsThinking(false);
            setSubmitting(false);
            alert("Failed to submit answer");
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="loader"></span>
            </div>
        );
    }

    return (
        <ProctoringGuard
            candidateId={candidateRef.current?.id}
            testType="interview"
            testId={parseInt(interviewId)}
        >
            <div className="interview-split-layout">
                {/* ── Left Panel: 3D Avatar ── */}
                <ErrorBoundary>
                    <Avatar3D
                        isSpeaking={isSpeaking}
                        isListening={isListening}
                        isThinking={isThinking}
                        emotion={avatarEmotion}
                        category={questionData?.category}
                        difficulty={questionData?.difficulty}
                    />
                </ErrorBoundary>

                {/* ── Right Panel: Chat & Controls ── */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Header */}
                    <div className="card-header" style={{ marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontWeight: 700 }}>AI Technical Interview</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Question {questionNum} of {totalQ}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={() => { setTtsEnabled(!ttsEnabled); stopTTS(); }}
                                className="btn btn-sm btn-secondary"
                                title={ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
                            >
                                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            </button>
                            <div className="progress-bar" style={{ width: '80px' }}>
                                <div className="progress-fill" style={{ width: `${(questionNum / totalQ) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Chat History */}
                    <div className="chat-panel">
                        {chatHistory.map((msg, i) => {
                            if (msg.type === 'ai') {
                                return (
                                    <div key={i} className="chat-bubble ai animate-fade-in" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                            <Brain size={14} /> AI QUESTION
                                            <button
                                                onClick={() => speakText(msg.content)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary-light)', padding: 0, marginLeft: 'auto' }}
                                                title="Replay audio"
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
                                    <div key={i} className="chat-bubble user animate-slide-in">
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
                                    <div key={i} className="animate-scale-in" style={{
                                        padding: '1rem',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        marginBottom: '1rem',
                                        maxWidth: '90%',
                                        alignSelf: 'flex-start'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>📊 FEEDBACK</span>
                                            <span style={{
                                                fontSize: '1rem', fontWeight: 800,
                                                color: msg.score >= 7 ? 'var(--accent-success)' : msg.score >= 5 ? 'var(--accent-warning)' : 'var(--accent-danger)'
                                            }}>
                                                {msg.score}/10
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{msg.feedback}</p>
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {/* Typing / Thinking Indicator */}
                        {isThinking && (
                            <div className="chat-bubble ai animate-pulse" style={{ width: 'fit-content' }}>
                                <div style={{ display: 'flex', gap: '0.3rem', padding: '0.2rem' }}>
                                    <span className="typing-dot" style={{ animationDelay: '0s' }}>•</span>
                                    <span className="typing-dot" style={{ animationDelay: '0.2s' }}>•</span>
                                    <span className="typing-dot" style={{ animationDelay: '0.4s' }}>•</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{
                        marginTop: 'auto',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                            {/* Mic Button */}
                            {speechSupported && (
                                <button
                                    className="btn"
                                    onClick={toggleListening}
                                    disabled={submitting}
                                    style={{
                                        height: '50px', width: '50px', minWidth: '50px', padding: 0,
                                        borderRadius: '50%',
                                        background: isListening
                                            ? 'var(--gradient-danger)'
                                            : 'var(--gradient-primary)',
                                        color: 'white',
                                        border: 'none',
                                        boxShadow: isListening ? '0 0 15px rgba(225, 112, 85, 0.5)' : 'none',
                                        animation: isListening ? 'pulse 1.5s infinite' : 'none'
                                    }}
                                    title={isListening ? 'Stop listening' : 'Start speaking'}
                                >
                                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                </button>
                            )}

                            {/* Text Input */}
                            <div style={{ flex: 1 }}>
                                <textarea
                                    className="form-textarea"
                                    style={{
                                        minHeight: '50px',
                                        height: '50px',
                                        resize: 'none',
                                        width: '100%',
                                        border: isListening ? '2px solid var(--accent-danger)' : undefined
                                    }}
                                    placeholder={isListening ? 'Listening...' : 'Type your answer...'}
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={submitting}
                                />
                            </div>

                            {/* Send Button */}
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmitAnswer}
                                disabled={!answer.trim() || submitting}
                                style={{ height: '50px', width: '50px', minWidth: '50px', padding: 0 }}
                            >
                                {submitting ? <Loader size={20} className="spin" /> : <Send size={20} />}
                            </button>
                        </div>
                        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isListening ? '🔴 speaking now...' : 'Press Enter to submit'}
                        </p>
                    </div>
                </div>
            </div>
        </ProctoringGuard>
    );
}
