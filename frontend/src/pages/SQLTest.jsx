import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { runSQL, evaluateSQL, finishSQL } from '../api';
import ProctoringGuard from '../components/ProctoringGuard';
import Editor from '@monaco-editor/react';
import { Play, Database, Table2, AlertCircle, CheckCircle, XCircle, Send, Loader, AlertTriangle } from 'lucide-react';

const SQL_PROBLEMS = [
    {
        id: 1,
        title: 'Employee Salary Report',
        description: 'Write a SQL query to find all employees who earn more than the average salary. Display their name, department, and salary. Order by salary descending.',
        difficulty: 'easy',
        hint: 'Use a subquery with AVG() to calculate the average salary.',
        expected_columns: ['name', 'department', 'salary'],
        reference_query: `SELECT name, department, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees) ORDER BY salary DESC`,
    },
    {
        id: 2,
        title: 'Department Statistics',
        description: 'Write a SQL query to find the total number of employees, average salary, and maximum salary for each department. Only include departments with more than 1 employee. Order by average salary descending.',
        difficulty: 'medium',
        hint: 'Use GROUP BY with HAVING clause.',
        expected_columns: ['department', 'count', 'avg_salary', 'max_salary'],
        reference_query: `SELECT department, COUNT(*) as count, AVG(salary) as avg_salary, MAX(salary) as max_salary FROM employees GROUP BY department HAVING COUNT(*) > 1 ORDER BY avg_salary DESC`,
    },
    {
        id: 3,
        title: 'Customer Order Analysis',
        description: 'Write a SQL query to find customers who have placed more than 1 order, showing their name, total number of orders, and total amount spent (quantity * price). Order by total spent descending.',
        difficulty: 'medium',
        hint: 'Use GROUP BY on customer_name with HAVING COUNT(*) > 1.',
        expected_columns: ['customer_name', 'total_orders', 'total_spent'],
        reference_query: `SELECT customer_name, COUNT(*) as total_orders, SUM(quantity * price) as total_spent FROM orders GROUP BY customer_name HAVING COUNT(*) > 1 ORDER BY total_spent DESC`,
    },
    {
        id: 4,
        title: 'Employee Manager Hierarchy',
        description: 'Write a SQL query using a self-join to show each employee\'s name alongside their manager\'s name. Include employees who have no manager (show NULL or "No Manager"). Order by employee name.',
        difficulty: 'hard',
        hint: 'Use a LEFT JOIN on the employees table with itself, matching manager_id to id.',
        expected_columns: ['employee_name', 'manager_name'],
        reference_query: `SELECT e.name as employee_name, COALESCE(m.name, 'No Manager') as manager_name FROM employees e LEFT JOIN employees m ON e.manager_id = m.id ORDER BY e.name`,
    },
];

const SCHEMA_INFO = `
📋 Available Tables:

┌─ employees ──────────────────────────┐
│ id       │ INTEGER │ Primary Key     │
│ name     │ TEXT    │ Employee name   │
│ department│ TEXT   │ Department name │
│ salary   │ REAL   │ Annual salary   │
│ hire_date│ TEXT    │ Date hired      │
│ manager_id│ INTEGER│ Manager's ID    │
└──────────────────────────────────────┘

┌─ departments ────────────────────────┐
│ id       │ INTEGER │ Primary Key     │
│ name     │ TEXT    │ Department name │
│ budget   │ REAL   │ Dept budget     │
│ location │ TEXT    │ Office location │
└──────────────────────────────────────┘

┌─ projects ───────────────────────────┐
│ id       │ INTEGER │ Primary Key     │
│ name     │ TEXT    │ Project name    │
│ department_id│ INT │ FK to dept      │
│ start_date│ TEXT   │ Start date      │
│ end_date │ TEXT    │ End date        │
│ status   │ TEXT    │ active/completed│
└──────────────────────────────────────┘

┌─ orders ─────────────────────────────┐
│ id       │ INTEGER │ Primary Key     │
│ customer_name│ TEXT│ Customer name   │
│ product  │ TEXT    │ Product name    │
│ quantity │ INTEGER │ Qty ordered     │
│ price    │ REAL   │ Unit price      │
│ order_date│ TEXT   │ Order date      │
└──────────────────────────────────────┘
`;

export default function SQLTest() {
    const navigate = useNavigate();
    const [currentProblem, setCurrentProblem] = useState(0);
    const [queries, setQueries] = useState({});
    const [results, setResults] = useState({});
    const [running, setRunning] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [submitted, setSubmitted] = useState({});
    const [evaluations, setEvaluations] = useState({}); // per-problem evaluation results
    const [showSchema, setShowSchema] = useState(false);
    const [outputTab, setOutputTab] = useState('results'); // 'results' | 'evaluation'
    const candidateRef = useRef(null);

    useEffect(() => {
        const stored = localStorage.getItem('candidate');
        if (!stored) { navigate('/candidate/login'); return; }
        candidateRef.current = JSON.parse(stored);
    }, []);

    const problem = SQL_PROBLEMS[currentProblem];

    const handleRunQuery = async () => {
        const query = queries[problem.id] || '';
        if (!query.trim()) return;
        setRunning(true);
        setOutputTab('results');
        try {
            const res = await runSQL({ query });
            setResults(prev => ({ ...prev, [problem.id]: res.data }));
        } catch (err) {
            setResults(prev => ({
                ...prev,
                [problem.id]: { success: false, error: 'Server error. Check your query.', columns: [], rows: [], row_count: 0 }
            }));
        } finally {
            setRunning(false);
        }
    };

    const handleSubmit = async () => {
        const query = queries[problem.id] || '';
        if (!query.trim()) {
            alert('Please write a query before submitting');
            return;
        }
        setEvaluating(true);
        setOutputTab('evaluation');
        try {
            const res = await evaluateSQL({
                query: query,
                reference_query: problem.reference_query,
            });
            setEvaluations(prev => ({ ...prev, [problem.id]: res.data }));
            setSubmitted(prev => ({ ...prev, [problem.id]: true }));
        } catch (err) {
            setEvaluations(prev => ({
                ...prev,
                [problem.id]: { success: false, passed: false, error: 'Server error during evaluation.' }
            }));
        } finally {
            setEvaluating(false);
        }
    };

    const currentResult = results[problem.id];
    const currentEval = evaluations[problem.id];
    const allSubmitted = SQL_PROBLEMS.every(p => submitted[p.id]);
    const passedCount = SQL_PROBLEMS.filter(p => evaluations[p.id]?.passed).length;
    const score = SQL_PROBLEMS.length > 0 ? Math.round((passedCount / SQL_PROBLEMS.length) * 100) : 0;

    return (
        <ProctoringGuard
            candidateId={candidateRef.current?.id}
            testType="sql"
            testId={0}
            onViolation={() => { }}
        >
            <div style={{ display: 'flex', height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
                {/* Left Panel - Problem + Schema */}
                <div style={{
                    width: '38%', display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid var(--border-color)', background: 'var(--card-bg)',
                }}>
                    {/* Problem tabs */}
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {SQL_PROBLEMS.map((p, i) => {
                                const evalResult = evaluations[p.id];
                                const isPassed = evalResult?.passed;
                                const isFailed = evalResult && !evalResult.passed;
                                return (
                                    <button
                                        key={i}
                                        className={`btn btn-sm ${i === currentProblem ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{
                                            position: 'relative',
                                            borderColor: isPassed ? 'var(--accent-success)' : isFailed ? 'var(--accent-danger)' : undefined,
                                        }}
                                        onClick={() => setCurrentProblem(i)}
                                    >
                                        {isPassed && (
                                            <CheckCircle size={12} style={{ color: 'var(--accent-success)', position: 'absolute', top: -4, right: -4 }} />
                                        )}
                                        {isFailed && (
                                            <XCircle size={12} style={{ color: 'var(--accent-danger)', position: 'absolute', top: -4, right: -4 }} />
                                        )}
                                        Q{i + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Toggle Schema / Problem */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            onClick={() => setShowSchema(false)}
                            style={{
                                flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer',
                                background: !showSchema ? 'var(--primary)' : 'transparent',
                                color: !showSchema ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.8rem', fontWeight: 600,
                            }}
                        >
                            📝 Problem
                        </button>
                        <button
                            onClick={() => setShowSchema(true)}
                            style={{
                                flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer',
                                background: showSchema ? 'var(--primary)' : 'transparent',
                                color: showSchema ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.8rem', fontWeight: 600,
                            }}
                        >
                            <Database size={12} /> Schema
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                        {showSchema ? (
                            <pre style={{
                                whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem',
                                color: 'var(--text-secondary)', lineHeight: 1.5,
                            }}>
                                {SCHEMA_INFO}
                            </pre>
                        ) : problem && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{problem.title}</h3>
                                    <span className={`badge ${problem.difficulty === 'easy' ? 'badge-passed' : problem.difficulty === 'hard' ? 'badge-failed' : 'badge-pending'}`}>
                                        {problem.difficulty}
                                    </span>
                                </div>

                                <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    {problem.description}
                                </p>

                                {problem.hint && (
                                    <div style={{ padding: '0.75rem', background: 'rgba(168,85,247,0.1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                            💡 <strong>Hint:</strong> {problem.hint}
                                        </p>
                                    </div>
                                )}

                                {problem.expected_columns && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.3rem' }}>Expected Columns</h4>
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                            {problem.expected_columns.map((col, i) => (
                                                <span key={i} className="badge badge-skill" style={{ fontSize: '0.75rem' }}>{col}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right Panel - SQL Editor + Results */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                    {/* Editor Header */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={18} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>SQL Editor</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn btn-sm"
                                style={{ background: 'rgba(0,210,100,0.15)', color: '#00d264', border: '1px solid #00d264' }}
                                onClick={handleRunQuery}
                                disabled={running}
                            >
                                {running ? <><Loader size={14} className="spin" /> Running...</> : <><Play size={14} /> Run Query</>}
                            </button>
                            <button
                                className="btn btn-sm btn-primary"
                                onClick={handleSubmit}
                                disabled={evaluating}
                            >
                                {evaluating ? <><Loader size={14} className="spin" /> Evaluating...</> : (
                                    submitted[problem?.id]
                                        ? (currentEval?.passed ? <><CheckCircle size={14} /> Passed</> : <><XCircle size={14} /> Resubmit</>)
                                        : <><Send size={14} /> Submit</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Monaco Editor for SQL */}
                    <div style={{ flex: 1 }}>
                        <Editor
                            height="100%"
                            language="sql"
                            theme="vs-dark"
                            value={queries[problem?.id] || '-- Write your SQL query here\nSELECT '}
                            onChange={(val) => setQueries(prev => ({ ...prev, [problem?.id]: val || '' }))}
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                padding: { top: 10 },
                                automaticLayout: true,
                                wordWrap: 'on',
                            }}
                        />
                    </div>

                    {/* Results Panel */}
                    <div style={{
                        height: '280px', borderTop: '1px solid var(--border-color)',
                        background: 'var(--card-bg)', display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setOutputTab('results')}
                                style={{
                                    padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
                                    background: outputTab === 'results' ? 'var(--primary)' : 'transparent',
                                    color: outputTab === 'results' ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}
                            >
                                <Table2 size={12} /> Query Results
                                {currentResult && (
                                    <span style={{ color: currentResult.success ? '#00d264' : '#ff6b6b' }}>
                                        {currentResult.success ? `(${currentResult.row_count} rows)` : '(Error)'}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setOutputTab('evaluation')}
                                style={{
                                    padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
                                    background: outputTab === 'evaluation' ? 'var(--primary)' : 'transparent',
                                    color: outputTab === 'evaluation' ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}
                            >
                                <CheckCircle size={12} /> Evaluation
                                {currentEval && (
                                    <span style={{ color: currentEval.passed ? '#00d264' : '#ff6b6b', fontWeight: 800 }}>
                                        {currentEval.passed ? '✓ Passed' : '✗ Failed'}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                            {outputTab === 'results' ? (
                                /* Query Results Tab */
                                !currentResult ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Click "Run Query" to see results
                                    </div>
                                ) : currentResult.error ? (
                                    <div style={{ padding: '1rem', color: '#ff6b6b', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                        <AlertCircle size={16} style={{ marginBottom: '0.5rem' }} />
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentResult.error}</pre>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr>
                                                {currentResult.columns.map((col, i) => (
                                                    <th key={i} style={{
                                                        padding: '0.5rem 0.75rem', textAlign: 'left',
                                                        borderBottom: '2px solid var(--primary)', color: 'var(--primary)',
                                                        fontWeight: 700, position: 'sticky', top: 0,
                                                        background: 'var(--card-bg)', whiteSpace: 'nowrap',
                                                    }}>
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentResult.rows.map((row, ri) => (
                                                <tr key={ri} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} style={{
                                                            padding: '0.4rem 0.75rem', color: 'var(--text-secondary)',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {cell === null ? <em style={{ color: 'var(--text-muted)' }}>NULL</em> : String(cell)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            ) : (
                                /* Evaluation Tab */
                                !currentEval ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Click "Submit" to evaluate your query
                                    </div>
                                ) : (
                                    <div style={{ padding: '0.75rem' }}>
                                        {/* Overall Result */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: currentEval.passed ? 'rgba(0,210,100,0.1)' : 'rgba(255,107,107,0.1)',
                                            borderRadius: '0.5rem',
                                            border: `1px solid ${currentEval.passed ? '#00d264' : '#ff6b6b'}`,
                                            marginBottom: '0.75rem',
                                        }}>
                                            {currentEval.passed
                                                ? <CheckCircle size={22} style={{ color: '#00d264' }} />
                                                : <AlertTriangle size={22} style={{ color: '#ff6b6b' }} />
                                            }
                                            <div>
                                                <div style={{
                                                    fontWeight: 800, fontSize: '0.95rem',
                                                    color: currentEval.passed ? '#00d264' : '#ff6b6b',
                                                }}>
                                                    {currentEval.passed ? '✓ Query Correct!' : '✗ Query Incorrect'}
                                                </div>
                                                {currentEval.error && (
                                                    <div style={{ fontSize: '0.8rem', color: '#ff6b6b', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                                        {currentEval.error}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {currentEval.success && !currentEval.passed && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {/* Column comparison */}
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, color: currentEval.columns_match ? '#00d264' : '#ff6b6b' }}>
                                                        Columns: {currentEval.columns_match ? '✓ Match' : '✗ Mismatch'}
                                                    </span>
                                                    {!currentEval.columns_match && (
                                                        <div style={{ marginTop: '0.2rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            Expected columns: {currentEval.expected_columns?.join(', ')}<br />
                                                            Your columns: {currentEval.actual_columns?.join(', ')}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Row count comparison */}
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, color: currentEval.rows_match ? '#00d264' : '#ff6b6b' }}>
                                                        Rows: {currentEval.rows_match ? '✓ Match' : '✗ Mismatch'}
                                                    </span>
                                                    {!currentEval.rows_match && (
                                                        <div style={{ marginTop: '0.2rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                            Expected: {currentEval.expected_row_count} rows • Got: {currentEval.actual_row_count} rows
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Show expected output  */}
                                                {currentEval.expected_rows && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                                            EXPECTED OUTPUT (first {Math.min(5, currentEval.expected_row_count)} rows):
                                                        </div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                            <thead>
                                                                <tr>
                                                                    {currentEval.expected_columns?.map((col, i) => (
                                                                        <th key={i} style={{
                                                                            padding: '0.3rem 0.5rem', textAlign: 'left',
                                                                            borderBottom: '1px solid #00d264', color: '#00d264',
                                                                            fontWeight: 700,
                                                                        }}>{col}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {currentEval.expected_rows.map((row, ri) => (
                                                                    <tr key={ri}>
                                                                        {row.map((cell, ci) => (
                                                                            <td key={ci} style={{
                                                                                padding: '0.2rem 0.5rem',
                                                                                color: 'var(--text-muted)',
                                                                                borderBottom: '1px solid var(--border-color)',
                                                                            }}>
                                                                                {cell === null ? 'NULL' : String(cell)}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)',
                    }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => setCurrentProblem(Math.max(0, currentProblem - 1))} disabled={currentProblem === 0}>
                                Previous
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setCurrentProblem(Math.min(SQL_PROBLEMS.length - 1, currentProblem + 1))} disabled={currentProblem >= SQL_PROBLEMS.length - 1}>
                                Next
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span>
                                Score: <strong style={{ color: passedCount > 0 ? '#00d264' : 'var(--text-muted)' }}>{passedCount}/{SQL_PROBLEMS.length}</strong> passed ({score}%)
                            </span>
                            {allSubmitted && (
                                <button
                                    className="btn btn-sm"
                                    style={{ background: 'var(--accent-success)', color: 'white' }}
                                    onClick={async () => {
                                        try {
                                            await finishSQL(candidateRef.current.id);
                                            navigate('/candidate/portal');
                                        } catch (err) {
                                            console.error(err);
                                            alert('Failed to submit sql test. Try again.');
                                        }
                                    }}
                                >
                                    Finish SQL Test
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProctoringGuard>
    );
}
