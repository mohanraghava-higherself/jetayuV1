import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ChatInput({ onSend, disabled }) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  return (
    <div className="glass border-t border-jet-800/50">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={disabled}
            className={`
              w-full bg-jet-900/80 border border-jet-700/50 rounded-full
              px-6 py-4 pr-14
              text-[15px] text-jet-100 placeholder-jet-500
              focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />
          <motion.button
            type="submit"
            disabled={!message.trim() || disabled}
            whileTap={{ scale: 0.95 }}
            className={`
              absolute right-2 p-3 rounded-full
              transition-all duration-200
              ${message.trim() && !disabled
                ? 'bg-gold-500 text-jet-950 hover:bg-gold-400' 
                : 'bg-jet-800 text-jet-500 cursor-not-allowed'
              }
            `}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-5 h-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </motion.button>
        </div>
      </form>
    </div>
  )
}

