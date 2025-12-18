import { motion } from 'framer-motion'

export default function BookingConfirmed() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto max-w-md mb-6"
    >
      <div className="bg-gradient-to-r from-emerald-900/80 to-emerald-800/80 border border-emerald-500/30 rounded-xl p-6 text-center backdrop-blur-sm">
        {/* Checkmark icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <svg 
            className="w-8 h-8 text-emerald-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        <h3 className="font-display text-lg font-semibold text-emerald-100 mb-2">
          Booking Request Confirmed
        </h3>
        <p className="text-sm text-emerald-300/80">
          Our team has been notified and will reach out to you shortly.
        </p>

        {/* Subtle shine effect */}
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ delay: 0.6, duration: 1, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
        />
      </div>
    </motion.div>
  )
}

