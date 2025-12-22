import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

export default function MyBookings({ onBack, user, onAuthClick, onMyBookings, onMyProfile, onLogout }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Route protection: Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Redirect to landing and open auth modal
        setIsAuthenticated(false)
        if (onBack) {
          onBack()
        }
        // Small delay to ensure navigation happens before modal opens
        setTimeout(() => {
          if (onAuthClick) {
            onAuthClick()
          }
        }, 100)
        return
      }
      // User is authenticated, load bookings
      setIsAuthenticated(true)
      loadBookings()
    }
    
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setLoading(false)
          // Redirect to landing and open auth modal
          if (onBack) {
            onBack()
          }
          setTimeout(() => {
            if (onAuthClick) {
              onAuthClick()
            }
          }, 100)
          return
        } else {
          throw new Error('Failed to load bookings')
        }
      }

      const data = await response.json()
      // Filter to only show confirmed bookings
      const confirmedBookings = (data.bookings || []).filter(
        booking => booking.status === 'confirmed'
      )
      setBookings(confirmedBookings)
    } catch (err) {
      setError(err.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return 'N/A'
    }
  }

  const formatFlightDuration = (routeFrom, routeTo) => {
    // This is a placeholder - in real app, calculate based on distance
    return '11 Hours'
  }

  // Since we only show confirmed bookings, status is always "Confirmed"
  const getBookingStatus = () => {
    return { text: 'Confirmed', color: 'text-emerald-400' }
  }

  // Do NOT render UI if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex-1 ml-16 flex h-screen overflow-hidden">
        {/* Bookings List */}
        <main className="flex-1 overflow-y-auto h-full">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <h1 className="font-display text-4xl font-light text-jet-100 mb-12 tracking-tight">
              My Bookings
            </h1>
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
              <p className="mt-4 text-jet-400">Loading your bookings...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              {error === 'Authentication required' ? (
                <button
                  onClick={() => {
                    if (onBack) onBack()
                    setTimeout(() => {
                      if (onAuthClick) onAuthClick()
                    }, 100)
                  }}
                  className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-colors"
                >
                  Sign In
                </button>
              ) : (
                <button
                  onClick={loadBookings}
                  className="px-4 py-2 bg-jet-800 hover:bg-jet-700 text-jet-200 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {!loading && !error && bookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-jet-400 mb-4">No confirmed bookings yet</p>
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
              {bookings.map((booking, index) => {
                const status = getBookingStatus()
                const routeFrom = booking.route_from || 'Dubai'
                const routeTo = booking.route_to || 'Singapore'
                const fromCode = booking.route_from ? booking.route_from.substring(0, 3).toUpperCase() : 'DXB'
                const toCode = booking.route_to ? booking.route_to.substring(0, 3).toUpperCase() : 'SIN'
                const aircraft = booking.selected_aircraft || 'Gulfstream G650'
                
                return (
                  <motion.div
                    key={booking.session_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`
                      bg-jet-900/60 backdrop-blur-md border rounded-2xl p-6 
                      ${index === 0 
                        ? 'border-rose-500/30 bg-gradient-to-r from-rose-900/20 to-jet-900/60' 
                        : 'border-jet-800/50 hover:border-jet-700/50'
                      }
                      transition-all duration-300 cursor-pointer
                    `}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Origin */}
                      <div className="flex-1">
                        <p className="text-sm text-jet-500 mb-1">{routeFrom}</p>
                        <p className="text-3xl font-bold text-jet-100 mb-1">{fromCode}</p>
                        <p className="text-sm text-jet-500">{formatTime(booking.date_time)}</p>
                      </div>

                      {/* Center: Aircraft & Duration */}
                      <div className="flex-1 flex flex-col items-center px-8">
                        <div className="mb-4">
                          <svg className="w-24 h-8 text-jet-600" fill="currentColor" viewBox="0 0 120 40">
                            <path d="M10 20 L30 15 L90 15 L110 20 L90 25 L30 25 Z" />
                          </svg>
                        </div>
                        <p className="text-sm text-jet-400 mb-2">{aircraft}</p>
                        <p className="text-xs text-jet-500">{formatFlightDuration(routeFrom, routeTo)}</p>
                      </div>

                      {/* Right: Destination */}
                      <div className="flex-1 text-right">
                        <p className="text-sm text-jet-500 mb-1">{routeTo}</p>
                        <p className="text-3xl font-bold text-jet-100 mb-1">{toCode}</p>
                        <p className="text-sm text-jet-500">
                          {booking.date_time ? formatTime(booking.date_time) : '12:16 PM'}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')} opacity-60`} />
                        <span className={`text-xs ${status.color}`}>• {status.text}</span>
                      </div>
                      <svg className="w-5 h-5 text-jet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
          </div>
        </main>

        {/* Details Panel - Placeholder */}
        <aside className="w-96 bg-jet-900/60 backdrop-blur-md border-l border-jet-800/50 p-8">
          <h2 className="font-display text-2xl font-light text-jet-100 mb-8">Booking Details</h2>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-400">WIP</span>
              </div>
              <p className="text-sm text-jet-500">Work In Progress</p>
            </div>
          </div>
        </aside>
    </div>
  )
}

