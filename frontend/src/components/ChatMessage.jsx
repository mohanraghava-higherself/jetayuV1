import { motion } from 'framer-motion'
import { forwardRef } from 'react'

const ChatMessage = forwardRef(function ChatMessage({ message, isUser, isNew, requiresAuth, onAuthClick, showBookingCTA, onBookingCTAClick }, ref) {
  return (
    <div
      ref={ref}
      className="flex mb-6"
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%'
      }}
    >
      {isUser ? (
        // User Message Bubble
        <div
          style={{
            maxWidth: '400px',
            padding: '12px 20px',
            borderRadius: '24px 24px 0px 24px',
            background: 'linear-gradient(180deg, #683F49 0%, #4A1E35 100%)',
            position: 'relative',
            color: 'white',
            boxShadow: '0px 2px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '24px 24px 0px 24px',
              background: 'linear-gradient(180deg, #472E33 0%, #2F1E22 100%)',
              opacity: 0.5,
              pointerEvents: 'none'
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{
              fontSize: '15px',
              lineHeight: '1.6',
              fontWeight: 300,
              color: '#FFFFFF',
              margin: 0
            }}>
              {message}
            </p>
          </div>
        </div>
      ) : (
        // Assistant Message Bubble
        <div
          className="px-5 py-4 rounded-2xl backdrop-blur-md"
          style={{
            maxWidth: '85%',
            backgroundColor: 'rgba(31, 31, 31, 0.4)',
            border: '1px solid rgba(115, 115, 115, 0.3)',
            borderRadius: '4px 24px 24px 24px',
            boxShadow: '0px 2px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gold-500/80" />
            <span className="text-[11px] font-medium text-gold-500/70 uppercase tracking-wider">
              Concierge
            </span>
          </div>
          <p style={{
            fontSize: '15px',
            lineHeight: '1.6',
            fontWeight: 300,
            color: '#FAFAFA',
            margin: 0,
            marginBottom: requiresAuth ? '16px' : 0
          }}>
            {message}
          </p>
          {requiresAuth && onAuthClick && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAuthClick}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                backgroundColor: '#FFFFFF',
                color: '#0a0a0a',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s, border-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#FFFFFF'
              }}
            >
              <span>Login to Jetayu</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.button>
          )}
          {showBookingCTA && onBookingCTAClick && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBookingCTAClick}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#FAFAFA',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 400,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent'
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              <span>View booking status</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.button>
          )}
        </div>
      )}
    </div>
  )
})

export default ChatMessage

