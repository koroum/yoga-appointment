import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Navbar() {
  const { user, role, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    window.location.href = '/login'
  }

  const dashboardPath = role === 'instructor' ? '/instructor/dashboard' : '/student/browse'

  return (
    <nav className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
      <Link to={user ? dashboardPath : '/'} className="font-bold text-indigo-600 text-lg">
        Yoga Booking
      </Link>

      {user ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
          >
            {user.name ?? 'Account'} ▾
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-md py-1 z-50">
              {role === 'instructor' && (
                <>
                  <Link to="/instructor/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Dashboard</Link>
                  <Link to="/instructor/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit Profile</Link>
                </>
              )}
              {role === 'student' && (
                <>
                  <Link to="/student/browse" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Browse Classes</Link>
                  <Link to="/student/bookings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">My Bookings</Link>
                  <Link to="/student/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Profile</Link>
                </>
              )}
              <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link to="/login" className="text-sm text-indigo-600 font-medium">Log in</Link>
      )}
    </nav>
  )
}
