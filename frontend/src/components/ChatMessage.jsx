import { motion } from 'framer-motion'
import { forwardRef } from 'react'

const ChatMessage = forwardRef(function ChatMessage({ message, isUser, isNew }, ref) {
  return (
    <motion.div
      ref={ref}
      initial={isNew ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex mb-6"
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%'
      }}
    >
      {isUser ? (
        // User Message Bubble
        <motion.div
          initial={isNew ? { scale: 0.95 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
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
        </motion.div>
      ) : (
        // Assistant Message Bubble
        <motion.div
          initial={isNew ? { scale: 0.95 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
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
            margin: 0
          }}>
            {message}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
})

export default ChatMessage

