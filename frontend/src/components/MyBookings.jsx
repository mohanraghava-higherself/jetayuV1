import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

export default function MyBookings({ onBack }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!isSupabaseConfigured) {
        setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
        setLoading(false)
        return
      }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Fetch bookings from backend
      const response = await fetch(`${API_BASE}/my-bookings`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required')
        } else {
          throw new Error('Failed to load bookings')
        }
        setLoading(false)
        return
      }

      const data = await response.json()
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      case 'contacted':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      default:
        return 'text-jet-400 bg-jet-400/10 border-jet-400/20'
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-luxury">
      {/* Header */}
      <header className="glass border-b border-jet-800/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-jet-400 hover:text-jet-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-display text-xl font-semibold text-jet-100 tracking-wide">
                My Bookings
              </h1>
              <p className="text-[10px] text-jet-500 uppercase tracking-[0.2em]">
                Your Private Aviation Requests
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
              <p className="mt-4 text-jet-400">Loading your bookings...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadBookings}
                className="px-4 py-2 bg-jet-800 hover:bg-jet-700 text-jet-200 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && bookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-jet-400 mb-4">No bookings yet</p>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-all duration-200"
              >
                Start a Conversation
              </button>
            </div>
          )}

          {!loading && !error && bookings.length > 0 && (
            <div className="space-y-4">
              {bookings.map((booking, index) => (
                <motion.div
                  key={booking.session_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass border border-jet-800 rounded-xl p-6 hover:border-jet-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Left: Route & Details */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-jet-100 mb-2">
                            {booking.route_from && booking.route_to ? (
                              <>
                                {booking.route_from} → {booking.route_to}
                              </>
                            ) : (
                              'Flight Request'
                            )}
                          </h3>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-jet-400">
                            {booking.date_time && (
                              <div>
                                <span className="text-jet-500">Date:</span>{' '}
                                <span className="text-jet-300">{booking.date_time}</span>
                              </div>
                            )}
                            {booking.pax && (
                              <div>
                                <span className="text-jet-500">Passengers:</span>{' '}
                                <span className="text-jet-300">{booking.pax}</span>
                              </div>
                            )}
                            {booking.selected_aircraft && (
                              <div className="col-span-2">
                                <span className="text-jet-500">Aircraft:</span>{' '}
                                <span className="text-jet-300">{booking.selected_aircraft}</span>
                              </div>
                            )}
                            {booking.name && (
                              <div>
                                <span className="text-jet-500">Name:</span>{' '}
                                <span className="text-jet-300">{booking.name}</span>
                              </div>
                            )}
                            {booking.email && (
                              <div>
                                <span className="text-jet-500">Email:</span>{' '}
                                <span className="text-jet-300">{booking.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status & Date */}
                    <div className="flex flex-col items-end gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {booking.status === 'confirmed'
                          ? 'Confirmed'
                          : booking.status === 'contacted'
                          ? 'Contacted'
                          : 'Draft'}
                      </span>
                      <span className="text-xs text-jet-500">
                        {formatDate(booking.created_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

