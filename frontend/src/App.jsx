import { useState, useEffect, useRef, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { getUserContext } from './lib/userContext'
import { useChat } from './contexts/ChatContext'
import LandingPage from './components/LandingPage'
import AuthModal from './components/AuthModal'
import MyBookings from './components/MyBookings'
import MyProfile from './components/MyProfile'
import Sidebar from './components/Sidebar'
import MobileHeader from './components/MobileHeader'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import TypingIndicator from './components/TypingIndicator'
import JetSuggestions from './components/JetSuggestions'
import BookingConfirmed from './components/BookingConfirmed'
import PhotoGalleryModal from './components/PhotoGalleryModal'

// API URL from environment variable, fallback to proxy for local dev
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

// Views: 'landing' | 'chat' | 'bookings'
export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authBlockingError, setAuthBlockingError] = useState(null)
  
  // Derive view from location pathname
  const getViewFromPath = (pathname) => {
    if (pathname === '/my-bookings') return 'bookings'
    if (pathname === '/profile') return 'profile'
    if (pathname === '/chat' || pathname.startsWith('/chat/')) return 'chat'
    return 'landing'
  }
  const view = getViewFromPath(location.pathname)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingBookingSessionId, setPendingBookingSessionId] = useState(null)
  const [isAuthInProgress, setIsAuthInProgress] = useState(false) // Flag to disable chat-leave warnings during auth
  
  // Chat state from context (lives only in memory, no localStorage)
  const {
    sessionId,
    setSessionId,
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    showJets,
    setShowJets,
    aircraft,
    setAircraft,
    aircraftNavigationIntent,
    setAircraftNavigationIntent,
    leadState,
    setLeadState,
    bookingConfirmed,
    setBookingConfirmed,
    selectedAircraft,
    setSelectedAircraft,
    previewAircraft,
    setPreviewAircraft,
    showPhotoGallery,
    setShowPhotoGallery,
    chatStarted,
    setChatStarted,
    hasInitialized,
    prevRoutePaxRef,
    messageIdCounter,
    prevMessageCountRef,
    resetChat,
  } = useChat()
  
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Disable body scroll on mobile (global scroll rule)
  // NOTE: Do NOT set height on html/body - it breaks mobile keyboard resizing
  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.body.style.width = '100%'
    } else {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.width = ''
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.width = ''
    }
  }, [isMobile])

  // Refresh warning on /chat route - DISABLED during auth
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // DO NOT show warning if auth is in progress (OAuth redirect)
      if (isAuthInProgress) {
        return
      }
      if (location.pathname.startsWith('/chat')) {
        e.preventDefault()
        e.returnValue = 'Chat may not be restored. Do you want to continue?'
        return e.returnValue
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [location.pathname, isAuthInProgress])

  // Post-refresh redirect: if user was on /chat before refresh, redirect to / after page loads
  // This handles the case where user confirms refresh on /chat
  useEffect(() => {
    const wasOnChatBeforeRefresh = sessionStorage.getItem('was_on_chat')
    if (wasOnChatBeforeRefresh === 'true' && location.pathname.startsWith('/chat')) {
      // Clear the flag and redirect to home (chat will be naturally cleared)
      sessionStorage.removeItem('was_on_chat')
      navigate('/', { replace: true })
    }
    // Set flag when we're on /chat (for next refresh detection)
    if (location.pathname.startsWith('/chat')) {
      sessionStorage.setItem('was_on_chat', 'true')
    } else {
      sessionStorage.removeItem('was_on_chat')
    }
  }, [location.pathname, navigate])

  // Desktop route override: redirect / to /chat if chatStarted === true (DESKTOP ONLY)
  useEffect(() => {
    if (!isMobile && chatStarted && location.pathname === '/') {
      navigate('/chat', { replace: true })
    }
  }, [location.pathname, chatStarted, isMobile, navigate])

  // Initialize auth state
  useEffect(() => {
    const enforceProviderConsistency = async (session) => {
      if (!session?.user?.email) return
      const attemptedProvider = session.user.app_metadata?.provider
      if (!attemptedProvider) return

      try {
        const response = await fetch(`${API_BASE}/auth/provider-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            attempted_provider: attemptedProvider
          })
        })

        if (!response.ok) {
          console.warn('Provider check failed with status', response.status)
          return
        }

        const data = await response.json()
        if (data?.conflict) {
          const conflictMessage = attemptedProvider === 'google'
            ? 'This email is already registered. Please sign in using email.'
            : 'This account was created using Google. Please sign in with Google.'

          setAuthBlockingError(conflictMessage)
          setShowAuthModal(true)
          await supabase.auth.signOut()
        } else {
          setAuthBlockingError(null)
        }
      } catch (error) {
        console.warn('Provider consistency check failed:', error)
      }
    }

    // Check for password recovery token in URL on initial load
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type')
    if (type === 'recovery') {
      setShowAuthModal(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      enforceProviderConsistency(session)
      // if (session?.user) {
      //   console.log('👤 User logged in:')
      //   console.log('   Name:', session.user.user_metadata?.full_name || 'Not set')
      //   console.log('   Email:', session.user.email || 'Not set')
      //   console.log('   User ID:', session.user.id)
      // }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // CRITICAL: Only update user state - NEVER reset chat on auth changes
      // Chat state is independent of auth state and must be preserved during login/logout
      setUser(session?.user ?? null)
      enforceProviderConsistency(session)
      
      // Reset auth-in-progress flag when auth completes (success or failure)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setIsAuthInProgress(false)
      }
      
      // Detect PASSWORD_RECOVERY event and open auth modal
      if (event === 'PASSWORD_RECOVERY') {
        setShowAuthModal(true)
      }
      
      if (session?.user) {
        // console.log('👤 User logged in:')
        // console.log('   Name:', session.user.user_metadata?.full_name || 'Not set')
        // console.log('   Email:', session.user.email || 'Not set')
        // console.log('   User ID:', session.user.id)
      } else {
        console.log('👤 User logged out')
      }
      
      // If user just logged in and there's a pending booking, retry it
      // Chat remains intact - backend will attach user to existing session
      if (session?.user && pendingBookingSessionId) {
        retryBookingConfirmation(pendingBookingSessionId)
        setPendingBookingSessionId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [pendingBookingSessionId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const currentMessageCount = messages.length
    const prevMessageCount = prevMessageCountRef.current

    if (currentMessageCount > prevMessageCount && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }

    prevMessageCountRef.current = currentMessageCount
  }, [messages.length])

  const handleStartChat = (initialMessage = null) => {
    navigate('/chat')
    
    // If initialMessage provided, store it to send as first message
    if (initialMessage) {
      // Store initial message in a ref to send after navigation
      const initialMessageRef = { value: initialMessage }
      
      // Reset chat state for a fresh booking
      setMessages([])
      setShowJets(false)
      setAircraft([])
      setLeadState(null)
      setBookingConfirmed(false)
      setSelectedAircraft(null)
      
      // Send initial message after a brief delay to ensure state is reset
      setTimeout(() => {
        sendMessage(initialMessageRef.value, true)
      }, 100)
    } else {
      // No initial message - just navigate to chat
      if (!hasInitialized.current) {
        hasInitialized.current = true
        startSession()
      }
    }
  }

  const handleMyBookings = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    navigate('/my-bookings')
  }

  const handleMyProfile = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    navigate('/profile')
  }

  const handleLogout = () => {
    resetSession()
    navigate('/')
  }

  const handleAuthSuccess = async () => {
    setShowAuthModal(false)
    setAuthBlockingError(null)
    // If there's a pending booking, retry it after auth success
    if (pendingBookingSessionId) {
      // Resend the last user message to trigger confirmation with auth
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (lastUserMessage) {
        // Small delay to ensure auth state is updated
        setTimeout(() => {
          sendMessage(lastUserMessage.content)
        }, 500)
      }
      setPendingBookingSessionId(null)
    }
  }

  const handleAuthClose = () => {
    // User closed auth modal without authenticating
    // Clear pending booking - submission will remain in 'awaiting_auth' state
    setPendingBookingSessionId(null)
    setShowAuthModal(false)
    setAuthBlockingError(null)
    // Don't send any confirmation message - backend will handle the state
  }

  // Explicit new chat reset: clears chat state (no localStorage)
  const resetSession = () => {
    resetChat()
    setPendingBookingSessionId(null)
  }

  const startSession = async () => {
    if (sessionId) return
    setIsLoading(true)
    try {
      // Get user context if authenticated
      const userContext = await getUserContext()
      const headers = { 'Content-Type': 'application/json' }
      const body = {}
      
      // Add user info if authenticated
      if (userContext.isAuthenticated) {
        body.user_id = userContext.user_id
        body.email = userContext.email
        if (userContext.full_name) {
          body.full_name = userContext.full_name
        }
        // Add auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await response.json()
      
      setSessionId(data.session_id)
      setChatStarted(true) // Mark chat as started when session is created
      messageIdCounter.current += 1
      setMessages([{
        id: `assistant-${messageIdCounter.current}`,
        role: 'assistant',
        content: data.assistant_message,
        isNew: true,
        requiresAuth: false
      }])
      prevMessageCountRef.current = 1
    } catch (error) {
      console.error('Failed to start session:', error)
      messageIdCounter.current += 1
      setMessages([{
        id: `assistant-${messageIdCounter.current}`,
        role: 'assistant',
        content: "Good evening. Welcome to Jetayu. I'm here to assist with your private aviation needs. How may I help you today?",
        isNew: true,
        requiresAuth: false
      }])
      prevMessageCountRef.current = 1
    } finally {
      setIsLoading(false)
    }
  }

  const sendStructuredMessage = async (payload) => {
    // Send structured payload (e.g., AIRCRAFT_SELECTED) - bypasses NLP
    messageIdCounter.current += 1
    const userMessage = {
      id: `user-${messageIdCounter.current}`,
      role: 'user',
      content: payload.type === 'AIRCRAFT_SELECTED' 
        ? `Go with the ${payload.selected_aircraft.name}` 
        : JSON.stringify(payload),
      isNew: true,
    }
    startTransition(() => {
      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)
    })
    
    let currentSessionId = sessionId
    if (!currentSessionId) {
      await startSession()
      currentSessionId = sessionId
    }

    try {
      const userContext = await getUserContext()
      const headers = { 'Content-Type': 'application/json' }
      
      const body = {
        session_id: currentSessionId,
        message: '', // Empty message for structured payloads
        type: payload.type,
        selected_aircraft: payload.selected_aircraft,
      }
      
      if (userContext.isAuthenticated) {
        body.user_id = userContext.user_id
        body.email = userContext.email
        if (userContext.full_name) {
          body.full_name = userContext.full_name
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id)
        setChatStarted(true) // Mark chat as started when session is created
      }

      // Mark chat as started when first structured message is sent
      if (!chatStarted) {
        setChatStarted(true)
      }

      messageIdCounter.current += 1
      startTransition(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${messageIdCounter.current}`,
            role: 'assistant',
            content: data.assistant_message,
            isNew: true,
            requiresAuth: data.requires_auth || false,
            showBookingCTA: data.booking_confirmed || false
          }
        ])

        // Update state from response - batch all updates
        if (data.lead_state) {
          setLeadState(data.lead_state)
          // Backend confirmed aircraft selection - update selectedAircraft but NEVER open preview panel
          if (data.lead_state.selected_aircraft) {
            // Find aircraft from list
            const selected = aircraft.find(a => a.name === data.lead_state.selected_aircraft)
            if (selected) {
              setSelectedAircraft(selected)
            }
          } else {
            setSelectedAircraft(null)
          }
          // CRITICAL: Close preview panel when backend confirms selection
          setPreviewAircraft(null)
        }
        
        setShowJets(data.show_aircraft || false)
        setAircraft(data.aircraft || [])
        setAircraftNavigationIntent(data.aircraft_navigation_intent || null)
        setBookingConfirmed(data.booking_confirmed || false)
        
        if (data.requires_auth) {
          setPendingBookingSessionId(currentSessionId)
          setShowAuthModal(true)
        }
        
        setIsLoading(false)
      })
    } catch (error) {
      console.error('Failed to send structured message:', error)
      setIsLoading(false)
    }
  }

  const sendMessage = async (content, skipStartSession = false) => {
    // DO NOT hide cards here - let backend response determine visibility
    // Cards should stay visible unless selected_aircraft is actually set
    
    messageIdCounter.current += 1
    const userMessage = {
      id: `user-${messageIdCounter.current}`,
      role: 'user',
      content,
      isNew: true,
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    
    // Mark chat as started when first user message is sent
    if (!chatStarted) {
      setChatStarted(true)
    }
    
    // Check if user is asking for different aircraft options
    // This will trigger backend to clear selected_aircraft
    const isAskingForAircraft = /(show|see|other|different|change|another|more|options?|jets?|aircraft)/i.test(content)
    if (isAskingForAircraft && selectedAircraft) {
      // Clear local selection - backend will handle clearing DB state
      setSelectedAircraft(null)
    }

    let currentSessionId = sessionId
    if (!currentSessionId && !skipStartSession) {
      await startSession()
      currentSessionId = sessionId
    }

    try {
      // Get user context if authenticated
      const userContext = await getUserContext()
      const headers = {
        'Content-Type': 'application/json',
      }
      
      const body = {
        session_id: currentSessionId || '', // Empty string if no session - backend will create one
        message: content,
      }
      
      // Add user info if authenticated (so concierge doesn't ask for it)
      if (userContext.isAuthenticated) {
        body.user_id = userContext.user_id
        body.email = userContext.email
        if (userContext.full_name) {
          body.full_name = userContext.full_name
        }
        // Add auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id)
        setChatStarted(true) // Mark chat as started when session is created
      }

      // Batch all state updates to prevent cascading re-renders
      startTransition(() => {
        messageIdCounter.current += 1
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${messageIdCounter.current}`,
            role: 'assistant',
            content: data.assistant_message,
            isNew: true,
            requiresAuth: data.requires_auth || false,
            showBookingCTA: data.booking_confirmed || false
          }
        ])

        setLeadState(data.lead_state)
        setAircraftNavigationIntent(data.aircraft_navigation_intent || null)

        // Update ref with current route/pax
        const currentRoute = {
          route_from: data.lead_state?.route_from,
          route_to: data.lead_state?.route_to,
          pax: data.lead_state?.pax
        }
        prevRoutePaxRef.current = currentRoute

        // CRITICAL: Aircraft cards visibility depends ONLY on backend response
        const hasSelectedAircraft = data.lead_state?.selected_aircraft !== null && data.lead_state?.selected_aircraft !== undefined
        
        if (hasSelectedAircraft) {
          // Aircraft is selected - hide cards and close preview panel immediately
          setShowJets(false)
          setPreviewAircraft(null) // CRITICAL: Close preview panel when backend confirms selection
          // Update selectedAircraft state from backend (confirmed selection)
          if (data.lead_state.selected_aircraft) {
            // Find matching aircraft from the list
            const matchedAircraft = data.aircraft?.find(
              a => a.name === data.lead_state.selected_aircraft
            ) || selectedAircraft
            if (matchedAircraft && matchedAircraft.name === data.lead_state.selected_aircraft) {
              setSelectedAircraft(matchedAircraft)
            }
          }
        } else {
          // No aircraft selected - show cards if backend says so
          if (data.show_aircraft && data.aircraft && data.aircraft.length > 0) {
            setAircraft(data.aircraft)
            setShowJets(true)
          }
          // Clear selectedAircraft state if backend cleared it
          if (selectedAircraft && !data.lead_state?.selected_aircraft) {
            setSelectedAircraft(null)
          }
        }
      })

      // Handle auth requirement for booking
      // Note: Auth modal will be opened via CTA button in chat message
      // We still track the session ID for retry after auth
      if (data.requires_auth) {
        setPendingBookingSessionId(currentSessionId)
        // Do NOT auto-open modal - let user click CTA button in chat
      }

      if (data.booking_confirmed) {
        // Lead successfully created - add system message with CTAs
        setBookingConfirmed(false) // Don't show separate confirmation UI
        
        // Add final system message with CTAs based on auth state
        messageIdCounter.current += 1
        const finalMessage = {
          id: `assistant-${messageIdCounter.current}`,
          role: 'assistant',
          content: 'Your request has been submitted. Our operators will contact you shortly.',
          isNew: true,
          requiresAuth: !user, // Show Login CTA if not logged in
          showMyBookingsLink: !!user, // Show My Bookings link if logged in
        }
        setMessages(prev => [...prev, finalMessage])
        
        // Chat continues - no redirect (user stays in conversation)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      messageIdCounter.current += 1
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${messageIdCounter.current}`,
          role: 'assistant',
          content: "Of course. I'm taking note of that. Could you tell me a bit more about your travel plans?",
          isNew: true,
          requiresAuth: false
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const retryBookingConfirmation = async (sessionIdToRetry) => {
    // Resend the last message that triggered booking confirmation
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content)
    }
  }

  const handleJetSelect = (payload) => {
    // CRITICAL: Close panel IMMEDIATELY before sending message
    setPreviewAircraft(null)
    setShowJets(false)
    // Optimistically reflect selection locally for immediate UX
    if (typeof payload === 'object' && payload.type === 'AIRCRAFT_SELECTED') {
      if (payload.selected_aircraft?.name) {
        setSelectedAircraft(payload.selected_aircraft)
      }
    }
    
    // payload can be either a string (legacy) or structured object (AIRCRAFT_SELECTED)
    if (typeof payload === 'object' && payload.type === 'AIRCRAFT_SELECTED') {
      // Send structured payload
      sendStructuredMessage(payload)
    } else {
      // Legacy string message (for backwards compatibility)
      sendMessage(payload)
    }
  }

  // Preview/interaction - user clicked card (not selection)
  const handleAircraftCardPreview = (jet) => {
    // Open preview panel IMMEDIATELY - no delay, no backend dependency
    setPreviewAircraft(jet)
    // DO NOT hide cards - they should remain visible during preview
    // DO NOT touch selectedAircraft (that's for confirmed selection)
  }

  // Helper: Convert range_nm to km
  const convertRangeToKm = (range_nm) => {
    if (!range_nm) return null
    return Math.round(range_nm * 1.852)
  }

  // Helper: Calculate flight time (placeholder implementation)
  const calculateFlightTime = (aircraft, routeFrom, routeTo) => {
    // For now, use a placeholder estimate
    // In production, this would use a route distance API
    // Placeholder: estimate based on typical route (e.g., 2000-8000 km for international)
    if (!aircraft?.speed_kph) return null
    
    // Placeholder: Assume ~5000 km for typical international route
    // Real implementation would calculate actual route distance
    const estimatedDistanceKm = 5000
    const flightTimeHours = estimatedDistanceKm / aircraft.speed_kph
    
    // Return formatted string
    if (flightTimeHours < 1) {
      return `${Math.round(flightTimeHours * 60)} min`
    } else if (flightTimeHours < 10) {
      return `${flightTimeHours.toFixed(1)} hrs`
    } else {
      return `${Math.round(flightTimeHours)} hrs`
    }
  }

  // Unified layout wrapper for all views
  const renderLayout = (content) => {
    if (isMobile) {
      return (
        <>
          <MobileHeader
            user={user}
            onAuthClick={() => setShowAuthModal(true)}
            onMyBookings={handleMyBookings}
            onMyProfile={handleMyProfile}
            onLogout={handleLogout}
            onResetChat={resetChat}
          />
          <div
            style={{
              marginTop: '64px',
              width: '100%',
              height: 'calc(100dvh - 64px)',
              backgroundColor: '#060201',
              backdropFilter: 'blur(24px)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: '12px',
              boxSizing: 'border-box'
            }}
          >
            {content}
          </div>
          <AuthModal
            isOpen={showAuthModal}
            onClose={handleAuthClose}
            onSuccess={handleAuthSuccess}
            externalError={authBlockingError}
            onAuthStart={() => setIsAuthInProgress(true)}
            onAuthEnd={() => setIsAuthInProgress(false)}
          />
        </>
      )
    }
    
    return (
      <>
        <div className="h-screen bg-jet-950" style={{ position: 'relative' }}>
          {/* Sidebar - fixed position, out of flow */}
          <Sidebar 
            activeView={view} 
            onNavigate={(viewName) => {
              // Desktop route override: if chatStarted, landing navigates to /chat instead
              if (viewName === 'landing') {
                if (!isMobile && chatStarted) {
                  navigate('/chat')
                } else {
                  navigate('/')
                }
              }
              if (viewName === 'chat') navigate('/chat')
              if (viewName === 'bookings') handleMyBookings()
              if (viewName === 'profile') handleMyProfile()
            }}
            onAuthClick={() => setShowAuthModal(true)}
            onMyBookings={handleMyBookings}
            onMyProfile={handleMyProfile}
            onLogout={handleLogout}
            user={user}
          />
          {/* Shared background container matching chat view - starts exactly at 103px */}
          <div
            style={{
              marginLeft: '103px',
              width: 'calc(100% - 103px)',
              height: '100vh',
              backgroundColor: '#060201',
              backdropFilter: 'blur(24px)',
              position: 'relative'
            }}
          >
            {content}
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={handleAuthClose}
          onSuccess={handleAuthSuccess}
          externalError={authBlockingError}
          onAuthStart={() => setIsAuthInProgress(true)}
          onAuthEnd={() => setIsAuthInProgress(false)}
        />
      </>
    )
  }

  // Route components
  const LandingRoute = () => renderLayout(
    <LandingPage 
      onStartChat={handleStartChat}
      onMyBookings={handleMyBookings}
      onAuthClick={() => setShowAuthModal(true)}
    />
  )

  const MyBookingsRoute = () => renderLayout(
    <MyBookings 
      onBack={() => navigate('/')}
      user={user}
      onAuthClick={() => setShowAuthModal(true)}
      onMyBookings={handleMyBookings}
      onMyProfile={handleMyProfile}
      onLogout={handleLogout}
      onStartNewBooking={() => handleStartChat(true)}
    />
  )

  const MyProfileRoute = () => renderLayout(
    <MyProfile 
      onBack={() => navigate('/')}
      user={user}
      onAuthClick={() => setShowAuthModal(true)}
      onMyBookings={handleMyBookings}
      onMyProfile={handleMyProfile}
      onLogout={handleLogout}
    />
  )

  const ChatRoute = () => {
    if (isMobile) {
      return (
        <>
          <MobileHeader
            user={user}
            onAuthClick={() => setShowAuthModal(true)}
            onMyBookings={handleMyBookings}
            onMyProfile={handleMyProfile}
            onLogout={handleLogout}
            onResetChat={resetChat}
          />
          <div
            style={{
              marginTop: '64px',
              height: 'calc(100dvh - 64px)',
              width: '100%',
              backgroundColor: '#060201',
              backdropFilter: 'blur(24px)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Chat Messages - Scrollable (ONLY scrollable area) */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto hide-scrollbar"
              style={{ 
                padding: '24px 16px',
                minHeight: 0,
                flex: '1',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              <div className="relative z-10" style={{ width: '100%' }}>
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <ChatMessage
                        message={message.content}
                        isUser={message.role === 'user'}
                        isNew={message.isNew}
                        requiresAuth={message.requiresAuth}
                        onAuthClick={() => setShowAuthModal(true)}
                        showMyBookingsLink={message.showMyBookingsLink || false}
                        onMyBookingsClick={message.showMyBookingsLink ? handleMyBookings : undefined}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {isLoading && <TypingIndicator />}
                </AnimatePresence>

                <AnimatePresence>
                  {bookingConfirmed && <BookingConfirmed />}
                </AnimatePresence>

                <AnimatePresence>
                  {showJets && !isLoading && aircraft.length > 0 && (
                    <JetSuggestions 
                      aircraft={aircraft} 
                      onSelect={handleJetSelect}
                      onPreview={handleAircraftCardPreview}
                      navigationIntent={aircraftNavigationIntent}
                      selectedAircraft={selectedAircraft}
                    />
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} style={{ height: '1px' }} />
              </div>
            </div>
            
            {/* Chat Input - Fixed at bottom (NOT in scroll container) */}
            <div style={{ 
              flexShrink: 0,
              width: '100%',
              backgroundColor: 'transparent',
              padding: '16px',
              paddingBottom: `max(28px, calc(16px + 12px + env(safe-area-inset-bottom)))`,
              zIndex: 10
            }}>
              <ChatInput 
                onSend={sendMessage} 
                disabled={isLoading}
                placeholder={messages.length === 0 && !sessionId ? "Type your request…" : ""}
                isMobile={true}
              />
            </div>
          </div>

          {/* Full-Screen Aircraft Modal for Mobile */}
          <AnimatePresence>
            {previewAircraft && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPreviewAircraft(null)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(6, 2, 1, 0.95)',
                    backdropFilter: 'blur(24px)',
                    zIndex: 300
                  }}
                />
                {/* Full-Screen Modal */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(21, 21, 21, 0.98)',
                    backdropFilter: 'blur(24px)',
                    zIndex: 301,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Close Button */}
                  <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button
                      onClick={() => setPreviewAircraft(null)}
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

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px', paddingBottom: '100px' }}>
                    {/* Aircraft Name */}
                    <h2 style={{
                      fontSize: '28px',
                      fontWeight: 400,
                      color: '#FFFFFF',
                      marginBottom: '24px',
                      fontFamily: 'Cormorant Garamond, serif',
                      textAlign: 'center'
                    }}>
                      {previewAircraft.name}
                    </h2>

                    {/* Hero Image */}
                    <div style={{ width: '100%', height: '240px', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
                      <img
                        src={previewAircraft.image_url || previewAircraft.image}
                        alt={previewAircraft.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>

                    {/* Stats Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '16px',
                      marginBottom: '24px',
                      paddingBottom: '24px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                          {previewAircraft.capacity || 'N/A'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Passengers
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                          {previewAircraft.range_nm ? `${convertRangeToKm(previewAircraft.range_nm).toLocaleString()} km` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Range
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                          {calculateFlightTime(previewAircraft, leadState?.route_from, leadState?.route_to) || '~10 hrs'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Flight Time
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                          {previewAircraft.speed_kph ? `${previewAircraft.speed_kph} km/h` : 'N/A'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          Speed
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {previewAircraft.description && (
                      <p style={{
                        fontSize: '15px',
                        lineHeight: '1.6',
                        color: 'rgba(255, 255, 255, 0.7)',
                        marginBottom: '24px'
                      }}>
                        {previewAircraft.description}
                      </p>
                    )}

                    {/* Interior Images */}
                    {previewAircraft.interior_images && previewAircraft.interior_images.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr',
                          gap: '12px',
                          marginBottom: '16px'
                        }}>
                          <div style={{
                            width: '100%',
                            height: '200px',
                            borderRadius: '12px',
                            overflow: 'hidden'
                          }}>
                            <img
                              src={previewAircraft.interior_images[0]}
                              alt="Interior"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {previewAircraft.interior_images.slice(1, 3).map((img, index) => (
                              <div
                                key={`interior-${previewAircraft.id}-${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '94px',
                                  borderRadius: '12px',
                                  overflow: 'hidden'
                                }}
                              >
                                <img
                                  src={img}
                                  alt={`Interior ${index + 2}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        {previewAircraft.interior_images.length > 0 && (
                          <button
                            onClick={() => setShowPhotoGallery(true)}
                            style={{
                              width: '100%',
                              padding: '12px 20px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '12px',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '14px',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            All Photos ({previewAircraft.interior_images.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fixed Select Button at Bottom */}
                  <div style={{
                    position: 'sticky',
                    bottom: 0,
                    padding: '24px',
                    backgroundColor: 'rgba(21, 21, 21, 0.98)',
                    backdropFilter: 'blur(24px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => {
                        handleJetSelect({
                          type: "AIRCRAFT_SELECTED",
                          selected_aircraft: {
                            id: previewAircraft.id,
                            name: previewAircraft.name
                          }
                        })
                      }}
                      style={{
                        width: '100%',
                        padding: '16px 24px',
                        backgroundColor: '#FFFFFF',
                        color: '#0a0a0a',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Select this aircraft
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AuthModal
            isOpen={showAuthModal}
            onClose={handleAuthClose}
            onSuccess={handleAuthSuccess}
            externalError={authBlockingError}
            onAuthStart={() => setIsAuthInProgress(true)}
            onAuthEnd={() => setIsAuthInProgress(false)}
          />

          <PhotoGalleryModal
            isOpen={showPhotoGallery}
            images={previewAircraft?.interior_images || []}
            onClose={() => setShowPhotoGallery(false)}
            aircraftName={previewAircraft?.name || ''}
          />
        </>
      )
    }

    return (
      <>
        <div className="h-screen bg-jet-950" style={{ position: 'relative' }}>
          {/* Sidebar - fixed position, out of flow */}
          <Sidebar 
            activeView="chat" 
            onNavigate={(viewName) => {
              // Desktop route override: if chatStarted, landing navigates to /chat instead
              if (viewName === 'landing') {
                if (!isMobile && chatStarted) {
                  navigate('/chat', { replace: true })
                } else {
                  navigate('/')
                }
              }
              if (viewName === 'chat') navigate('/chat')
              if (viewName === 'bookings') handleMyBookings()
              if (viewName === 'profile') handleMyProfile()
            }}
            onAuthClick={() => setShowAuthModal(true)}
            onMyBookings={handleMyBookings}
            onMyProfile={handleMyProfile}
            onLogout={handleLogout}
            user={user}
          />
          
          {/* Shared background container matching landing page - starts exactly at 103px */}
          <div
            style={{
              marginLeft: '103px',
              width: 'calc(100% - 103px)',
              height: '100vh',
              backgroundColor: '#060201',
              backdropFilter: 'blur(24px)',
              position: 'relative'
            }}
          >
          {/* Chat Layout Container - Static layout, no animations */}
          <div 
            className="relative" 
            style={{ 
              height: '100vh', 
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: previewAircraft ? 'flex-start' : 'center',
              gap: previewAircraft ? '24px' : '0',
              padding: '24px'
            }}
          >
          {/* Chat Panel */}
          <main 
            className="relative"
            style={{
              width: '704px',
              height: '100%',
              backgroundColor: '#060201',
              backdropFilter: 'blur(24px)',
              boxShadow: '0px 2px 40px rgba(0, 0, 0, 0.1)',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Scrollable Messages Area */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto hide-scrollbar relative" 
              style={{ padding: '48px 24px 120px 24px', minHeight: 0 }}
            >
              <div className="relative z-10" style={{ width: '100%' }}>
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <ChatMessage
                        message={message.content}
                        isUser={message.role === 'user'}
                        isNew={message.isNew}
                        requiresAuth={message.requiresAuth}
                        onAuthClick={() => setShowAuthModal(true)}
                        showMyBookingsLink={message.showMyBookingsLink || false}
                        onMyBookingsClick={message.showMyBookingsLink ? handleMyBookings : undefined}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                <AnimatePresence>
                  {isLoading && <TypingIndicator />}
                </AnimatePresence>

                <AnimatePresence>
                  {bookingConfirmed && <BookingConfirmed />}
                </AnimatePresence>

                <AnimatePresence>
                  {showJets && !isLoading && aircraft.length > 0 && (
                    <JetSuggestions 
                      aircraft={aircraft} 
                      onSelect={handleJetSelect}
                      onPreview={handleAircraftCardPreview}
                      navigationIntent={aircraftNavigationIntent}
                      selectedAircraft={selectedAircraft}
                    />
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} className="h-8" />
              </div>
            </div>
            
            {/* Chat Input - Fixed at bottom */}
            <div style={{ flexShrink: 0 }}>
              <ChatInput 
                onSend={sendMessage} 
                disabled={isLoading}
                placeholder={messages.length === 0 && !sessionId ? "Type your request…" : ""}
              />
            </div>
          </main>

          {/* Aircraft Panel (RIGHT) - Only visible when previewing (NOT confirmed selection) */}
          <AnimatePresence>
            {previewAircraft && (
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{
                  flex: 1,
                  maxWidth: '600px',
                  height: '100%',
                  backgroundColor: 'rgba(21, 21, 21, 0.8)',
                  backdropFilter: 'blur(24px)',
                  borderRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0px 2px 40px rgba(0, 0, 0, 0.2)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Close Button */}
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setPreviewAircraft(null)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px', paddingBottom: '100px' }}>
                  {/* 1) Header - Aircraft Name (Centered) */}
                  <h2 style={{
                    fontSize: '32px',
                    fontWeight: 400,
                    color: '#FFFFFF',
                    marginBottom: '24px',
                    fontFamily: 'Cormorant Garamond, serif',
                    textAlign: 'center'
                  }}>
                    {previewAircraft.name}
                  </h2>

                  {/* 2) Hero Image */}
                  <div style={{ width: '100%', height: '300px', borderRadius: '16px', overflow: 'hidden', marginBottom: '32px' }}>
                    <img
                      src={previewAircraft.image_url || previewAircraft.image}
                      alt={previewAircraft.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>

                  {/* 3) Stats Row (4 items: Passengers, Range, Flight Time, Speed) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '32px',
                    paddingBottom: '24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {/* Passengers */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                        {previewAircraft.capacity || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Passengers
                      </div>
                    </div>

                    {/* Range (converted to km) */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                        {previewAircraft.range_nm ? `${convertRangeToKm(previewAircraft.range_nm).toLocaleString()} km` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Range
                      </div>
                    </div>

                    {/* Flight Time */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                        {calculateFlightTime(previewAircraft, leadState?.route_from, leadState?.route_to) || '~10 hrs'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Flight Time
                      </div>
                    </div>

                    {/* Speed */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
                        {previewAircraft.speed_kph ? `${previewAircraft.speed_kph} km/h` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Speed
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {previewAircraft.description && (
                    <p style={{
                      fontSize: '15px',
                      lineHeight: '1.6',
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: '32px'
                    }}>
                      {previewAircraft.description}
                    </p>
                  )}

                  {/* 4) Interior Images Section */}
                  {previewAircraft.interior_images && previewAircraft.interior_images.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr',
                        gap: '12px',
                        marginBottom: '16px'
                      }}>
                        {/* Main large image */}
                        <div style={{
                          width: '100%',
                          height: '240px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <img
                            src={previewAircraft.interior_images[0]}
                            alt="Interior"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>

                        {/* Stacked smaller images */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {previewAircraft.interior_images.slice(1, 3).map((img, index) => (
                            <div
                              key={`interior-${previewAircraft.id}-${index + 1}`}
                              style={{
                                width: '100%',
                                height: '114px',
                                borderRadius: '12px',
                                overflow: 'hidden'
                              }}
                            >
                              <img
                                src={img}
                                alt={`Interior ${index + 2}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* All Photos Button */}
                      {previewAircraft.interior_images.length > 0 && (
                        <button
                          onClick={() => setShowPhotoGallery(true)}
                          style={{
                            width: '100%',
                            padding: '12px 20px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '14px',
                            fontWeight: 500,
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
                          All Photos ({previewAircraft.interior_images.length})
                        </button>
                      )}
                    </div>
                  )}

                  {/* 5) Layout Diagrams Section */}
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '16px'
                    }}>
                      {/* Cabin Layout */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '200px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div style={{
                          marginTop: '12px',
                          fontSize: '14px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontWeight: 500
                        }}>
                          Cabin Layout
                        </div>
                      </div>

                      {/* Sleeping Layout */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '200px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M3.27 6.96L12 12.01l8.73-5.05" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 22.08V12" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div style={{
                          marginTop: '12px',
                          fontSize: '14px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontWeight: 500
                        }}>
                          Sleeping Layout
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6) Fixed Select Button at Bottom */}
                <div style={{
                  position: 'sticky',
                  bottom: 0,
                  padding: '24px',
                  backgroundColor: 'rgba(21, 21, 21, 0.95)',
                  backdropFilter: 'blur(24px)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={() => {
                      handleJetSelect({
                        type: "AIRCRAFT_SELECTED",
                        selected_aircraft: {
                          id: previewAircraft.id,
                          name: previewAircraft.name
                        }
                      })
                    }}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      backgroundColor: '#FFFFFF',
                      color: '#0a0a0a',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#FFFFFF'}
                  >
                    Select this aircraft
                  </button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
        externalError={authBlockingError}
      />

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        isOpen={showPhotoGallery}
        images={previewAircraft?.interior_images || []}
        onClose={() => setShowPhotoGallery(false)}
        aircraftName={previewAircraft?.name || ''}
      />
    </>
    )
  }

  // Main Routes
  return (
    <div style={isMobile ? { height: '100dvh', overflow: 'hidden', width: '100%' } : {}}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/chat/session/:session_id" element={<ChatRoute />} />
        <Route path="/my-bookings" element={<MyBookingsRoute />} />
        <Route path="/profile" element={<MyProfileRoute />} />
      </Routes>
    </div>
  )
}
