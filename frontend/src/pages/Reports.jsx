import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllReports } from '../api';
import { FileText, Eye, CheckCircle, XCircle, Minus } from 'lucide-react';

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => { loadReports(); }, []);

    const loadReports = async () => {
        try {
            const res = await getAllReports();
            setReports(res.data.reports);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const StatusIcon = ({ passed }) => {
        if (passed === true) return <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />;
        if (passed === false) return <XCircle size={16} style={{ color: 'var(--accent-danger)' }} />;
        return <Minus size={16} style={{ color: 'var(--text-muted)' }} />;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h2>Reports</h2>
                <p>Assessment results and detailed reports for all candidates</p>
            </div>

            {loading ? (
                <div className="text-center" style={{ padding: '3rem' }}><div className="loading-spinner" /></div>
            ) : reports.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Candidate</th>
                                <th>MCQ Score</th>
                                <th>Coding</th>
                                <th>Interview</th>
                                <th>Test 1</th>
                                <th>Test 2</th>
                                <th>Overall</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{r.candidate_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.candidate_email}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <StatusIcon passed={r.mcq_passed} />
                                            <span>{Math.round(r.mcq_score || 0)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <StatusIcon passed={r.coding_passed} />
                                            <span>{Math.round(r.coding_score || 0)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <StatusIcon passed={r.interview_passed} />
                                            <span>{(r.interview_score || 0).toFixed(1)}/10</span>
                                        </div>
                                    </td>
                                    <td><StatusIcon passed={r.test1_passed} /></td>
                                    <td><StatusIcon passed={r.interview_passed} /></td>
                                    <td>
                                        <span className={`badge ${r.overall_status === 'passed' ? 'badge-passed' : r.overall_status === 'partial' ? 'badge-partial' : 'badge-failed'}`}>
                                            {r.overall_status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/admin/reports/${r.candidate_id}`)}>
                                            <Eye size={14} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>No reports yet</h3>
                    <p>Reports are generated after candidates complete their assessments</p>
                </div>
            )}
        </div>
    );
}
