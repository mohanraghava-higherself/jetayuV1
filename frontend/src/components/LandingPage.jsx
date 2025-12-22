import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function LandingPage({ onStartChat, onMyBookings, onAuthClick }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center" style={{ marginLeft: '103px' }}>
        {/* Single centered container: Logo + Prompt + Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '32px'
          }}
        >
          {/* JETAYU Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              width: '127px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <h1
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: '30px',
                fontWeight: 700,
                fontStyle: 'normal',
                lineHeight: '100%',
                letterSpacing: '0%',
                textAlign: 'center',
                background: 'linear-gradient(180deg, #7B5159 0%, #2F1E22 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
                padding: 0,
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale'
              }}
            >
              JETAYU
            </h1>
          </motion.div>

          {/* Prompt Text */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '24px',
              fontWeight: 400,
              fontStyle: 'normal',
              lineHeight: '100%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(242, 242, 242, 0.7)',
              margin: 0,
              padding: 0
            }}
          >
            Where would you like to fly?
          </motion.h2>

          {/* Input Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              width: '565px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >

            {/* Input Container with Voice Button */}
            <div style={{ position: 'relative', width: '100%' }}>
          {/* Rectangle Input Container with Gradient Border */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            style={{
              width: '100%',
              height: '68px',
              borderRadius: '24px',
              padding: '1px',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 50%, rgba(255, 255, 255, 0.12) 100%)',
              boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.1)',
              zIndex: 15
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '23px',
                backgroundColor: 'rgba(21, 21, 21, 0.8)', // #151515 at 80% opacity
                backdropFilter: 'blur(24px)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                paddingRight: '70px' // Space for voice button
              }}
            >
              {/* Placeholder Text */}
              <input
                type="text"
                placeholder="New York to London, tomorrow evening..."
                onClick={onStartChat}
                readOnly
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'Outfit, sans-serif', // Using Outfit as similar to Satoshi Variable
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.4)', // #FFFFFF at 40% opacity
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  cursor: 'pointer'
                }}
              />
            </div>
          </motion.div>

          {/* Voice Icon Button with Gradient Border */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStartChat}
            style={{
              position: 'absolute',
              width: '54px',
              height: '36px',
              top: '16px',
              right: '8px',
              borderRadius: '12px',
              padding: '1px',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.24) 100%)',
              border: 'none',
              cursor: 'pointer',
              zIndex: 20
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '11px',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </motion.button>
            </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

