import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

// Pages
import AdminLogin from './pages/AdminLogin'
import CandidateLogin from './pages/CandidateLogin'
import AdminDashboard from './pages/AdminDashboard'
import CandidateManagement from './pages/CandidateManagement'
import CandidateDetail from './pages/CandidateDetail'
import Reports from './pages/Reports'
import ReportDetail from './pages/ReportDetail'
import CandidatePortal from './pages/CandidatePortal'
import MCQTest from './pages/MCQTest'
import CodingTest from './pages/CodingTest'
import AIInterview from './pages/AIInterview'
import SQLTest from './pages/SQLTest'
import LandingPage from './pages/LandingPage'

// Layout
import AdminLayout from './components/AdminLayout'

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/candidate/login" element={<CandidateLogin />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="candidates" element={<CandidateManagement />} />
          <Route path="candidates/:id" element={<CandidateDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
        </Route>

        {/* Candidate */}
        <Route path="/candidate/portal" element={<CandidatePortal />} />
        <Route path="/candidate/mcq/:testId" element={<MCQTest />} />
        <Route path="/candidate/coding/:testId" element={<CodingTest />} />
        <Route path="/candidate/sql" element={<SQLTest />} />
        <Route path="/candidate/interview/:interviewId" element={<AIInterview />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
