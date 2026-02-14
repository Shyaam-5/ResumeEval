import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startCoding, submitCode, finishCoding, runCode } from '../api';
import ProctoringGuard from '../components/ProctoringGuard';
import Editor from '@monaco-editor/react';
import { Play, Send, ChevronLeft, ChevronRight, CheckCircle, XCircle, Code2, Terminal, Loader, AlertTriangle } from 'lucide-react';

const LANGUAGE_CONFIG = {
    python: {
        label: 'Python',
        monaco: 'python',
        template: 'import sys\n\ndef solve():\n    # Read input using sys.stdin or input()\n    # input_data = sys.stdin.read().split()\n    \n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    solve()\n'
    },
    javascript: {
        label: 'JavaScript',
        monaco: 'javascript',
        template: 'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf-8").trim().split("\\n");\n\n// Write your solution here\n// console.log(result);\n'
    },
    java: {
        label: 'Java',
        monaco: 'java',
        template: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n'
    },
};

export default function CodingTest() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [problems, setProblems] = useState([]);
    const [currentProblem, setCurrentProblem] = useState(0);
    const [codes, setCodes] = useState({});
    const [languages, setLanguages] = useState({});
    const [customInput, setCustomInput] = useState('');
    const [output, setOutput] = useState('');
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState({});
    const [submitted, setSubmitted] = useState({});
    const [testResults, setTestResults] = useState({}); // per-problem test case results
    const [loading, setLoading] = useState(true);
    const [finishing, setFinishing] = useState(false);
    const [finished, setFinished] = useState(false);
    const [result, setResult] = useState(null);
    const [outputTab, setOutputTab] = useState('output'); // 'output' | 'testcases'
    const candidateRef = useRef(null);

    useEffect(() => {
        const stored = localStorage.getItem('candidate');
        if (!stored) { navigate('/candidate/login'); return; }
        candidateRef.current = JSON.parse(stored);
        loadTest();
    }, []);

    const loadTest = async () => {
        try {
            const res = await startCoding(testId);
            setProblems(res.data.problems);
            const initCodes = {};
            const initLangs = {};
            res.data.problems.forEach((p, i) => {
                const pid = p.id || i + 1;
                initCodes[pid] = LANGUAGE_CONFIG.python.template;
                initLangs[pid] = 'python';
            });
            if (res.data.existing_submissions) {
                Object.entries(res.data.existing_submissions).forEach(([pid, sub]) => {
                    initCodes[pid] = sub.code;
                    initLangs[pid] = sub.language;
                });
            }
            setCodes(initCodes);
            setLanguages(initLangs);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to load test');
            navigate('/candidate/portal');
        } finally {
            setLoading(false);
        }
    };

    const problem = problems[currentProblem];
    const problemId = problem?.id || currentProblem + 1;

    const handleRunCode = async () => {
        if (running) return;
        setRunning(true);
        setOutput('Running...');
        setOutputTab('output');
        try {
            const res = await runCode({
                code: codes[problemId] || '',
                language: languages[problemId] || 'python',
                input_data: customInput,
            });
            if (res.data.success) {
                setOutput(res.data.output || '(No output)');
            } else {
                setOutput(`Error:\n${res.data.error}\n\n${res.data.output || ''}`);
            }
        } catch (err) {
            setOutput('Failed to execute code. Server error.');
        } finally {
            setRunning(false);
        }
    };

    const handleSubmitCode = async () => {
        if (submitting[problemId]) return;
        setSubmitting(prev => ({ ...prev, [problemId]: true }));
        try {
            const res = await submitCode({
                candidate_id: candidateRef.current.id,
                test_id: parseInt(testId),
                problem_id: problemId,
                code: codes[problemId] || '',
                language: languages[problemId] || 'python',
            });
            setSubmitted(prev => ({ ...prev, [problemId]: true }));

            // Store test case results
            if (res.data.test_results) {
                setTestResults(prev => ({
                    ...prev,
                    [problemId]: {
                        results: res.data.test_results,
                        passed_count: res.data.passed_count,
                        total_count: res.data.total_count,
                        all_passed: res.data.all_passed,
                    }
                }));
                setOutputTab('testcases');
            }
        } catch (err) {
            alert('Failed to submit code');
        } finally {
            setSubmitting(prev => ({ ...prev, [problemId]: false }));
        }
    };

    const handleFinish = async () => {
        if (finishing) return;
        const confirmMsg = `You have submitted ${Object.keys(submitted).length} of ${problems.length} problems.\n\nAre you sure you want to finish the coding test?`;
        if (!window.confirm(confirmMsg)) return;
        setFinishing(true);
        try {
            const res = await finishCoding(testId);
            setResult(res.data);
            setFinished(true);
        } catch (err) {
            alert('Failed to finish test');
        } finally {
            setFinishing(false);
        }
    };

    const handleViolation = (count) => {
        if (count >= 15) handleFinish();
    };

    const currentTestResult = testResults[problemId];

    if (loading) return (
        <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Loading coding challenges...</p>
        </div>
    );

    if (finished && result) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card animate-scale-in" style={{ maxWidth: '500px', width: '90%', textAlign: 'center', padding: '2.5rem' }}>
                    <div className={`score-circle ${result.passed ? 'pass' : 'fail'}`} style={{ margin: '0 auto 1.5rem' }}>
                        {Math.round(result.score)}%
                    </div>
                    <h2 style={{ marginBottom: '0.5rem' }}>
                        {result.passed ? '🎉 Coding Test Passed!' : '😔 Not Passed'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        You solved {result.solved} out of {result.total} problems.
                    </p>
                    {result.test1_fully_passed && (
                        <p style={{ color: 'var(--accent-success)', fontWeight: 600, marginBottom: '1rem' }}>
                            ✅ Test 1 passed! You can now start the SQL Challenge.
                        </p>
                    )}
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
            testType="coding"
            testId={parseInt(testId)}
            onViolation={handleViolation}
        >
            <div style={{ display: 'flex', height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
                {/* Left Panel - Problem Description */}
                <div style={{
                    width: '38%', padding: '1.25rem', overflowY: 'auto',
                    borderRight: '1px solid var(--border-color)', background: 'var(--card-bg)',
                }}>
                    {/* Problem Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {problems.map((p, i) => {
                            const pid = p.id || i + 1;
                            const tr = testResults[pid];
                            const isAllPassed = tr?.all_passed;
                            const isFailed = tr && !tr.all_passed;
                            return (
                                <button
                                    key={i}
                                    className={`btn btn-sm ${i === currentProblem ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{
                                        position: 'relative',
                                        borderColor: isAllPassed ? 'var(--accent-success)' : isFailed ? 'var(--accent-danger)' : undefined,
                                    }}
                                    onClick={() => { setCurrentProblem(i); setOutput(''); setCustomInput(p.sample_input || ''); }}
                                >
                                    {isAllPassed && (
                                        <CheckCircle size={12} style={{ color: 'var(--accent-success)', position: 'absolute', top: -4, right: -4 }} />
                                    )}
                                    {isFailed && (
                                        <XCircle size={12} style={{ color: 'var(--accent-danger)', position: 'absolute', top: -4, right: -4 }} />
                                    )}
                                    P{i + 1}
                                </button>
                            );
                        })}
                    </div>

                    {problem && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <h3 style={{ margin: 0 }}>{problem.title}</h3>
                                <span className={`badge ${problem.difficulty === 'easy' ? 'badge-passed' : problem.difficulty === 'hard' ? 'badge-failed' : 'badge-pending'}`}>
                                    {problem.difficulty}
                                </span>
                            </div>

                            <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                                    {problem.description}
                                </pre>
                            </div>

                            {problem.input_format && (
                                <div style={{ marginTop: '1rem' }}>
                                    <h4 style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Input Format</h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{problem.input_format}</p>
                                </div>
                            )}

                            {problem.output_format && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <h4 style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Output Format</h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{problem.output_format}</p>
                                </div>
                            )}

                            {problem.sample_input && (
                                <div style={{ marginTop: '1rem' }}>
                                    <h4 style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Sample Input</h4>
                                    <pre style={{
                                        background: '#1a1a2e', padding: '0.75rem', borderRadius: '0.5rem',
                                        fontSize: '0.85rem', color: '#e0e0e0', overflowX: 'auto',
                                    }}>{problem.sample_input}</pre>
                                </div>
                            )}

                            {problem.sample_output && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <h4 style={{ color: 'var(--accent-success)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Expected Output</h4>
                                    <pre style={{
                                        background: '#1a1a2e', padding: '0.75rem', borderRadius: '0.5rem',
                                        fontSize: '0.85rem', color: '#e0e0e0', overflowX: 'auto',
                                    }}>{problem.sample_output}</pre>
                                </div>
                            )}

                            {problem.hints && problem.hints.length > 0 && (
                                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(168,85,247,0.1)', borderRadius: '0.5rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>💡 Hints</h4>
                                    {problem.hints.map((h, i) => (
                                        <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>
                                            {i + 1}. {h}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right Panel - Code Editor + I/O */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                    {/* Editor Header */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Code2 size={18} style={{ color: 'var(--primary)' }} />
                            <select
                                value={languages[problemId] || 'python'}
                                onChange={(e) => {
                                    const lang = e.target.value;
                                    setLanguages(prev => ({ ...prev, [problemId]: lang }));
                                    if (!codes[problemId] || codes[problemId] === LANGUAGE_CONFIG[languages[problemId]]?.template) {
                                        setCodes(prev => ({ ...prev, [problemId]: LANGUAGE_CONFIG[lang].template }));
                                    }
                                }}
                                style={{
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)', borderRadius: '0.375rem',
                                    padding: '0.3rem 0.6rem', fontSize: '0.85rem',
                                }}
                            >
                                {Object.entries(LANGUAGE_CONFIG).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn btn-sm"
                                style={{ background: 'rgba(0,210,100,0.15)', color: '#00d264', border: '1px solid #00d264' }}
                                onClick={handleRunCode}
                                disabled={running}
                            >
                                {running ? <><Loader size={14} className="spin" /> Running...</> : <><Play size={14} /> Run Code</>}
                            </button>
                            <button
                                className="btn btn-sm btn-primary"
                                onClick={handleSubmitCode}
                                disabled={submitting[problemId]}
                            >
                                {submitting[problemId] ? <><Loader size={14} className="spin" /> Testing...</> : (
                                    submitted[problemId] ? <><CheckCircle size={14} /> Resubmit</> : <><Send size={14} /> Submit</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div style={{ flex: 1 }}>
                        <Editor
                            height="100%"
                            language={LANGUAGE_CONFIG[languages[problemId] || 'python'].monaco}
                            theme="vs-dark"
                            value={codes[problemId] || ''}
                            onChange={(val) => setCodes(prev => ({ ...prev, [problemId]: val || '' }))}
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                padding: { top: 10 },
                                automaticLayout: true,
                            }}
                        />
                    </div>

                    {/* Output / Test Results Tabs */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-color)',
                        height: '240px', background: 'var(--card-bg)',
                    }}>
                        {/* Tab Bar */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setOutputTab('output')}
                                style={{
                                    padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
                                    background: outputTab === 'output' ? 'var(--primary)' : 'transparent',
                                    color: outputTab === 'output' ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}
                            >
                                <Terminal size={12} /> Output
                            </button>
                            <button
                                onClick={() => setOutputTab('testcases')}
                                style={{
                                    padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
                                    background: outputTab === 'testcases' ? 'var(--primary)' : 'transparent',
                                    color: outputTab === 'testcases' ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}
                            >
                                <CheckCircle size={12} /> Test Cases
                                {currentTestResult && (
                                    <span style={{
                                        marginLeft: '0.3rem',
                                        color: currentTestResult.all_passed ? '#00d264' : '#ff6b6b',
                                        fontWeight: 800,
                                    }}>
                                        ({currentTestResult.passed_count}/{currentTestResult.total_count})
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {outputTab === 'output' ? (
                                <div style={{ display: 'flex', gap: 0, height: '100%' }}>
                                    {/* Custom Input */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)' }}>
                                        <div style={{
                                            padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 700,
                                            color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)',
                                        }}>
                                            Custom Input
                                        </div>
                                        <textarea
                                            value={customInput}
                                            onChange={e => setCustomInput(e.target.value)}
                                            placeholder="Enter your input here..."
                                            style={{
                                                flex: 1, resize: 'none', border: 'none', outline: 'none',
                                                background: '#1a1a2e', color: '#e0e0e0', fontFamily: 'monospace',
                                                fontSize: '0.85rem', padding: '0.5rem 0.75rem',
                                            }}
                                        />
                                    </div>
                                    {/* Output */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{
                                            padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 700,
                                            color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)',
                                        }}>
                                            Output
                                        </div>
                                        <pre style={{
                                            flex: 1, margin: 0, overflowY: 'auto',
                                            background: '#1a1a2e', color: running ? 'var(--text-muted)' : (output.startsWith('Error') ? '#ff6b6b' : '#e0e0e0'),
                                            fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.5rem 0.75rem',
                                        }}>
                                            {output || 'Click "Run Code" to see output'}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                /* Test Cases Tab */
                                <div style={{ padding: '0.5rem' }}>
                                    {!currentTestResult ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem' }}>
                                            Click "Submit" to run your code against test cases
                                        </div>
                                    ) : (
                                        <>
                                            {/* Summary */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.5rem 0.75rem', marginBottom: '0.5rem',
                                                background: currentTestResult.all_passed ? 'rgba(0,210,100,0.1)' : 'rgba(255,107,107,0.1)',
                                                borderRadius: '0.375rem',
                                                border: `1px solid ${currentTestResult.all_passed ? '#00d264' : '#ff6b6b'}`,
                                            }}>
                                                {currentTestResult.all_passed
                                                    ? <CheckCircle size={18} style={{ color: '#00d264' }} />
                                                    : <AlertTriangle size={18} style={{ color: '#ff6b6b' }} />
                                                }
                                                <span style={{
                                                    fontWeight: 700, fontSize: '0.85rem',
                                                    color: currentTestResult.all_passed ? '#00d264' : '#ff6b6b',
                                                }}>
                                                    {currentTestResult.all_passed
                                                        ? `All ${currentTestResult.total_count} test cases passed! ✓`
                                                        : `${currentTestResult.passed_count} of ${currentTestResult.total_count} test cases passed`
                                                    }
                                                </span>
                                            </div>

                                            {/* Individual test cases */}
                                            {currentTestResult.results.map((tc, idx) => (
                                                <div key={idx} style={{
                                                    padding: '0.5rem 0.75rem',
                                                    marginBottom: '0.35rem',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: '0.375rem',
                                                    borderLeft: `3px solid ${tc.passed ? '#00d264' : '#ff6b6b'}`,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                        {tc.passed
                                                            ? <CheckCircle size={14} style={{ color: '#00d264' }} />
                                                            : <XCircle size={14} style={{ color: '#ff6b6b' }} />
                                                        }
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: tc.passed ? '#00d264' : '#ff6b6b' }}>
                                                            Test Case {tc.test_case} — {tc.passed ? 'Passed' : 'Failed'}
                                                        </span>
                                                    </div>
                                                    {!tc.passed && (
                                                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Input:</span> {tc.input}</div>
                                                            <div><span style={{ color: '#00d264' }}>Expected:</span> {tc.expected}</div>
                                                            <div><span style={{ color: '#ff6b6b' }}>Got:</span> {tc.actual}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Finish button */}
                    <div style={{
                        padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between',
                        borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)',
                    }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => setCurrentProblem(Math.max(0, currentProblem - 1))} disabled={currentProblem === 0}>
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setCurrentProblem(Math.min(problems.length - 1, currentProblem + 1))} disabled={currentProblem >= problems.length - 1}>
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                        <button
                            className="btn btn-sm"
                            style={{ background: 'var(--accent-success)', color: 'white' }}
                            onClick={handleFinish}
                            disabled={finishing}
                        >
                            {finishing ? 'Finishing...' : `Finish Coding Test (${Object.keys(submitted).length}/${problems.length} submitted)`}
                        </button>
                    </div>
                </div>
            </div>
        </ProctoringGuard>
    );
}
