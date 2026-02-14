import { useEffect, useRef, useState, useCallback } from 'react';
import { logProctoringEvent } from '../api';
import { Shield, Camera, Maximize, AlertTriangle } from 'lucide-react';

export default function ProctoringGuard({ candidateId, testType, testId, children, onViolation }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [violations, setViolations] = useState([]);
    const [showViolation, setShowViolation] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
    const violationCountRef = useRef(0);
    const graceRef = useRef(true);
    const mountedRef = useRef(true);

    // Grace period — ignore violations for first 5 seconds after entering
    const startGracePeriod = () => {
        graceRef.current = true;
        setTimeout(() => { if (mountedRef.current) graceRef.current = false; }, 5000);
    };

    useEffect(() => {
        startGracePeriod();
        return () => { mountedRef.current = false; };
    }, []);

    // Start webcam
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' },
                    audio: false,
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setCameraActive(true);
            } catch (err) {
                console.error('Camera access denied:', err);
                setCameraActive(false);
            }
        };
        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Log violation
    const addViolation = useCallback(async (eventType, details, severity = 'medium') => {
        if (graceRef.current) {
            console.log('[Proctoring] Grace period - skipping:', eventType);
            return;
        }

        violationCountRef.current += 1;
        setViolations(prev => [...prev, { eventType, details, severity, timestamp: new Date().toISOString() }]);

        setShowViolation(details);
        setTimeout(() => { if (mountedRef.current) setShowViolation(null); }, 3000);

        try {
            await logProctoringEvent({
                candidate_id: candidateId,
                test_type: testType,
                test_id: testId,
                event_type: eventType,
                details,
                severity,
            });
        } catch (e) {
            console.error('Failed to log proctoring event:', e);
        }

        if (onViolation) onViolation(violationCountRef.current, eventType);
    }, [candidateId, testType, testId, onViolation]);

    // Enter fullscreen (user-initiated)
    const enterFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
            setShowFullscreenPrompt(false);
            startGracePeriod();
        } catch (e) {
            console.error('Fullscreen failed:', e);
        }
    };

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                setShowFullscreenPrompt(true);
                addViolation('fullscreen_exit', 'Exited fullscreen mode', 'high');
            } else {
                setIsFullscreen(true);
                setShowFullscreenPrompt(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [addViolation]);

    // Tab switch / visibility detection
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                addViolation('tab_switch', 'Switched away from test tab', 'high');
            }
        };

        const handleBlur = () => {
            // Only log blur if we're in fullscreen (otherwise fullscreen prompt handles it)
            if (document.fullscreenElement) {
                addViolation('window_blur', 'Window lost focus', 'medium');
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('blur', handleBlur);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('blur', handleBlur);
        };
    }, [addViolation]);

    // Copy-paste prevention
    useEffect(() => {
        const handleCopyPaste = (e) => {
            e.preventDefault();
            addViolation('copy_paste', `Attempted ${e.type}`, 'low');
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            addViolation('right_click', 'Right-click detected', 'low');
        };

        document.addEventListener('copy', handleCopyPaste);
        document.addEventListener('paste', handleCopyPaste);
        document.addEventListener('cut', handleCopyPaste);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('copy', handleCopyPaste);
            document.removeEventListener('paste', handleCopyPaste);
            document.removeEventListener('cut', handleCopyPaste);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [addViolation]);

    // Keyboard shortcut prevention
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                (e.ctrlKey && ['c', 'v', 'x', 'a', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
                (e.altKey && e.key === 'Tab') ||
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
            ) {
                e.preventDefault();
                addViolation('keyboard_shortcut', `Blocked: ${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`, 'medium');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [addViolation]);

    return (
        <div>
            {/* Fullscreen Entry Prompt */}
            {showFullscreenPrompt && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{
                        textAlign: 'center', padding: '3rem', maxWidth: '500px',
                        background: 'var(--card-bg)', borderRadius: '1.5rem', border: '1px solid var(--border-color)',
                    }}>
                        <Shield size={64} style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
                        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Proctored Assessment</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                            This test requires <strong>fullscreen mode</strong> and <strong>webcam access</strong>.
                        </p>
                        <div style={{
                            textAlign: 'left', background: 'rgba(168,85,247,0.1)', borderRadius: '0.75rem',
                            padding: '1rem', margin: '1.25rem 0', fontSize: '0.9rem',
                        }}>
                            <p style={{ marginBottom: '0.4rem' }}>🔒 Fullscreen will be enforced</p>
                            <p style={{ marginBottom: '0.4rem' }}>📷 Camera will monitor your session</p>
                            <p style={{ marginBottom: '0.4rem' }}>🚫 Copy/paste and tab switching are tracked</p>
                            <p>⚠️ Excessive violations may auto-submit your test</p>
                        </div>
                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', fontSize: '1.1rem', padding: '0.9rem', marginTop: '0.5rem' }}
                            onClick={enterFullscreen}
                        >
                            <Maximize size={20} /> Enter Fullscreen & Start
                        </button>
                    </div>
                </div>
            )}

            {/* Proctoring Status Bar */}
            <div className="proctoring-bar">
                <div className="proctoring-indicators">
                    <div className="indicator">
                        <div className={`indicator-dot ${cameraActive ? 'green' : 'red'}`} />
                        <span>{cameraActive ? 'Camera Active' : 'Camera Off'}</span>
                    </div>
                    <div className="indicator">
                        <div className={`indicator-dot ${isFullscreen ? 'green' : 'red'}`} />
                        <span>{isFullscreen ? 'Fullscreen' : 'Not Fullscreen'}</span>
                    </div>
                    <div className="indicator">
                        <div className={`indicator-dot ${violations.length > 0 ? 'yellow' : 'green'}`} />
                        <span>Violations: {violations.length}</span>
                    </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    🛡️ Proctored Session
                </div>
            </div>

            {/* Violation Alert */}
            {showViolation && (
                <div className="violation-alert">
                    <AlertTriangle size={20} />
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Violation Detected</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>{showViolation}</p>
                    </div>
                </div>
            )}

            {/* Webcam Preview */}
            <div className="webcam-preview">
                <video ref={videoRef} autoPlay muted playsInline />
            </div>

            {/* Content */}
            <div style={{ paddingTop: '50px' }}>
                {children}
            </div>
        </div>
    );
}
