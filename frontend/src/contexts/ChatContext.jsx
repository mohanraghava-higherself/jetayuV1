import { createContext, useContext, useState, useRef } from 'react'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  // Chat state - lives ONLY in memory (no localStorage)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showJets, setShowJets] = useState(false)
  const [aircraft, setAircraft] = useState([])
  const [aircraftNavigationIntent, setAircraftNavigationIntent] = useState(null)
  const [leadState, setLeadState] = useState(null)
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [previewAircraft, setPreviewAircraft] = useState(null)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  
  // Chat session flag - true once chat has started (sessionId exists or first message sent)
  const [chatStarted, setChatStarted] = useState(false)
  
  // Refs for chat management
  const hasInitialized = useRef(false)
  const prevRoutePaxRef = useRef({ route_from: null, route_to: null, pax: null })
  const messageIdCounter = useRef(0)
  const prevMessageCountRef = useRef(0)

  const resetChat = () => {
    setSessionId(null)
    setMessages([])
    setShowJets(false)
    setAircraft([])
    setAircraftNavigationIntent(null)
    setLeadState(null)
    setBookingConfirmed(false)
    setSelectedAircraft(null)
    setPreviewAircraft(null)
    setShowPhotoGallery(false)
    setChatStarted(false) // Reset chatStarted flag
    hasInitialized.current = false
    prevRoutePaxRef.current = { route_from: null, route_to: null, pax: null }
    prevMessageCountRef.current = 0
    messageIdCounter.current = 0
  }

  const value = {
    // State
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
    // Refs
    hasInitialized,
    prevRoutePaxRef,
    messageIdCounter,
    prevMessageCountRef,
    // Actions
    resetChat,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
