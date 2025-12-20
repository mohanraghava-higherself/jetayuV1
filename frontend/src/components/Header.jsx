import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Header({ user, onAuthClick, onMyBookings }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="glass border-b border-jet-800/50 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
            <svg 
              className="w-5 h-5 text-jet-950" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M3.64 14.26l2.86.95 4.02-4.02-8-4 1.41-1.41 9.2 2.96 3.95-3.95a1.5 1.5 0 1 1 2.12 2.12l-3.95 3.95 2.96 9.2-1.41 1.41-4-8-4.02 4.02.95 2.86-1.41 1.41-1.91-3.82-3.82-1.91 1.41-1.41z"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-jet-100 tracking-wide">
              Jetayu
            </h1>
            <p className="text-[10px] text-jet-500 uppercase tracking-[0.2em]">
              Private Aviation
            </p>
          </div>
        </motion.div>

        {/* Right side: Auth buttons or user info */}
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-jet-500 hidden sm:inline">Online</span>
          </div>

          {/* Auth buttons */}
          {user ? (
            <div className="flex items-center gap-2">
              {onMyBookings && (
                <button
                  onClick={onMyBookings}
                  className="text-xs text-jet-400 hover:text-jet-200 transition-colors px-2 py-1 hidden sm:block"
                >
                  My Bookings
                </button>
              )}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-jet-800/50 border border-jet-700/50">
                <div className="w-6 h-6 rounded-full bg-gold-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-gold-400 font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-jet-400 hover:text-jet-200 transition-colors"
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="text-xs font-medium text-jet-100 hover:text-jet-50 transition-colors px-4 py-2 rounded-lg border border-gold-500/30 hover:border-gold-500/50 bg-gold-500/10 hover:bg-gold-500/20 backdrop-blur-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

