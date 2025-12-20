import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function LandingPage({ onStartChat, onMyBookings }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-luxury">
      {/* Header */}
      <header className="glass border-b border-jet-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>
          
          {user && (
            <button
              onClick={onMyBookings}
              className="text-sm text-jet-400 hover:text-jet-200 transition-colors"
            >
              My Bookings
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-5xl md:text-6xl font-light text-jet-100 mb-6 tracking-tight">
              Private Aviation,
              <br />
              <span className="text-gold-400">Elevated</span>
            </h2>
            <p className="text-lg text-jet-400 mb-12 max-w-lg mx-auto leading-relaxed">
              Experience the luxury of personalized private jet concierge service. 
              Start a conversation and let us handle every detail.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              onClick={onStartChat}
              className="px-8 py-4 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 min-w-[200px]"
            >
              Start a Conversation
            </button>
            
            {user && (
              <button
                onClick={onMyBookings}
                className="px-8 py-4 border border-jet-700 hover:border-jet-600 text-jet-200 font-medium rounded-lg transition-all duration-200 min-w-[200px]"
              >
                My Bookings
              </button>
            )}
          </motion.div>

          {/* Decorative Elements */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
            <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
          </div>
        </div>
      </main>
    </div>
  )
}

