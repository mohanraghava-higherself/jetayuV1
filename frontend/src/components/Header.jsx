import { motion } from 'framer-motion'

export default function Header() {
  return (
    <header className="glass border-b border-jet-800/50 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center">
            <svg 
              className="w-5 h-5 text-jet-950" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M3.64 14.26l2.86.95 4.02-4.02-8-4 1.41-1.41 9.2 2.96 3.95-3.95a1.5 1.5 0 1 1 2.12 2.12l-3.95 3.95 2.96 9.2-1.41 1.41-4-8-4.02 4.02.95 2.86-1.41 1.41-1.91-3.82-3.82-1.91 1.41-1.41z"/>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-jet-100 tracking-wide">
              Jetayu
            </h1>
            <p className="text-[10px] text-jet-500 uppercase tracking-[0.2em]">
              Private Aviation
            </p>
          </div>
        </motion.div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-jet-500">Online</span>
        </div>
      </div>
    </header>
  )
}

