import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import LandingPage from './components/LandingPage'
import AuthModal from './components/AuthModal'
import MyBookings from './components/MyBookings'
import Header from './components/Header'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import TypingIndicator from './components/TypingIndicator'
import JetSuggestions from './components/JetSuggestions'
import BookingConfirmed from './components/BookingConfirmed'

// API URL from environment variable, fallback to proxy for local dev
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

// Views: 'landing' | 'chat' | 'bookings'
export default function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingBookingSessionId, setPendingBookingSessionId] = useState(null)
  
  // Chat state
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showJets, setShowJets] = useState(false)
  const [aircraft, setAircraft] = useState([])
  const [leadState, setLeadState] = useState(null)
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const messagesEndRef = useRef(null)
  const hasInitialized = useRef(false)

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      
      // If user just logged in and there's a pending booking, retry it
      if (session?.user && pendingBookingSessionId) {
        retryBookingConfirmation(pendingBookingSessionId)
        setPendingBookingSessionId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [pendingBookingSessionId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, showJets])

  const handleStartChat = () => {
    setView('chat')
    if (!hasInitialized.current) {
      hasInitialized.current = true
      startSession()
    }
  }

  const handleMyBookings = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    setView('bookings')
  }

  const handleAuthSuccess = async () => {
    setShowAuthModal(false)
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
    // Don't send any confirmation message - backend will handle the state
  }

  const startSession = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      
      setSessionId(data.session_id)
      setMessages([{
        id: Date.now(),
        role: 'assistant',
        content: data.assistant_message,
        isNew: true,
      }])
    } catch (error) {
      console.error('Failed to start session:', error)
      setMessages([{
        id: Date.now(),
        role: 'assistant',
        content: "Good evening. Welcome to Jetayu. I'm here to assist with your private aviation needs. How may I help you today?",
        isNew: true,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content) => {
    setShowJets(false)
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content,
      isNew: true,
    }
    setMessages(prev => [...prev.map(m => ({ ...m, isNew: false })), userMessage])
    setIsLoading(true)

    let currentSessionId = sessionId
    if (!currentSessionId) {
      try {
        const startResponse = await fetch(`${API_BASE}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const startData = await startResponse.json()
        currentSessionId = startData.session_id
        setSessionId(currentSessionId)
      } catch (e) {
        console.error('Failed to start session:', e)
      }
    }

    try {
      // Get auth token if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {
        'Content-Type': 'application/json',
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: currentSessionId,
          message: content,
        }),
      })
      const data = await response.json()

      setMessages(prev => [
        ...prev.map(m => ({ ...m, isNew: false })),
        {
          id: Date.now(),
          role: 'assistant',
          content: data.assistant_message,
          isNew: true,
        }
      ])

      setLeadState(data.lead_state)

      if (data.show_aircraft && data.aircraft && data.aircraft.length > 0) {
        setAircraft(data.aircraft)
        setTimeout(() => setShowJets(true), 800)
      }

      // Handle auth requirement for booking
      if (data.requires_auth) {
        setPendingBookingSessionId(currentSessionId)
        setShowAuthModal(true)
      }

      if (data.booking_confirmed) {
        setBookingConfirmed(true)
        setTimeout(() => setBookingConfirmed(false), 5000)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => [
        ...prev.map(m => ({ ...m, isNew: false })),
        {
          id: Date.now(),
          role: 'assistant',
          content: "Of course. I'm taking note of that. Could you tell me a bit more about your travel plans?",
          isNew: true,
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

  const handleJetSelect = (message) => {
    sendMessage(message)
    setShowJets(false)
  }

  // Render based on current view
  if (view === 'landing') {
    return (
      <>
        <LandingPage 
          onStartChat={handleStartChat}
          onMyBookings={handleMyBookings}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={handleAuthClose}
          onSuccess={handleAuthSuccess}
        />
      </>
    )
  }

  if (view === 'bookings') {
    return (
      <>
        <MyBookings onBack={() => setView('landing')} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={handleAuthClose}
          onSuccess={handleAuthSuccess}
        />
      </>
    )
  }

  // Chat view
  return (
    <>
      <div className="h-full flex flex-col bg-gradient-luxury">
        <Header 
          user={user}
          onAuthClick={() => setShowAuthModal(true)}
          onMyBookings={handleMyBookings}
        />
        
        <main className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-gold-500/3 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 space-y-2">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message.content}
                    isUser={message.role === 'user'}
                    isNew={message.isNew}
                  />
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
                  <JetSuggestions aircraft={aircraft} onSelect={handleJetSelect} />
                )}
              </AnimatePresence>
            </div>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  )
}
