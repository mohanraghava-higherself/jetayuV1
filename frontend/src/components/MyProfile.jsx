import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MyProfile({ onBack, user, onAuthClick, onMyBookings, onMyProfile, onLogout }) {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setProfileData({
        name: data.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: data.email || user.email || '',
        phone: data.phone || user.user_metadata?.phone || ''
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Fallback to user metadata
      setProfileData({
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        phone: user.user_metadata?.phone || ''
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Update profile table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.name,
          phone: profileData.phone || null
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Also update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          phone: profileData.phone || null
        }
      })

      if (metadataError) throw metadataError

      setIsEditing(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    if (onLogout) {
      onLogout()
    }
    navigate('/')
  }

  return (
    <div className="flex-1 ml-16 flex flex-col min-h-screen">
      <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-2xl mx-auto px-8 py-12">
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                textAlign: 'center',
                fontSize: '32px',
                fontWeight: 400,
                color: '#FFFFFF',
                marginBottom: '48px',
                fontFamily: 'Cormorant Garamond, serif'
              }}
            >
              My Profile
            </motion.h1>

            {/* Profile Picture and Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '48px'
              }}
            >
              {/* Profile Picture */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '60px',
                  backgroundColor: '#472E33',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px'
                }}
              >
                <svg 
                  width="60" 
                  height="60" 
                  viewBox="0 0 14 16" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M7.0001 8.23873C8.99799 8.23873 10.6195 6.61725 10.6195 4.61936C10.6195 2.62147 8.99799 1 7.0001 1C5.00221 1 3.38074 2.62147 3.38074 4.61936C3.38074 6.61725 5.00221 8.23873 7.0001 8.23873Z" 
                    stroke="white" 
                    strokeOpacity="0.8" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path 
                    d="M13.0002 14.371C12.1505 12.9142 9.77623 11.8583 7.00018 11.8583C4.22413 11.8583 1.84983 12.9142 1.00018 14.371" 
                    stroke="white" 
                    strokeOpacity="0.8" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>

              {/* Name */}
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  style={{
                    fontSize: '24px',
                    fontWeight: 400,
                    color: '#FFFFFF',
                    marginBottom: '12px',
                    fontFamily: 'Outfit, sans-serif',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    width: '100%',
                    maxWidth: '300px',
                    textAlign: 'center'
                  }}
                />
              ) : (
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 400,
                    color: '#FFFFFF',
                    marginBottom: '12px',
                    fontFamily: 'Outfit, sans-serif'
                  }}
                >
                  {profileData.name}
                </h2>
              )}

              {/* Email */}
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '8px',
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                {profileData.email}
              </p>

              {/* Phone */}
              {isEditing ? (
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="Phone number"
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginBottom: '24px',
                    fontFamily: 'Outfit, sans-serif',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    width: '100%',
                    maxWidth: '300px',
                    textAlign: 'center'
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginBottom: '24px',
                    fontFamily: 'Outfit, sans-serif'
                  }}
                >
                  {profileData.phone || 'No phone number'}
                </p>
              )}

              {/* Edit/Save Button */}
              {isEditing ? (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '10px 24px',
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#0a0a0a',
                      fontSize: '14px',
                      fontFamily: 'Outfit, sans-serif',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setIsEditing(false)
                      fetchProfile() // Reset to saved values
                    }}
                    style={{
                      padding: '10px 24px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontFamily: 'Outfit, sans-serif',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontFamily: 'Outfit, sans-serif',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </motion.button>
              )}
            </motion.div>

            {/* Preferences Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{
                marginBottom: '32px'
              }}
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left'
                }}
              >
                <span>Billing Info</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left'
                }}
              >
                <span>Flight Preferences</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left'
                }}
              >
                <span>Service Preferences</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.button>
            </motion.div>

            {/* Sign Out Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '16px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '16px',
                fontFamily: 'Outfit, sans-serif',
                cursor: 'pointer',
                marginBottom: '48px'
              }}
            >
              Sign Out
            </motion.button>

            {/* Footer Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <a 
                href="#" 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.5)',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.8)'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a 
                href="#" 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.5)',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.8)'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
              >
                Terms & Conditions
              </a>
            </motion.div>
          </div>
        </main>
      </div>
  )
}

