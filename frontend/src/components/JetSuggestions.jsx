import { motion } from 'framer-motion'
import { useRef, useEffect } from 'react'
import JetCard from './JetCard'

export default function JetSuggestions({ aircraft = [], onSelect, onCardClick, onPreview, navigationIntent = null }) {
  const scrollContainerRef = useRef(null)

  const handleViewMore = (jet) => {
    // Open preview panel directly (NO chat message - prevents intent detection and re-pull)
    if (onPreview) {
      onPreview(jet)
    }
  }

  // Explicit selection - user clicked "Select this aircraft" button
  const handleSelect = (jet) => {
    // Send structured payload to backend (bypasses NLP entirely)
    if (onSelect) {
      onSelect({
        type: "AIRCRAFT_SELECTED",
        selected_aircraft: {
          id: jet.id,
          name: jet.name
        }
      })
    }
  }

  // Preview/interaction - user clicked card (not the Select button)
  const handlePreview = (jet) => {
    // Open preview panel without selecting
    if (onPreview) {
      onPreview(jet)
    }
  }

  if (!aircraft || aircraft.length === 0) {
    return null
  }

  const isSingleAircraft = aircraft.length === 1
  const isMultipleAircraft = aircraft.length > 1

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
          {(() => {
            switch (navigationIntent) {
              case 'AIRCRAFT_BIGGER':
                return 'Larger Aircraft Options'
              case 'AIRCRAFT_SMALLER':
                return 'Smaller Aircraft Options'
              case 'AIRCRAFT_RECOMMENDED':
                return 'Recommended Aircraft'
              case 'AIRCRAFT_PREVIOUS':
                return 'Previous Aircraft Options'
              default:
                return 'Recommended Aircraft'
            }
          })()}
        </h3>
      </div>
      
      {/* Single aircraft: no scroll needed */}
      {isSingleAircraft ? (
        <div className="flex">
          <motion.div
            key={aircraft[0].id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <JetCard
              jet={aircraft[0]}
              onSelect={handleSelect}
              onViewMore={handleViewMore}
              onPreview={handlePreview}
              compact={true}
            />
          </motion.div>
        </div>
      ) : (
        /* Multiple aircraft: horizontal scroll/carousel */
        <div className="relative">
          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto overflow-y-visible pb-2 hide-scrollbar"
            style={{
              scrollSnapType: 'x mandatory',
              scrollPaddingLeft: '0',
              scrollPaddingRight: '0',
            }}
          >
            {aircraft.map((jet, index) => (
              <motion.div
                key={jet.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex-shrink-0"
                style={{
                  width: 'calc(100% / 2.5)',
                  minWidth: '280px',
                  maxWidth: '320px',
                  scrollSnapAlign: 'start',
                }}
              >
                <JetCard
                  jet={jet}
                  onSelect={handleSelect}
                  onViewMore={handleViewMore}
                  onPreview={handlePreview}
                  compact={true}
                />
              </motion.div>
            ))}
          </div>
          
          {/* Scroll indicator hint (only show if scrollable) */}
          {aircraft.length > 2 && (
            <div className="flex justify-center mt-2">
              <div className="flex gap-1.5">
                {aircraft.map((jet, index) => (
                  <div
                    key={`indicator-${jet.id}-${index}`}
                    className="w-1.5 h-1.5 rounded-full bg-jet-700/50"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

