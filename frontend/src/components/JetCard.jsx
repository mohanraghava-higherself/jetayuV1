import { motion } from 'framer-motion'

// Format price to readable string
const formatPrice = (price) => {
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`
  }
  return `$${price.toLocaleString()}`
}

export default function JetCard({ jet, onSelect, onViewMore, compact = false }) {
  // Handle both old format (image) and new format (image_url)
  const imageUrl = jet.image_url || jet.image
  const range = jet.range_nm ? `${jet.range_nm.toLocaleString()} nm` : jet.range

  const isRecommended = jet.recommended || false

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        jet-card bg-jet-900/60 backdrop-blur-md border rounded-2xl overflow-hidden
        ${compact ? 'cursor-pointer' : ''}
        ${isRecommended ? 'border-gold-500/30 shadow-lg shadow-gold-500/10' : 'border-jet-800/50'}
        transition-all duration-300 hover:border-jet-700/50
      `}
      onClick={compact ? () => onSelect(jet) : undefined}
    >
      {/* Jet Image */}
      <div className={`relative bg-gradient-to-br from-jet-800 to-jet-900 ${compact ? 'h-32' : 'h-40'}`}>
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

      {/* Content */}
      <div className={compact ? 'p-4' : 'p-5'}>
        <h3 className={`font-display font-light text-jet-100 mb-3 tracking-tight ${compact ? 'text-lg' : 'text-xl'}`}>
          {jet.name}
        </h3>
        
        {/* Specs Row */}
        <div className={`flex items-center gap-5 ${compact ? 'mb-3' : 'mb-4'} text-sm`}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-jet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <div>
              <div className="text-base font-medium text-jet-100">{jet.capacity || 'N/A'}</div>
              <div className="text-xs text-jet-500">Passengers</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-jet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <div>
              <div className="text-base font-medium text-jet-100">{range}</div>
              <div className="text-xs text-jet-500">Max Range</div>
            </div>
          </div>
          {jet.speed_kph && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-jet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-base font-medium text-jet-100">{jet.speed_kph} km/h</div>
                <div className="text-xs text-jet-500">Top Speed</div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {jet.description && !compact && (
          <p className="text-sm text-jet-400 mb-4 leading-relaxed font-light">
            {jet.description}
          </p>
        )}

        {/* Actions */}
        {!compact && (
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onViewMore(jet)
              }}
              className="flex-1 px-4 py-2.5 bg-jet-800/50 hover:bg-jet-800 border border-jet-700/50 rounded-xl text-sm font-medium text-jet-200 hover:text-jet-100 transition-all duration-200 flex items-center justify-center gap-2"
            >
              View all details
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect(jet)
              }}
              className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-jet-950 rounded-xl text-sm font-medium transition-all duration-200"
            >
              View details
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

