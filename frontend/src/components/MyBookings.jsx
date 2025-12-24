import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

// Helper function to derive airport code
const deriveAirportCode = (route) => {
  if (!route) return 'N/A'
  // If already 3 uppercase letters, use as-is
  if (/^[A-Z]{3}$/.test(route.trim())) {
    return route.trim()
  }
  // Otherwise, take first 3 characters and uppercase
  return route.substring(0, 3).toUpperCase()
}

// Helper function to get aircraft image URL
// Since we don't have an aircraft API, we'll use a placeholder approach
// In production, this could fetch from an aircraft endpoint
const getAircraftImageUrl = (aircraftName) => {
  if (!aircraftName) return null
  
  // Common aircraft image URLs (using Unsplash placeholders)
  // In a real app, this would come from the aircraft service
  const aircraftImageMap = {
    'Gulfstream G650': 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop',
    'Falcon 8X': 'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop',
    'Challenger 650': 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=600&h=400&fit=crop',
    'Citation Latitude': 'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=600&h=400&fit=crop',
    'Citation CJ4': 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=600&h=400&fit=crop',
    'Phenom 300E': 'https://images.unsplash.com/photo-1559628233-100c798642d4?w=600&h=400&fit=crop',
    'Learjet 75': 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop',
    'Praetor 600': 'https://images.unsplash.com/photo-1559628233-100c798642d4?w=600&h=400&fit=crop',
  }
  
  // Try exact match first
  if (aircraftImageMap[aircraftName]) {
    return aircraftImageMap[aircraftName]
  }
  
  // Try partial match (case-insensitive)
  const normalizedName = aircraftName.toLowerCase()
  for (const [key, url] of Object.entries(aircraftImageMap)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return url
    }
  }
  
  return null
}

// BookingDetailsPanel Component - Separate component to avoid hooks order issues
function BookingDetailsPanel({ booking, onClose, isMobile }) {
  const getBookingStatus = (status) => {
    return { text: 'Booking Requested', color: 'text-amber-400' }
  }

  const content = (
    <div className="p-8 overflow-y-auto flex-1" style={isMobile ? { paddingBottom: 'calc(2rem + 12px)' } : {}}>
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-display text-2xl font-light text-jet-100 mb-4">Booking Details</h2>
        
        {/* Aircraft Name */}
        <div className="mb-4">
          <p className="text-lg font-light text-jet-200">
            {booking.selected_aircraft}
          </p>
        </div>

        {/* Route */}
        <div className="mb-4">
          <p className="text-sm text-jet-400 mb-1">Route</p>
          <p className="text-base text-jet-100">
            {booking.route_from || 'N/A'} → {booking.route_to || 'N/A'}
          </p>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          {(() => {
            const status = getBookingStatus(booking.status)
            return (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-jet-800/50 border border-jet-700/50">
                <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')}`} />
                <span className={`text-xs ${status.color}`}>{status.text}</span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Body - WIP Placeholder */}
      <div className="border-t border-jet-800/50 pt-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-purple-400">WIP</span>
          </div>
          <p className="text-sm text-jet-400 mb-2">Booking details are being prepared.</p>
          <p className="text-xs text-jet-500">Our team is reviewing your request.</p>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    // Full-screen modal for mobile
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(6, 2, 1, 0.95)',
            backdropFilter: 'blur(24px)'
          }}
        />
        {/* Full-Screen Modal */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(21, 21, 21, 0.98)',
            backdropFilter: 'blur(24px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Close Button */}
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {content}
        </motion.div>
      </motion.div>
    )
  }

  // Desktop side panel
  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-96 bg-jet-900/60 backdrop-blur-md border-l border-jet-800/50 flex flex-col h-full"
    >
      {content}
    </motion.aside>
  )
}

export default function MyBookings({ onBack, user, onAuthClick, onMyBookings, onMyProfile, onLogout, onStartNewBooking }) {
  const navigate = useNavigate()
  
  // ALL HOOKS MUST BE DECLARED AT TOP LEVEL - BEFORE ANY CONDITIONAL RETURNS
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  // Mobile detection hook
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    // Route protection: Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Redirect to landing and open auth modal
        setIsAuthenticated(false)
        navigate('/')
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

  // Prevent body scroll when mobile modal is open
  useEffect(() => {
    if (isMobile && selectedBookingId) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, selectedBookingId])

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
      // Backend ONLY returns confirmed bookings with selected_aircraft
      // Frontend assumes all returned bookings are valid
      // Additional defensive check: filter out any bookings without aircraft (shouldn't happen)
      const validBookings = (data.bookings || []).filter(
        booking => booking.selected_aircraft !== null && booking.selected_aircraft !== undefined
      )
      setBookings(validBookings)
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

  // Map status to UI label and color
  // NOTE: Backend only returns confirmed bookings, but UI shows "Booking Requested"
  // This is a PRESENTATION choice - backend status remains "confirmed"
  const getBookingStatus = (status) => {
    // Always show "Booking Requested" regardless of backend status
    // Backend guarantees all bookings are confirmed with selected_aircraft
    return { text: 'Booking Requested', color: 'text-amber-400' }
  }

  const handleBookingClick = (bookingId) => {
    // Toggle: if same booking clicked, close panel; otherwise open new one
    setSelectedBookingId(selectedBookingId === bookingId ? null : bookingId)
  }

  const selectedBooking = bookings.find(b => b.session_id === selectedBookingId)

  // Reset selected booking if it's no longer in the list
  useEffect(() => {
    if (selectedBookingId && !selectedBooking) {
      setSelectedBookingId(null)
    }
  }, [bookings, selectedBookingId, selectedBooking])

  // Do NOT render UI if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={`flex-1 ${isMobile ? '' : 'ml-16'} flex h-screen overflow-hidden`}>
        {/* Bookings List */}
        <main className="flex-1 overflow-y-auto h-full">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <div className="flex items-center justify-between mb-12">
              <h1 className="font-display text-4xl font-light text-jet-100 tracking-tight">
                My Bookings
              </h1>
              {!loading && !error && bookings.length > 0 && onStartNewBooking && (
                <button
                  onClick={onStartNewBooking}
                  className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Start Another Booking
                </button>
              )}
            </div>
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
              <p className="text-jet-400 mb-4">No bookings yet</p>
              {onStartNewBooking ? (
                <button
                  onClick={onStartNewBooking}
                  className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-all duration-200 flex items-center gap-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Start a Conversation
                </button>
              ) : (
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-jet-950 font-medium rounded-lg transition-all duration-200"
                >
                  Start a Conversation
                </button>
              )}
            </div>
          )}

          {!loading && !error && bookings.length > 0 && (
            <div className="space-y-4">
              {bookings.map((booking, index) => {
                // Defensive check: skip if selected_aircraft is null (shouldn't happen per backend filter)
                if (!booking.selected_aircraft) {
                  return null
                }
                
                const status = getBookingStatus(booking.status)
                const routeFrom = booking.route_from || ''
                const routeTo = booking.route_to || ''
                const fromCode = deriveAirportCode(routeFrom)
                const toCode = deriveAirportCode(routeTo)
                const aircraftName = booking.selected_aircraft
                const aircraftImageUrl = getAircraftImageUrl(aircraftName)
                const isSelected = selectedBookingId === booking.session_id
                
                return (
                  <motion.div
                    key={booking.session_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleBookingClick(booking.session_id)}
                    className={`
                      bg-jet-900/60 backdrop-blur-md border rounded-2xl p-6 
                      ${isSelected 
                        ? 'border-gold-500/50 bg-gradient-to-r from-gold-900/20 to-jet-900/60' 
                        : 'border-jet-800/50 hover:border-jet-700/50'
                      }
                      transition-all duration-300 cursor-pointer
                    `}
                  >
                    {/* TOP: Aircraft Name */}
                    <div className="text-center mb-4">
                      <p className="text-lg font-light text-jet-100">
                        {aircraftName}
                      </p>
                    </div>

                    {/* MIDDLE: Main Visual Row */}
                    <div className="flex items-center justify-between mb-4">
                      {/* Left: Origin */}
                      <div className="flex-1">
                        <p className="text-3xl font-bold text-jet-100 mb-1">{fromCode}</p>
                        {booking.date_time && (
                          <p className="text-sm text-jet-500">{formatTime(booking.date_time)}</p>
                        )}
                      </div>

                      {/* Center: Aircraft Image */}
                      <div className="flex-1 flex flex-col items-center px-8">
                        <div className="mb-2 w-24 h-16 rounded-lg overflow-hidden bg-jet-800/50 flex items-center justify-center relative">
                          {aircraftImageUrl ? (
                            <img
                              src={aircraftImageUrl}
                              alt={aircraftName || 'Aircraft'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                const svg = e.target.parentElement.querySelector('svg')
                                if (svg) svg.style.display = 'block'
                              }}
                            />
                          ) : null}
                          <svg 
                            className={`w-24 h-8 text-jet-600 ${aircraftImageUrl ? 'absolute' : ''}`}
                            fill="currentColor" 
                            viewBox="0 0 120 40"
                            style={{ display: aircraftImageUrl ? 'none' : 'block' }}
                          >
                            <path d="M10 20 L30 15 L90 15 L110 20 L90 25 L30 25 Z" />
                          </svg>
                        </div>
                        {aircraftName && (
                          <p className="text-xs text-jet-400 text-center">{aircraftName}</p>
                        )}
                      </div>

                      {/* Right: Destination */}
                      <div className="flex-1 text-right">
                        <p className="text-3xl font-bold text-jet-100 mb-1">{toCode}</p>
                        {booking.date_time && (
                          <p className="text-sm text-jet-500">
                            {formatTime(booking.date_time)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* BOTTOM: Divider + Status */}
                    <div className="border-t border-jet-800/50 pt-4">
                      <div className="flex items-center justify-center gap-2">
                        {isSelected && (
                          <svg className="w-4 h-4 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                        <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')} opacity-60`} />
                        <span className={`text-sm ${status.color}`}>{status.text}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
          </div>
        </main>

        {/* Booking Details Panel */}
        <AnimatePresence>
          {selectedBooking && (
            <BookingDetailsPanel
              booking={selectedBooking}
              onClose={() => setSelectedBookingId(null)}
              isMobile={isMobile}
            />
          )}
        </AnimatePresence>
    </div>
  )
}

