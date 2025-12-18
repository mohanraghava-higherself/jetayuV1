import { motion } from 'framer-motion'
import JetCard from './JetCard'

export default function JetSuggestions({ aircraft = [], onSelect }) {
  const handleViewMore = (jet) => {
    // For V1, send a message asking for more details
    onSelect(`Tell me more about the ${jet.name}`)
  }

  const handleSelect = (jet) => {
    onSelect(`I'm interested in the ${jet.name}`)
  }

  if (!aircraft || aircraft.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-1 h-4 bg-gold-500 rounded-full" />
        <h3 className="text-sm font-medium text-jet-400">
          Recommended Aircraft
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {aircraft.map((jet, index) => (
          <motion.div
            key={jet.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <JetCard
              jet={jet}
              onSelect={handleSelect}
              onViewMore={handleViewMore}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

