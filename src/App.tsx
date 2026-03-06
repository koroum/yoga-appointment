import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthCallback } from './pages/AuthCallback'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { GuestProfile } from './pages/GuestProfile'
import { Dashboard } from './pages/instructor/Dashboard'
import { Availability } from './pages/instructor/Availability'
import { InstructorProfile } from './pages/instructor/Profile'

// Placeholder pages — replaced in subsequent phases
function InstructorStudents() { return <div className="p-4">Students — Phase 10</div> }
function InstructorRequests() { return <div className="p-4">Booking Requests — Phase 4</div> }
function StudentBrowse() { return <div className="p-4">Browse Classes — Phase 4</div> }
function StudentBookings() { return <div className="p-4">My Bookings — Phase 4</div> }

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/instructor/:username" element={<GuestProfile />} />

          {/* Instructor-only */}
          <Route path="/instructor/dashboard" element={
            <ProtectedRoute requiredRole="instructor"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/instructor/availability" element={
            <ProtectedRoute requiredRole="instructor"><Availability /></ProtectedRoute>
          } />
          <Route path="/instructor/students" element={
            <ProtectedRoute requiredRole="instructor"><InstructorStudents /></ProtectedRoute>
          } />
          <Route path="/instructor/requests" element={
            <ProtectedRoute requiredRole="instructor"><InstructorRequests /></ProtectedRoute>
          } />
          <Route path="/instructor/profile" element={
            <ProtectedRoute requiredRole="instructor"><InstructorProfile /></ProtectedRoute>
          } />

          {/* Student-only */}
          <Route path="/student/browse" element={
            <ProtectedRoute requiredRole="student"><StudentBrowse /></ProtectedRoute>
          } />
          <Route path="/student/bookings" element={
            <ProtectedRoute requiredRole="student"><StudentBookings /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
