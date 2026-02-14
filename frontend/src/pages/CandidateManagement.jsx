import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCandidates, uploadResume, generateTest, deleteCandidate, generateReport } from '../api';
import { Upload, Search, Trash2, Play, Eye, Plus, FileText, X, FileBarChart } from 'lucide-react';
import Toast from '../components/Toast';

export default function CandidateManagement() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(null);
    const [generatingReport, setGeneratingReport] = useState(null);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState('');
    const [uploadData, setUploadData] = useState({ name: '', email: '', file: null });
    const [parsedSkills, setParsedSkills] = useState(null);
    const fileRef = useRef();
    const navigate = useNavigate();

    useEffect(() => { loadCandidates(); }, []);

    const loadCandidates = async () => {
        try {
            const res = await getCandidates();
            setCandidates(res.data.candidates);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.file) return setToast({ message: 'Please select a PDF file', type: 'error' });
        setUploading(true);

        const formData = new FormData();
        formData.append('file', uploadData.file);
        if (uploadData.name) formData.append('name', uploadData.name);
        if (uploadData.email) formData.append('email', uploadData.email);

        try {
            const res = await uploadResume(formData);
            setParsedSkills(res.data);
            setToast({ message: `Resume uploaded! Candidate ID: ${res.data.candidate_id}`, type: 'success' });
            loadCandidates();
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Upload failed', type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateTest = async (candidateId) => {
        setGenerating(candidateId);
        try {
            const res = await generateTest(candidateId);
            setToast({ message: `Test generated! MCQ: ${res.data.mcq_count} questions, Coding: ${res.data.coding_count} problems`, type: 'success' });
            loadCandidates();
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed to generate test', type: 'error' });
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this candidate?')) return;
        try {
            await deleteCandidate(id);
            setToast({ message: 'Candidate deleted', type: 'success' });
            loadCandidates();
        } catch (err) {
            setToast({ message: 'Failed to delete', type: 'error' });
        }
    };

    const handleGenerateReport = async (candidateId) => {
        setGeneratingReport(candidateId);
        try {
            const res = await generateReport(candidateId);
            setToast({ message: `Report generated! Status: ${res.data.overall_status}`, type: 'success' });
            navigate(`/admin/reports/${candidateId}`);
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed to generate report', type: 'error' });
        } finally {
            setGeneratingReport(null);
        }
    };

    const getStatusBadge = (status) => {
        const map = {
            pending: 'badge-pending',
            test1_ready: 'badge-pending',
            test1_in_progress: 'badge-in-progress',
            test1_mcq_passed: 'badge-passed',
            test1_coding_passed: 'badge-passed',
            test1_passed: 'badge-passed',
            test1_failed: 'badge-failed',
            test2_in_progress: 'badge-in-progress',
            completed: 'badge-completed',
            test2_failed: 'badge-failed',
        };
        return map[status] || 'badge-pending';
    };

    const filtered = candidates.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Candidates</h2>
                    <p>Manage candidates and generate assessments</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowUpload(true); setParsedSkills(null); setUploadData({ name: '', email: '', file: null }); }}>
                    <Plus size={18} /> Upload Resume
                </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Search candidates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Candidates Table */}
            {loading ? (
                <div className="text-center" style={{ padding: '3rem' }}>
                    <div className="loading-spinner" />
                </div>
            ) : filtered.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Skills</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{c.id}</td>
                                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{c.email}</td>
                                    <td>
                                        <div className="skill-tags">
                                            {(c.skills || []).slice(0, 4).map((s, i) => (
                                                <span key={i} className="badge badge-skill">{s}</span>
                                            ))}
                                            {c.skills?.length > 4 && <span className="badge badge-skill">+{c.skills.length - 4}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(c.status)}`}>
                                            {c.status?.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button
                                                className="btn btn-icon"
                                                title="View Details"
                                                onClick={() => navigate(`/admin/candidates/${c.id}`)}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {c.status === 'pending' && (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleGenerateTest(c.id)}
                                                    disabled={generating === c.id}
                                                >
                                                    {generating === c.id ? <span className="loading-spinner" /> : <><Play size={14} /> Generate Test</>}
                                                </button>
                                            )}
                                            {c.status !== 'pending' && (
                                                <button
                                                    className="btn btn-sm"
                                                    title="Generate Report"
                                                    style={{ background: 'rgba(9, 132, 227, 0.15)', color: 'var(--accent-info)', border: '1px solid var(--accent-info)' }}
                                                    onClick={() => handleGenerateReport(c.id)}
                                                    disabled={generatingReport === c.id}
                                                >
                                                    {generatingReport === c.id ? <span className="loading-spinner" /> : <><FileBarChart size={14} /> Report</>}
                                                </button>
                                            )}
                                            <button className="btn btn-icon" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDelete(c.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>No candidates found</h3>
                    <p>Upload a resume to add a candidate</p>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="modal-overlay" onClick={() => setShowUpload(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Upload Resume</h3>
                            <button className="btn btn-icon" onClick={() => setShowUpload(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        {!parsedSkills ? (
                            <form onSubmit={handleUpload}>
                                <div className="form-group">
                                    <label>Candidate Name (optional, will be extracted from resume)</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. John Doe"
                                        value={uploadData.name}
                                        onChange={e => setUploadData({ ...uploadData, name: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email Address (optional, will be extracted from resume)</label>
                                    <input
                                        className="form-input"
                                        type="email"
                                        placeholder="e.g. john@example.com"
                                        value={uploadData.email}
                                        onChange={e => setUploadData({ ...uploadData, email: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Resume (PDF)</label>
                                    <div
                                        className={`file-upload`}
                                        onClick={() => fileRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
                                        onDragLeave={(e) => e.currentTarget.classList.remove('dragging')}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('dragging');
                                            const file = e.dataTransfer.files[0];
                                            if (file?.type === 'application/pdf') setUploadData({ ...uploadData, file });
                                        }}
                                    >
                                        <Upload size={32} style={{ color: 'var(--accent-primary-light)', marginBottom: '0.75rem' }} />
                                        <p style={{ fontWeight: 600 }}>
                                            {uploadData.file ? uploadData.file.name : 'Drop PDF here or click to browse'}
                                        </p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Only PDF files accepted
                                        </p>
                                    </div>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".pdf"
                                        hidden
                                        onChange={e => setUploadData({ ...uploadData, file: e.target.files[0] })}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                                        {uploading ? <><span className="loading-spinner" /> Parsing Resume...</> : <><Upload size={16} /> Upload & Parse</>}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Parsed Results */
                            <div className="animate-fade-in">
                                <div style={{
                                    padding: '1rem',
                                    background: 'rgba(0, 184, 148, 0.1)',
                                    border: '1px solid var(--accent-success)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1.5rem'
                                }}>
                                    ✅ Resume parsed successfully! Candidate ID: <strong>#{parsedSkills.candidate_id}</strong>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Name</label>
                                        <p style={{ fontWeight: 600 }}>{parsedSkills.parsed_data?.name}</p>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email</label>
                                        <p>{parsedSkills.parsed_data?.email}</p>
                                    </div>
                                    {parsedSkills.parsed_data?.github_url && (
                                        <div>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>GitHub</label>
                                            <p><a href={parsedSkills.parsed_data.github_url} target="_blank" style={{ color: 'var(--accent-info)' }}>{parsedSkills.parsed_data.github_url}</a></p>
                                        </div>
                                    )}
                                    {parsedSkills.parsed_data?.linkedin_url && (
                                        <div>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>LinkedIn</label>
                                            <p><a href={parsedSkills.parsed_data.linkedin_url} target="_blank" style={{ color: 'var(--accent-info)' }}>{parsedSkills.parsed_data.linkedin_url}</a></p>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                                        Extracted Skills ({parsedSkills.parsed_data?.skills?.length || 0})
                                    </label>
                                    <div className="skill-tags">
                                        {(parsedSkills.parsed_data?.skills || []).map((skill, i) => (
                                            <span key={i} className="badge badge-skill">{skill}</span>
                                        ))}
                                    </div>
                                </div>

                                {Object.keys(parsedSkills.parsed_data?.coding_platforms || {}).length > 0 && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Coding Platforms</label>
                                        {Object.entries(parsedSkills.parsed_data.coding_platforms).map(([platform, url]) => (
                                            <p key={platform} style={{ fontSize: '0.9rem' }}>
                                                <strong style={{ textTransform: 'capitalize' }}>{platform}:</strong>{' '}
                                                <a href={url} target="_blank" style={{ color: 'var(--accent-info)' }}>{url}</a>
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Close</button>
                                    <button
                                        className="btn btn-success"
                                        onClick={() => { handleGenerateTest(parsedSkills.candidate_id); setShowUpload(false); }}
                                        disabled={generating}
                                    >
                                        <Play size={16} /> Generate Test Now
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
