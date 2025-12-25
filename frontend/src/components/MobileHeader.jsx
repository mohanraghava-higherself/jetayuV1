import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function MobileHeader({ user, onAuthClick, onMyBookings, onMyProfile, onLogout, onResetChat }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef(null)
  const profileMenuRef = useRef(null)

  // On /chat, always show menu icon (not back arrow)
  // On other routes, show back arrow
  const isOnChatRoute = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const showBackArrow = !isOnChatRoute && ['/my-bookings', '/profile'].some(path => 
    location.pathname === path || location.pathname.startsWith(path)
  )

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (showMenu || showProfileMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showMenu, showProfileMenu])

  const handleBack = () => {
    // Back button from bookings/profile goes back to /chat (preserves chat)
    navigate('/chat')
  }

  const handleMenuClick = () => {
    if (showBackArrow) {
      handleBack()
    } else {
      setShowMenu(true)
    }
  }

  const handleProfileClick = () => {
    if (user) {
      setShowProfileMenu(true)
    } else {
      onAuthClick()
    }
  }

  const handleMyBookingsClick = () => {
    // Navigate to My Bookings - NO confirmation, chat is preserved
    setShowMenu(false)
    if (onMyBookings) {
      onMyBookings()
    }
  }
  
  const handleHomeClick = () => {
    // If on /chat, show confirmation before navigating and resetting chat
    if (isOnChatRoute) {
      const confirmed = window.confirm('Chat may not be saved. Do you want to continue?')
      if (!confirmed) {
        setShowMenu(false)
        return
      }
      // User confirmed - reset chat before navigating
      if (onResetChat) {
        onResetChat()
      }
    }
    setShowMenu(false)
    navigate('/')
  }

  const handleMyProfileClick = () => {
    setShowProfileMenu(false)
    if (onMyProfile) {
      onMyProfile()
    }
  }

  const handleLogoutClick = async () => {
    setShowProfileMenu(false)
    
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      // EXPECTED: 403 can happen, DO NOT BLOCK LOGOUT
      console.warn('[LOGOUT] Supabase signOut failed (ignored):', err)
    } finally {
      // ALWAYS run local cleanup regardless of Supabase response
      // Logout UX must not depend on Supabase accepting the request
      if (onLogout) {
        onLogout()
      }
    }
  }

  return (
    <>
      {/* Fixed Mobile Header */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: 'rgba(21, 21, 21, 0.95)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}
      >
        {/* Left: Menu or Back Arrow */}
        <button
          onClick={handleMenuClick}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
          }}
        >
          {showBackArrow ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Center: JETAYU */}
        <h1
          style={{
            fontFamily: '"Jt Barnez", sans-serif',
            fontSize: '24px',
            fontWeight: 600,
            background: 'linear-gradient(180deg, #7B5159 0%, #2F1E22 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            padding: 0,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
          }}
        >
          JETAYU
        </h1>

        {/* Right: Profile Avatar */}
        <button
          onClick={handleProfileClick}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
          }}
        >
          {user ? (
            <svg width="16" height="18" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7.0001 8.23873C8.99799 8.23873 10.6195 6.61725 10.6195 4.61936C10.6195 2.62147 8.99799 1 7.0001 1C5.00221 1 3.38074 2.62147 3.38074 4.61936C3.38074 6.61725 5.00221 8.23873 7.0001 8.23873Z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.0002 14.371C12.1505 12.9142 9.77623 11.8583 7.00018 11.8583C4.22413 11.8583 1.84983 12.9142 1.00018 14.371" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="18" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7.0001 8.23873C8.99799 8.23873 10.6195 6.61725 10.6195 4.61936C10.6195 2.62147 8.99799 1 7.0001 1C5.00221 1 3.38074 2.62147 3.38074 4.61936C3.38074 6.61725 5.00221 8.23873 7.0001 8.23873Z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.0002 14.371C12.1505 12.9142 9.77623 11.8583 7.00018 11.8583C4.22413 11.8583 1.84983 12.9142 1.00018 14.371" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </header>

      {/* Menu Modal */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(6, 2, 1, 0.9)',
                backdropFilter: 'blur(24px)',
                zIndex: 200
              }}
            />
            {/* Menu Content */}
            <motion.div
              ref={menuRef}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '280px',
                backgroundColor: 'rgba(21, 21, 21, 0.95)',
                backdropFilter: 'blur(24px)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 201,
                padding: '80px 24px 24px 24px',
                overflowY: 'auto'
              }}
            >
              {/* Menu options vary by route */}
              {/* On /chat: Show Home and My Bookings */}
              {/* On home (/): Show only My Bookings */}
              {isOnChatRoute && (
                <button
                  onClick={handleHomeClick}
                  style={{
                    width: '100%',
                    padding: '16px',
                    textAlign: 'left',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontFamily: 'Outfit, sans-serif',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  Home
                </button>
              )}
              <button
                onClick={handleMyBookingsClick}
                style={{
                  width: '100%',
                  padding: '16px',
                  textAlign: 'left',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer'
                }}
              >
                My Bookings
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Menu Modal */}
      <AnimatePresence>
        {showProfileMenu && user && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileMenu(false)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(6, 2, 1, 0.9)',
                backdropFilter: 'blur(24px)',
                zIndex: 200
              }}
            />
            {/* Profile Menu Content */}
            <motion.div
              ref={profileMenuRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{
                position: 'fixed',
                top: '80px',
                right: '16px',
                width: '200px',
                backgroundColor: 'rgba(21, 21, 21, 0.95)',
                backdropFilter: 'blur(24px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 201,
                padding: '8px',
                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.3)'
              }}
            >
              <button
                onClick={handleMyProfileClick}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  fontFamily: 'Outfit, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
              >
                My Profile
              </button>
              <button
                onClick={handleLogoutClick}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  fontFamily: 'Outfit, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
              >
                Logout
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}


