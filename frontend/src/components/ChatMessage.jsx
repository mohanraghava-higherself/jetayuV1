import { motion } from 'framer-motion'

export default function ChatMessage({ message, isUser, isNew }) {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`
          max-w-[85%] md:max-w-[70%] px-5 py-3.5 rounded-2xl
          ${isUser 
            ? 'bg-gradient-to-br from-jet-800 to-jet-900 text-jet-100 rounded-br-md' 
            : 'bg-jet-800/60 border border-jet-700/50 text-jet-200 rounded-bl-md'
          }
        `}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />
            <span className="text-xs font-medium text-gold-500/80 uppercase tracking-wider">
              Concierge
            </span>
          </div>
        )}
        <p className="text-[15px] leading-relaxed font-light">
          {message}
        </p>
      </div>
    </motion.div>
  )
}

