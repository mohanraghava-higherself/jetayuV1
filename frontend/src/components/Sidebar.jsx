import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, memo } from 'react'
import { supabase } from '../lib/supabase'

function SidebarComponent({ activeView, onNavigate, onAuthClick, user, onMyBookings, onMyProfile, onLogout }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef(null)
  
  // Refs for dynamic indicator positioning
  const homeButtonRef = useRef(null)
  const menuButtonRef = useRef(null)
  const profileButtonRef = useRef(null)
  const [indicatorTop, setIndicatorTop] = useState(null)
  
  const handleLogout = async () => {
    setShowProfileMenu(false)
    await supabase.auth.signOut()
    if (onLogout) {
      onLogout()
    }
  }

  // Menu icon directly navigates to My Bookings
  const handleMenuClick = () => {
    if (onMyBookings) {
      onMyBookings()
    } else if (onNavigate) {
      onNavigate('bookings')
    }
    setShowProfileMenu(false)
  }

  const handleProfileClick = () => {
    if (user) {
      // If user is logged in, directly open Profile
      if (onMyProfile) {
        onMyProfile()
      } else if (onNavigate) {
        onNavigate('profile')
      }
      setShowProfileMenu(false)
    } else {
      // If not logged in, open auth modal
      onAuthClick()
    }
  }

  const handleProfileRightClick = (e) => {
    e.preventDefault()
    if (user) {
      // Right-click shows dropdown for Logout access
      setShowProfileMenu(!showProfileMenu)
    }
  }

  const handleMyProfileClick = () => {
    setShowProfileMenu(false)
    if (onMyProfile) {
      onMyProfile()
    } else if (onNavigate) {
      onNavigate('profile')
    }
  }

  // Update indicator position based on active view
  useEffect(() => {
    const updateIndicatorPosition = () => {
      let targetRef = null
      
      // Only show indicator for Home, Menu, or Profile (NOT logo)
      if (activeView === 'landing' || activeView === 'chat') {
        targetRef = homeButtonRef.current
      } else if (activeView === 'bookings') {
        targetRef = menuButtonRef.current
      } else if (activeView === 'profile') {
        targetRef = profileButtonRef.current
      }
      
      if (targetRef) {
        const rect = targetRef.getBoundingClientRect()
        const sidebarRect = targetRef.closest('aside')?.getBoundingClientRect()
        if (sidebarRect) {
          // Calculate position relative to sidebar
          const relativeTop = rect.top - sidebarRect.top
          setIndicatorTop(relativeTop)
        }
      } else {
        setIndicatorTop(null)
      }
    }
    
    // Small delay to ensure refs are attached
    const timeoutId = setTimeout(updateIndicatorPosition, 0)
    window.addEventListener('resize', updateIndicatorPosition)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateIndicatorPosition)
    }
  }, [activeView])

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showProfileMenu &&
        profileMenuRef.current &&
        profileButtonRef.current &&
        !profileMenuRef.current.contains(event.target) &&
        !profileButtonRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  return (
    <aside 
      className="fixed left-0 flex flex-col items-center z-40"
      style={{
        width: '103px',
        height: '100vh',
        top: '0px',
        backgroundColor: 'rgba(21, 21, 21, 0.8)',
        backdropFilter: 'blur(24px)',
        borderRight: 'none',
        position: 'fixed',
        paddingTop: '24px',
        paddingBottom: '24px'
      }}
    >
      {/* Dynamic Active Indicator - Positioned relative to sidebar for all icons */}
      {indicatorTop !== null && (
        <motion.div
          initial={false}
          animate={{ opacity: 1, top: indicatorTop }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: '4px',
            height: '40px',
            top: indicatorTop,
            right: '0px',
            opacity: 1,
            background: 'linear-gradient(180deg, #472E33 0%, #2F1E22 100%)',
            border: 'none',
            borderRadius: '0px',
            zIndex: 20,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Top Section: Logo + Navigation Icons */}
      <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
        {/* Logo - Top */}
        <motion.button
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={() => onNavigate('landing')}
          className="flex items-center justify-center group relative overflow-visible"
          style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(180deg, #683F49 0%, #4A1E35 100%)',
            borderRadius: '24px',
            border: '1px solid transparent',
            opacity: 1,
            marginBottom: '32px'
          }}
        >
          <svg 
            className="transition-all duration-200" 
            viewBox="0 0 35 35" 
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: '25.028922606316197px',
              height: '25.02657275284079px'
            }}
          >
            <path d="M33.9733 17.6613L34.0623 17.6386C34.1463 17.6024 34.2095 17.5285 34.2294 17.4383L34.2322 17.4245V17.419L34.237 17.3879V17.3478L34.2363 17.3458C34.2361 17.3436 34.2361 17.3408 34.2357 17.3368C34.2354 17.3348 34.2346 17.3324 34.2343 17.3299C34.2341 17.328 34.2338 17.3259 34.2336 17.3237C34.2332 17.3207 34.2324 17.3183 34.2322 17.3168L34.2336 17.3223C34.2325 17.3167 34.232 17.3129 34.2315 17.3106L34.2301 17.3092L34.2281 17.3002C34.1977 17.1807 34.0941 17.0917 33.9705 17.0813L33.9505 17.0806L33.9304 17.0772C29.1915 16.2868 25.5563 14.4902 22.8847 11.731C20.2237 8.98289 18.5566 5.31875 17.6739 0.849603C17.6661 0.821409 17.6602 0.79185 17.6573 0.761215C17.6445 0.62366 17.5351 0.514374 17.397 0.502265L17.3963 0.502955C17.3937 0.502794 17.3917 0.502347 17.3901 0.502265C17.3876 0.502146 17.3878 0.501574 17.3894 0.501574H17.388L17.3797 0.502955L17.3583 0.503646H17.3542C17.2133 0.509297 17.0961 0.619108 17.0814 0.761215L17.0787 0.783312L17.0745 0.805409C16.196 5.2942 14.5268 8.97356 11.8568 11.731C9.18369 14.4918 5.54583 16.2885 0.803458 17.0778L0.784123 17.082L0.764097 17.0827C0.638896 17.0934 0.534961 17.1852 0.507909 17.3071C0.507123 17.3106 0.505319 17.3139 0.504457 17.3175L0.501695 17.3423C0.501273 17.3463 0.50024 17.3506 0.499623 17.3554H0.501004V17.3637L0.500313 17.3741V17.3824L0.501695 17.3907C0.502005 17.3959 0.500862 17.3989 0.501004 17.401C0.501294 17.4035 0.502527 17.4043 0.502385 17.4024V17.4093L0.503766 17.4162C0.524133 17.5484 0.633252 17.6505 0.76686 17.6613L0.788266 17.6634L0.808982 17.6662C5.54808 18.4554 9.18414 20.2519 11.8561 23.0109C14.525 25.7667 16.194 29.444 17.0724 33.9296L17.0773 33.9538L17.0793 33.978C17.0926 34.1175 17.2025 34.2256 17.339 34.2376L17.3493 34.2383L17.359 34.2397L17.3597 34.2404H17.3804L17.4329 34.2335C17.5527 34.2065 17.6434 34.1068 17.6566 33.9821L17.6594 33.96L17.6635 33.9393C18.5437 29.4502 20.2128 25.7706 22.8819 23.013C25.5542 20.2521 29.191 18.4549 33.9332 17.6655L33.9339 17.6648C33.9466 17.6627 33.9597 17.6645 33.9726 17.6634M33.9733 17.6613L33.9726 17.6634M33.9733 17.6613L33.9726 17.6634M33.9733 17.6613C33.9804 17.6607 33.9876 17.6624 33.9947 17.662C33.9872 17.6623 33.98 17.6628 33.9726 17.6634M34.2847 17.7366L34.3696 17.805C34.3416 17.777 34.3103 17.7539 34.2778 17.7338C34.2799 17.7351 34.2826 17.7353 34.2847 17.7366ZM34.1742 17.6855C34.1978 17.6933 34.2197 17.7046 34.2419 17.7159C34.2196 17.7045 34.1977 17.6934 34.1742 17.6855ZM34.0672 17.6627C34.086 17.6646 34.104 17.6698 34.1224 17.6738C34.104 17.6697 34.0859 17.6647 34.0672 17.6627ZM18.2394 1.20937C18.2226 1.21215 18.2059 1.21461 18.189 1.21559C18.2059 1.21458 18.2226 1.21217 18.2394 1.20937ZM17.8935 0.290271C17.9121 0.278436 17.9307 0.267459 17.9501 0.258506C17.9307 0.267479 17.9121 0.278412 17.8935 0.290271ZM17.6691 0.394541C17.6656 0.397208 17.6615 0.398867 17.658 0.401447C17.6615 0.398841 17.6657 0.397234 17.6691 0.394541ZM17.8196 0.199811C17.8145 0.211367 17.8076 0.221849 17.8016 0.232957C17.8075 0.221806 17.8146 0.211394 17.8196 0.199811ZM17.5655 0.45669C17.5458 0.465506 17.5257 0.473946 17.5047 0.480168C17.5258 0.473846 17.5457 0.465589 17.5655 0.45669ZM17.8362 0.155617C17.8335 0.163819 17.8303 0.171762 17.8272 0.179785C17.8304 0.171467 17.832 0.162735 17.8348 0.154236L17.8362 0.155617ZM0.445071 17.4597C0.42457 17.4934 0.401288 17.5255 0.373255 17.5536C0.401452 17.5254 0.424597 17.4932 0.445071 17.4597ZM0.503766 17.3237C0.503504 17.3265 0.503042 17.3309 0.502385 17.3361V17.3347L0.503766 17.3237Z" fill="url(#paint0_linear_sidebar_star)" stroke="url(#paint1_linear_sidebar_star)"/>
            <defs>
              <linearGradient id="paint0_linear_sidebar_star" x1="8.52142" y1="8.52295" x2="26.2179" y2="26.2194" gradientUnits="userSpaceOnUse">
                <stop stopColor="#472E33"/>
                <stop offset="1" stopColor="#2F1E22"/>
              </linearGradient>
              <linearGradient id="paint1_linear_sidebar_star" x1="5.0185" y1="15.7126" x2="29.5361" y2="19.2163" gradientUnits="userSpaceOnUse">
                <stop stopColor="white" stopOpacity="0.24"/>
                <stop offset="0.5" stopColor="white" stopOpacity="0.1"/>
                <stop offset="1" stopColor="white" stopOpacity="0.24"/>
              </linearGradient>
            </defs>
          </svg>
        </motion.button>

        {/* Navigation Icons - Directly below logo with equal spacing */}
        <div 
          className="flex flex-col items-center"
          style={{
            gap: '32px',
            width: '100%',
            position: 'relative'
          }}
        >

        {/* Home Icon Button */}
          <motion.button
          ref={homeButtonRef}
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          onClick={() => onNavigate('landing')}
          style={{
            width: '40px',
            height: '40px',
            transform: 'rotate(0deg)',
            opacity: 1,
            borderRadius: '24px',
            padding: '1px',
            background: 'linear-gradient(143.13deg, rgba(255, 255, 255, 0.12) 14.43%, rgba(255, 255, 255, 0.02) 49.78%, rgba(255, 255, 255, 0.12) 85.12%)',
            border: 'none',
            backdropFilter: 'blur(24px)',
            boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            zIndex: 10,
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '23px',
              backgroundColor: '#151515CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
              style={{
                color: activeView === 'landing' || activeView === 'chat' ? '#facc15' : '#a3a3a3'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        </motion.button>

          {/* Menu Icon - 3 Stripes - Directly navigates to My Bookings */}
          <motion.button
            ref={menuButtonRef}
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleMenuClick}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '24px',
              padding: '1px',
              background: 'linear-gradient(143.13deg, rgba(255, 255, 255, 0.12) 14.43%, rgba(255, 255, 255, 0.02) 49.78%, rgba(255, 255, 255, 0.12) 85.12%)',
              border: 'none',
              backdropFilter: 'blur(24px)',
              boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '23px',
                backgroundColor: '#151515CC',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px'
              }}
            >
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M1 1H13" 
                  stroke={activeView === 'bookings' ? '#facc15' : 'white'} 
                  strokeOpacity={activeView === 'bookings' ? '1' : '0.5'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M1 1H13" 
                  stroke={activeView === 'bookings' ? '#facc15' : 'white'} 
                  strokeOpacity={activeView === 'bookings' ? '1' : '0.5'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M1 1H13" 
                  stroke={activeView === 'bookings' ? '#facc15' : 'white'} 
                  strokeOpacity={activeView === 'bookings' ? '1' : '0.5'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Spacer to push Profile to bottom */}
      <div style={{ flex: '1 1 auto', minHeight: 0 }} />

      {/* User Icon / Profile Button - Bottom */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <motion.button
          ref={profileButtonRef}
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleProfileClick}
          onContextMenu={handleProfileRightClick}
          style={{
            width: '40px',
            height: '40px',
            transform: 'rotate(0deg)',
            opacity: 1,
            borderRadius: '24px',
            padding: '1px',
            background: 'linear-gradient(143.13deg, rgba(255, 255, 255, 0.12) 14.43%, rgba(255, 255, 255, 0.02) 49.78%, rgba(255, 255, 255, 0.12) 85.12%)',
            border: 'none',
            backdropFilter: 'blur(24px)',
            boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '23px',
              backgroundColor: 'rgba(21, 21, 21, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {user ? (
              // Profile picture when logged in - centered icon
              <svg 
                width="12" 
                height="13.37" 
                viewBox="0 0 14 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <path 
                  d="M7.0001 8.23873C8.99799 8.23873 10.6195 6.61725 10.6195 4.61936C10.6195 2.62147 8.99799 1 7.0001 1C5.00221 1 3.38074 2.62147 3.38074 4.61936C3.38074 6.61725 5.00221 8.23873 7.0001 8.23873Z" 
                  stroke={activeView === 'profile' ? '#facc15' : 'white'} 
                  strokeOpacity={activeView === 'profile' ? '1' : '0.5'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.0002 14.371C12.1505 12.9142 9.77623 11.8583 7.00018 11.8583C4.22413 11.8583 1.84983 12.9142 1.00018 14.371" 
                  stroke={activeView === 'profile' ? '#facc15' : 'white'} 
                  strokeOpacity={activeView === 'profile' ? '1' : '0.5'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            ) : (
              // Sign in icon when not logged in - fully visible
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 14 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M7.0001 8.23873C8.99799 8.23873 10.6195 6.61725 10.6195 4.61936C10.6195 2.62147 8.99799 1 7.0001 1C5.00221 1 3.38074 2.62147 3.38074 4.61936C3.38074 6.61725 5.00221 8.23873 7.0001 8.23873Z" 
                  stroke="white" 
                  strokeOpacity="1" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.0002 14.371C12.1505 12.9142 9.77623 11.8583 7.00018 11.8583C4.22413 11.8583 1.84983 12.9142 1.00018 14.371" 
                  stroke="white" 
                  strokeOpacity="1" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
          </div>
        </motion.button>

        {/* Profile Dropdown Menu - Only for Profile and Logout */}
        <AnimatePresence>
          {showProfileMenu && user && (
            <motion.div
              ref={profileMenuRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                bottom: '60px',
                left: '103px',
                minWidth: '180px',
                backgroundColor: 'rgba(21, 21, 21, 0.95)',
                backdropFilter: 'blur(24px)',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 50
              }}
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
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
                  borderRadius: '8px'
                }}
              >
                My Profile
              </motion.button>
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px'
                }}
              >
                Logout
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}

export default memo(SidebarComponent)
