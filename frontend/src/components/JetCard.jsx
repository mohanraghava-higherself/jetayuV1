import { motion } from 'framer-motion'

export default function JetCard({ jet, onSelect, onViewMore, onPreview, compact = false }) {
  // Handle both old format (image) and new format (image_url)
  const imageUrl = jet.image_url || jet.image
  // Format range: keep as nm (nautical miles) for consistency
  const range = jet.range_nm ? `${jet.range_nm.toLocaleString()} nm` : jet.range

  const isRecommended = jet.recommended || false

  // In compact mode, clicking card opens preview (not selection)
  // Selection happens only via "Select this aircraft" button in panel
  const handleCardClick = () => {
    if (compact && onPreview) {
      onPreview(jet)
    } else if (!compact && onPreview) {
      onPreview(jet)
    }
  }

  // Handle "View all details" button - opens preview panel (no chat message)
  const handleViewDetails = (e) => {
    e.stopPropagation()
    if (onViewMore) {
      onViewMore(jet)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        jet-card bg-jet-900/60 backdrop-blur-md border rounded-2xl overflow-hidden
        ${compact && onPreview ? 'cursor-pointer' : ''}
        ${isRecommended ? 'border-gold-500/30 shadow-lg shadow-gold-500/10' : 'border-jet-800/50'}
        transition-colors duration-200 hover:border-jet-700/50
      `}
      onClick={handleCardClick}
    >
      {/* Content */}
      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Aircraft Name - Centered at top */}
        <h3 className={`font-display font-light text-jet-100 mb-4 tracking-tight text-center ${compact ? 'text-lg' : 'text-xl'}`}>
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
            <div className="text-base font-medium text-jet-100">{jet.capacity || 'N/A'}</div>
            <div className="text-xs text-jet-500">Passengers</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-base font-medium text-jet-100">{range}</div>
            <div className="text-xs text-jet-500">Max Range</div>
          </div>
          {jet.speed_kph && (
            <div className="flex flex-col items-center">
              <div className="text-base font-medium text-jet-100">{jet.speed_kph} km/h</div>
              <div className="text-xs text-jet-500">Top Speed</div>
            </div>
          )}
        </div>

        {/* Description - One line */}
        {jet.description && (
          <p className="text-sm text-jet-400 mb-4 leading-relaxed font-light line-clamp-2">
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

