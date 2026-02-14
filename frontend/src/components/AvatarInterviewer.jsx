import { useEffect, useState } from 'react';

/**
 * AvatarInterviewer — Animated SVG virtual interviewer
 *
 * Props:
 *   isSpeaking   – avatar mouth animates, ring pulses
 *   isListening  – avatar shows attentive posture
 *   isThinking   – avatar "thinking" expression (eyes up, subtle tilt)
 *   emotion      – 'neutral' | 'happy' | 'concerned'
 *   category     – current question category label
 *   difficulty   – 'easy' | 'medium' | 'hard'
 */
export default function AvatarInterviewer({
    isSpeaking = false,
    isListening = false,
    isThinking = false,
    emotion = 'neutral',
    category = '',
    difficulty = '',
}) {
    const [blinkTrigger, setBlinkTrigger] = useState(false);

    // Periodic blink
    useEffect(() => {
        const interval = setInterval(() => {
            setBlinkTrigger(true);
            setTimeout(() => setBlinkTrigger(false), 200);
        }, 3000 + Math.random() * 2000);
        return () => clearInterval(interval);
    }, []);

    const stateClass = isSpeaking
        ? 'avatar-speaking'
        : isThinking
            ? 'avatar-thinking'
            : isListening
                ? 'avatar-listening'
                : 'avatar-idle';

    const emotionClass = `avatar-emotion-${emotion}`;

    // Mouth shape — when speaking, animate open/close via CSS
    const getMouthPath = () => {
        if (isSpeaking) return null; // CSS handles via animation class
        if (emotion === 'happy') return 'M 85,155 Q 100,170 115,155'; // smile
        if (emotion === 'concerned') return 'M 85,160 Q 100,152 115,160'; // slight frown
        return 'M 88,155 Q 100,162 112,155'; // neutral slight smile
    };

    const diffBadgeClass =
        difficulty === 'easy'
            ? 'badge-passed'
            : difficulty === 'hard'
                ? 'badge-failed'
                : 'badge-pending';

    return (
        <div className={`avatar-panel`}>
            {/* Glow ring */}
            <div className={`avatar-ring-wrapper ${stateClass}`}>
                <div className="avatar-ring" />
                <div className="avatar-ring avatar-ring-inner" />

                {/* SVG Avatar */}
                <svg
                    className={`avatar-svg ${stateClass} ${emotionClass} ${blinkTrigger ? 'avatar-blink' : ''}`}
                    viewBox="0 0 200 220"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Shoulders / Body */}
                    <g className="avatar-body">
                        <path
                            d="M 40,210 Q 40,175 65,165 L 100,158 L 135,165 Q 160,175 160,210 Z"
                            fill="url(#bodyGrad)"
                            stroke="rgba(108,92,231,0.3)"
                            strokeWidth="1"
                        />
                        {/* Collar / tie line */}
                        <path
                            d="M 93,158 L 100,180 L 107,158"
                            fill="none"
                            stroke="rgba(162,155,254,0.5)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </g>

                    {/* Neck */}
                    <rect x="90" y="140" width="20" height="22" rx="8"
                        fill="url(#skinGrad)" />

                    {/* Head */}
                    <g className="avatar-head">
                        {/* Face */}
                        <ellipse cx="100" cy="100" rx="48" ry="52"
                            fill="url(#skinGrad)"
                            stroke="rgba(108,92,231,0.15)"
                            strokeWidth="1"
                        />

                        {/* Hair */}
                        <path
                            d="M 52,85 Q 52,45 100,42 Q 148,45 148,85 Q 148,65 100,58 Q 52,65 52,85 Z"
                            fill="url(#hairGrad)"
                        />
                        {/* Side hair */}
                        <path d="M 52,85 Q 48,90 50,105 Q 52,95 55,88 Z" fill="url(#hairGrad)" />
                        <path d="M 148,85 Q 152,90 150,105 Q 148,95 145,88 Z" fill="url(#hairGrad)" />

                        {/* Eyebrows */}
                        <g className="avatar-eyebrows">
                            <path
                                d="M 72,82 Q 80,78 88,82"
                                fill="none"
                                stroke="#2d2d42"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                className={isThinking ? 'eyebrow-raised-left' : ''}
                            />
                            <path
                                d="M 112,82 Q 120,78 128,82"
                                fill="none"
                                stroke="#2d2d42"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                className={isThinking ? 'eyebrow-raised-right' : ''}
                            />
                        </g>

                        {/* Eyes */}
                        <g className={`avatar-eyes ${blinkTrigger ? 'blink' : ''}`}>
                            {/* Left eye */}
                            <g className="avatar-eye-left">
                                <ellipse cx="80" cy="95" rx="8" ry="9"
                                    fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                                <circle cx={isThinking ? 78 : isListening ? 82 : 80}
                                    cy={isThinking ? 93 : 95} r="4.5" fill="#2d2d42" />
                                <circle cx={isThinking ? 77 : isListening ? 81 : 79}
                                    cy={isThinking ? 91 : 93} r="1.5" fill="white" />
                            </g>
                            {/* Right eye */}
                            <g className="avatar-eye-right">
                                <ellipse cx="120" cy="95" rx="8" ry="9"
                                    fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                                <circle cx={isThinking ? 118 : isListening ? 122 : 120}
                                    cy={isThinking ? 93 : 95} r="4.5" fill="#2d2d42" />
                                <circle cx={isThinking ? 117 : isListening ? 121 : 119}
                                    cy={isThinking ? 91 : 93} r="1.5" fill="white" />
                            </g>
                        </g>

                        {/* Nose */}
                        <path
                            d="M 98,105 Q 100,115 96,118 Q 100,120 104,118 Q 100,115 102,105"
                            fill="none"
                            stroke="rgba(0,0,0,0.08)"
                            strokeWidth="1"
                        />

                        {/* Mouth */}
                        <g className={`avatar-mouth ${isSpeaking ? 'speaking' : ''}`}>
                            {isSpeaking ? (
                                <>
                                    {/* Animated mouth — CSS toggles between these */}
                                    <ellipse className="mouth-open" cx="100" cy="155" rx="10" ry="6"
                                        fill="#c0392b" opacity="0.85" />
                                    <ellipse className="mouth-teeth" cx="100" cy="152" rx="7" ry="2"
                                        fill="white" opacity="0.9" />
                                </>
                            ) : (
                                <path
                                    d={getMouthPath()}
                                    fill="none"
                                    stroke="#c0392b"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            )}
                        </g>

                        {/* Ear hints */}
                        <ellipse cx="52" cy="100" rx="5" ry="8" fill="url(#skinGrad)"
                            stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                        <ellipse cx="148" cy="100" rx="5" ry="8" fill="url(#skinGrad)"
                            stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                    </g>

                    {/* Gradients */}
                    <defs>
                        <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f0c8a0" />
                            <stop offset="100%" stopColor="#e0b090" />
                        </linearGradient>
                        <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1a1a2e" />
                            <stop offset="100%" stopColor="#2d2d42" />
                        </linearGradient>
                        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6c5ce7" />
                            <stop offset="100%" stopColor="#5241d0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Name plate */}
            <div className="avatar-nameplate">
                <span className="avatar-name">AI Interviewer</span>
                {isSpeaking && <span className="avatar-status-dot speaking" />}
                {isListening && <span className="avatar-status-dot listening" />}
                {isThinking && <span className="avatar-status-dot thinking" />}
            </div>

            {/* Category & difficulty badges */}
            {(category || difficulty) && (
                <div className="avatar-badges">
                    {category && (
                        <span className="badge badge-skill">{category}</span>
                    )}
                    {difficulty && (
                        <span className={`badge ${diffBadgeClass}`}>{difficulty}</span>
                    )}
                </div>
            )}

            {/* Status text */}
            <div className="avatar-status-text">
                {isSpeaking && '🗣️ Asking question...'}
                {isListening && '👂 Listening to your answer...'}
                {isThinking && '🤔 Evaluating your response...'}
                {!isSpeaking && !isListening && !isThinking && '💬 Ready for your answer'}
            </div>
        </div>
    );
}
