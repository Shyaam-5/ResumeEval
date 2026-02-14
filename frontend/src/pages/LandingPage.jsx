import { useNavigate } from 'react-router-dom';
import { Shield, Users, Brain, FileCheck, Eye, ArrowRight } from 'lucide-react';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            {/* Hero */}
            <div style={{
                position: 'relative',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '2rem',
                overflow: 'hidden'
            }}>
                {/* Background effects */}
                <div style={{
                    position: 'absolute',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(108, 92, 231, 0.12), transparent 70%)',
                    top: '-200px',
                    right: '-200px',
                    pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'absolute',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(0, 206, 201, 0.08), transparent 70%)',
                    bottom: '-150px',
                    left: '-150px',
                    pointerEvents: 'none'
                }} />

                {/* Nav */}
                <nav style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '1rem 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid var(--border-color)',
                    zIndex: 100,
                    background: 'rgba(10, 10, 15, 0.8)'
                }}>
                    <h1 style={{
                        fontSize: '1.3rem',
                        fontWeight: 800,
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        🛡️ SkillProctor
                    </h1>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-outline" onClick={() => navigate('/candidate/login')}>
                            Candidate Login
                        </button>
                        <button className="btn btn-primary" onClick={() => navigate('/admin/login')}>
                            Admin Login
                        </button>
                    </div>
                </nav>

                {/* Hero Content */}
                <div className="animate-fade-in" style={{ maxWidth: '800px', position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 1rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(108, 92, 231, 0.1)',
                        border: '1px solid rgba(108, 92, 231, 0.3)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary-light)',
                        marginBottom: '1.5rem'
                    }}>
                        <Shield size={14} />
                        AI-Powered Technical Assessment Platform
                    </div>

                    <h1 style={{
                        fontSize: '3.5rem',
                        fontWeight: 900,
                        lineHeight: 1.1,
                        letterSpacing: '-1.5px',
                        marginBottom: '1.25rem',
                        background: 'linear-gradient(135deg, #f0f0f5, #a29bfe, #74b9ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Hire Smarter with<br />AI-Driven Assessments
                    </h1>

                    <p style={{
                        fontSize: '1.15rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto 2rem',
                        lineHeight: 1.7
                    }}>
                        Upload a resume, auto-generate skill-based tests, conduct AI interviews,
                        and get comprehensive reports — all with full proctoring.
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-lg" onClick={() => navigate('/admin/login')}>
                            Get Started <ArrowRight size={18} />
                        </button>
                        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/candidate/login')}>
                            Take Assessment
                        </button>
                    </div>
                </div>

                {/* Feature cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    maxWidth: '1000px',
                    width: '100%',
                    marginTop: '4rem',
                    position: 'relative',
                    zIndex: 1
                }}>
                    {[
                        { icon: <FileCheck size={28} />, title: 'Resume Parsing', desc: 'Auto-extract skills, GitHub, LinkedIn & coding profiles', color: 'var(--accent-primary-light)' },
                        { icon: <Brain size={28} />, title: 'AI Test Generation', desc: 'Dynamic MCQ & coding challenges based on skills', color: 'var(--accent-secondary)' },
                        { icon: <Users size={28} />, title: 'AI Interview', desc: 'Adaptive questions based on resume & projects', color: 'var(--accent-success)' },
                        { icon: <Eye size={28} />, title: 'Full Proctoring', desc: 'Camera, tab switch, eye tracking & phone detection', color: 'var(--accent-warning)' }
                    ].map((f, i) => (
                        <div key={i} className="card animate-fade-in" style={{
                            animationDelay: `${i * 0.1}s`,
                            textAlign: 'left',
                            cursor: 'default'
                        }}>
                            <div style={{ color: f.color, marginBottom: '0.75rem' }}>{f.icon}</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>{f.title}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
