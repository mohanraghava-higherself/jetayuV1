import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ChatInput({ onSend, disabled, placeholder, isMobile = false }) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', padding: isMobile ? '0' : '24px' }}>
        <div className="relative" style={{ width: '100%' }}>
          <div
            style={{
              width: '100%',
              height: '68px',
              borderRadius: '24px',
              padding: '1px',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 50%, rgba(255, 255, 255, 0.12) 100%)',
              boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '23px',
                backgroundColor: 'rgba(21, 21, 21, 0.8)',
                backdropFilter: 'blur(24px)',
                display: 'flex',
                alignItems: 'center',
                padding: '16px',
                gap: '12px'
              }}
            >
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={placeholder || ''}
                disabled={disabled}
                style={{
                  flex: '1 1 auto',
                  height: 'auto',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: disabled ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                  lineHeight: '1',
                  letterSpacing: '0%',
                  cursor: disabled ? 'not-allowed' : 'text',
                  padding: 0,
                  margin: 0,
                  minWidth: 0
                }}
              />
              {/* Outer wrapper for gradient border */}
              <motion.div
                whileHover={!disabled && message.trim() ? { scale: 1.05 } : {}}
                whileTap={!disabled && message.trim() ? { scale: 0.95 } : {}}
                style={{
                  flexShrink: 0,
                  width: '36px',
                  height: '36px',
                  padding: '1px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(143.13deg, rgba(255, 255, 255, 0.24) 14.43%, rgba(255, 255, 255, 0.1) 49.78%, rgba(255, 255, 255, 0.24) 85.12%)'
                }}
              >
                {/* Inner button - Send icon on mobile, Mic icon on desktop */}
                <motion.button
                  type="submit"
                  disabled={!message.trim() || disabled}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'linear-gradient(180deg, #472E33 0%, #2F1E22 100%)',
                    cursor: message.trim() && !disabled ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    margin: 0,
                    outline: 'none',
                    boxShadow: 'none',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  {isMobile ? (
                    <svg 
                      className="w-5 h-5 text-white" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                      style={{
                        opacity: (!message.trim() || disabled) ? 0.5 : 1
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  ) : (
                    <svg 
                      className="w-5 h-5 text-white" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                      style={{
                        opacity: (!message.trim() || disabled) ? 0.5 : 1
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

