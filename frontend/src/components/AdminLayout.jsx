import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, LogOut, Shield } from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('admin');
        navigate('/admin/login');
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h1>🛡️ SkillProctor</h1>
                    <p>AI Assessment Platform</p>
                </div>
                <nav className="sidebar-nav">
                    <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        Dashboard
                    </NavLink>
                    <NavLink to="/admin/candidates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        Candidates
                    </NavLink>
                    <NavLink to="/admin/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} />
                        Reports
                    </NavLink>
                </nav>
                <div style={{ padding: '0.5rem' }}>
                    <button onClick={handleLogout} className="nav-item w-full" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
