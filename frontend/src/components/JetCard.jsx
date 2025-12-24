import { motion } from 'framer-motion'

export default function JetCard({ jet, onSelect, onViewMore, onPreview, onCardClick, onCardSelect, compact = false, selected = false }) {
  // Handle both old format (image) and new format (image_url)
  const imageUrl = jet.image_url || jet.image
  // Format range: keep as nm (nautical miles) for consistency
  const range = jet.range_nm ? `${jet.range_nm.toLocaleString()} nm` : jet.range

  const isRecommended = jet.recommended || false

  // Card click handler - ONLY selection, NO panel opening
  const handleCardClick = () => {
    if (onCardSelect) {
      // Dedicated selection-only handler (preferred)
      onCardSelect(jet)
    } else if (onCardClick) {
      // Fallback for backward compatibility
      onCardClick(jet)
    } else if (onPreview) {
      // Legacy fallback
      onPreview(jet)
    }
  }

  // Handle "View all details" button - selection + opens preview panel
  const handleViewDetails = (e) => {
    e.stopPropagation()
    if (onViewMore) {
      // This handler sets selection AND opens panel
      onViewMore(jet)
    }
  }

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        jet-card backdrop-blur-md border rounded-2xl overflow-hidden
        ${compact && (onCardSelect || onCardClick || onPreview) ? 'cursor-pointer' : ''}
        ${selected 
          ? 'border-jet-700/80' 
          : isRecommended 
            ? 'border-gold-500/30 shadow-lg shadow-gold-500/10' 
            : 'border-jet-800/50'
        }
        transition-colors duration-200 hover:border-jet-700/50
      `}
      style={{
        background: selected 
          ? 'linear-gradient(180deg, #683F49 0%, #4A1E35 100%)'
          : 'rgba(21, 21, 21, 0.6)'
      }}
      onClick={handleCardClick}
    >
      {/* Content */}
      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Aircraft Name - Centered at top */}
        <h3 className={`font-display font-light mb-4 tracking-tight text-center ${compact ? 'text-lg' : 'text-xl'}`} style={{ color: selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(242, 242, 242, 1)' }}>
          {jet.name}
        </h3>
        
        {/* Side-view Aircraft Image */}
        <div className={`relative bg-gradient-to-br from-jet-800 to-jet-900 rounded-lg overflow-hidden mb-4 ${compact ? 'h-32' : 'h-40'}`}>
          <img
            src={imageUrl}
            alt={jet.name}
            className="w-full h-full object-cover opacity-90"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-jet-900/95 to-transparent" />
          
          {/* Recommended Badge */}
          {isRecommended && (
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 bg-gradient-to-r from-rose-900/80 to-purple-900/80 backdrop-blur-sm border border-rose-500/30 rounded-full text-[10px] font-medium text-white uppercase tracking-wider">
                Recommended
              </span>
            </div>
          )}
        </div>
        
        {/* Specs Row - Horizontal */}
        <div className={`flex items-center justify-around gap-4 ${compact ? 'mb-3' : 'mb-4'} text-sm`}>
          <div className="flex flex-col items-center">
            <div className="text-base font-medium" style={{ color: selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(242, 242, 242, 1)' }}>{jet.capacity || 'N/A'}</div>
            <div className="text-xs" style={{ color: selected ? 'rgba(255, 255, 255, 0.6)' : 'rgba(163, 163, 163, 1)' }}>Passengers</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-base font-medium" style={{ color: selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(242, 242, 242, 1)' }}>{range}</div>
            <div className="text-xs" style={{ color: selected ? 'rgba(255, 255, 255, 0.6)' : 'rgba(163, 163, 163, 1)' }}>Max Range</div>
          </div>
          {jet.speed_kph && (
            <div className="flex flex-col items-center">
              <div className="text-base font-medium" style={{ color: selected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(242, 242, 242, 1)' }}>{jet.speed_kph} km/h</div>
              <div className="text-xs" style={{ color: selected ? 'rgba(255, 255, 255, 0.6)' : 'rgba(163, 163, 163, 1)' }}>Top Speed</div>
            </div>
          )}
        </div>

        {/* Description - One line */}
        {jet.description && (
          <p className="text-sm mb-4 leading-relaxed font-light line-clamp-2" style={{ color: selected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(163, 163, 163, 1)' }}>
            {jet.description}
          </p>
        )}

        {/* Actions - Only "View all details" button */}
        {compact && (
          <button
            onClick={handleViewDetails}
            className="w-full mt-3 px-4 py-2.5 bg-jet-800/50 hover:bg-jet-800 border border-jet-700/50 rounded-xl text-sm font-medium text-jet-200 hover:text-jet-100 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            View all details
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  )
}

