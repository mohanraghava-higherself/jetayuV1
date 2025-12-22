import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ChatInput({ onSend, disabled, placeholder }) {
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
      <form onSubmit={handleSubmit} className="py-6" style={{ width: '100%', paddingLeft: '24px', paddingRight: '24px' }}>
        <div className="relative" style={{ width: '100%' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
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
                padding: '16px 16px',
                paddingRight: '70px'
              }}
            >
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={placeholder || ''}
                disabled={disabled}
                style={{
                  width: '100%',
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
                  margin: 0
                }}
              />
            </div>
          </motion.div>
          <motion.button
            type="submit"
            disabled={!message.trim() || disabled}
            whileHover={!disabled && message.trim() ? { scale: 1.05 } : {}}
            whileTap={!disabled && message.trim() ? { scale: 0.95 } : {}}
            style={{
              position: 'absolute',
              width: '54px',
              height: '36px',
              top: '50%',
              right: '8px',
              transform: 'translateY(-50%)',
              borderRadius: '12px',
              padding: '1px',
              background: message.trim() && !disabled 
                ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.24) 100%)'
                : 'transparent',
              border: 'none',
              cursor: message.trim() && !disabled ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: message.trim() && !disabled ? 1 : 0.5
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '11px',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </motion.button>
        </div>
      </form>
    </div>
  )
}

