import { motion } from 'framer-motion'

// Format price to readable string
const formatPrice = (price) => {
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`
  }
  return `$${price.toLocaleString()}`
}

export default function JetCard({ jet, onSelect, onViewMore }) {
  // Handle both old format (image) and new format (image_url)
  const imageUrl = jet.image_url || jet.image
  const range = jet.range_nm ? `${jet.range_nm.toLocaleString()} nm` : jet.range

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="jet-card bg-jet-900/80 border border-jet-700/50 rounded-xl overflow-hidden"
    >
      {/* Jet Image */}
      <div className="relative h-32 bg-gradient-to-br from-jet-800 to-jet-900">
        <img
          src={imageUrl}
          alt={jet.name}
          className="w-full h-full object-cover opacity-90"
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-jet-900/90 to-transparent" />
        
        {/* Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 bg-gold-500/20 border border-gold-500/30 rounded-full text-[10px] font-medium text-gold-400 uppercase tracking-wider">
            {jet.category}
          </span>
        </div>

        {/* Manufacturer badge */}
        {jet.manufacturer && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-jet-900/70 rounded text-[9px] text-jet-300 uppercase tracking-wider">
              {jet.manufacturer}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-display text-lg font-medium text-jet-100 mb-1">
          {jet.name}
        </h3>
        
        {/* Specs Row */}
        <div className="flex items-center gap-4 mb-2 text-xs text-jet-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span>{jet.capacity} pax</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <span>{range}</span>
          </div>
          {jet.speed_kph && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{jet.speed_kph} km/h</span>
            </div>
          )}
        </div>

        {/* Pricing */}
        {jet.pricing && (
          <div className="mb-3 py-2 px-3 bg-jet-800/50 rounded-lg border border-jet-700/30">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-jet-500">Est. Price</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gold-400">
                  {formatPrice(jet.pricing.estimate_low)} – {formatPrice(jet.pricing.estimate_high)}
                </span>
                <span className="ml-1 text-[10px] text-jet-500">{jet.pricing.currency}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onViewMore(jet)}
            className="flex-1 px-3 py-2 border border-jet-600 rounded-lg text-xs font-medium text-jet-300 hover:bg-jet-800 hover:text-jet-100 transition-colors"
          >
            Details
          </button>
          <button
            onClick={() => onSelect(jet)}
            className="flex-1 px-3 py-2 bg-gold-500 rounded-lg text-xs font-medium text-jet-950 hover:bg-gold-400 transition-colors"
          >
            Select
          </button>
        </div>
      </div>
    </motion.div>
  )
}

