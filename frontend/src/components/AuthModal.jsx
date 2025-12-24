import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}` 
  : '/api'

async function checkProviderConflict(email, attemptedProvider) {
  try {
    const response = await fetch(`${API_BASE}/auth/provider-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        attempted_provider: attemptedProvider,
      }),
    })

    if (!response.ok) {
      console.warn('Provider check failed with status', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.warn('Provider check failed:', error)
    return null
  }
}

export default function AuthModal({ isOpen, onClose, onSuccess, externalError }) {
  // Unified modal state: 'login' | 'signup' | 'forgot_password' | 'reset_password' | 'reset_success'
  const [modalState, setModalState] = useState('login')
  const [mode, setMode] = useState('oauth') // 'oauth' or 'email'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Detect PASSWORD_RECOVERY event from Supabase
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured) return

    const checkPasswordRecovery = async () => {
      // Check URL hash for recovery token (Supabase adds this when redirecting from email)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const type = hashParams.get('type')
      
      if (type === 'recovery') {
        setModalState('reset_password')
        // Clear the hash to clean up URL
        window.history.replaceState(null, '', window.location.pathname)
        return
      }

      // Also check session for recovery state
      const { data: { session } } = await supabase.auth.getSession()
      
      // Check if URL contains recovery token in hash
      if (window.location.hash.includes('type=recovery')) {
        setModalState('reset_password')
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    checkPasswordRecovery()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && isOpen) {
        setModalState('reset_password')
      }
    })

    return () => subscription.unsubscribe()
  }, [isOpen])

  const handleClose = () => {
    setError(null)
    setModalState('login')
    setMode('oauth')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setPhone('')
    onClose?.()
  }

  useEffect(() => {
    if (externalError) {
      setError(externalError)
    }
  }, [externalError])

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
      setLoading(false)
      return
    }

    try {
      const providerCheck = await checkProviderConflict(email, 'email')
      if (providerCheck?.conflict && providerCheck.existing_provider === 'google') {
        setError('This account was created using Google. Please sign in with Google.')
        setLoading(false)
        return
      }

      if (modalState === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone || null,
            },
          },
        })
        if (error) {
          if (error.message.includes('Invalid API key')) {
            throw new Error('Invalid Supabase API key. Please check your .env file and restart the dev server.')
          }
          throw error
        }
        if (data.user) {
          onSuccess?.(data.user)
          onClose()
        }
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          if (error.message.includes('Invalid API key')) {
            throw new Error('Invalid Supabase API key. Please check your .env file and restart the dev server.')
          }
          throw error
        }
        if (data.user) {
          onSuccess?.(data.user)
          onClose()
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
      console.error('Auth error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider) => {
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      })
      if (error) {
        if (error.message.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key. Please check your .env file and restart the dev server.')
        }
        throw error
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
      console.error('OAuth error:', err)
      setLoading(false)
    }
  }

  const handleResetPasswordRequest = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
      setLoading(false)
      return
    }

    if (!email) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    try {
      // Check if email belongs to a Google user
      const providerCheck = await checkProviderConflict(email, 'email')
      if (providerCheck?.conflict && providerCheck.existing_provider === 'google') {
        setError('This account was created using Google. Please sign in with Google.')
        setLoading(false)
        return
      }

      // Send reset password email - redirect back to app root
      // The PASSWORD_RECOVERY event will be detected and modal will switch to reset_password state
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })

      if (error) {
        if (error.message.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key. Please check your .env file and restart the dev server.')
        }
        throw error
      }

      // Success - switch to reset_success state
      setModalState('reset_success')
    } catch (err) {
      setError(err.message || 'An error occurred')
      console.error('Reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
      setLoading(false)
      return
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        if (error.message.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key. Please check your .env file and restart the dev server.')
        }
        throw error
      }

      // Success - user is now logged in automatically
      // Close modal and trigger success callback
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'An error occurred while resetting your password')
      console.error('Reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  // Determine which view to show based on modalState
  const showOAuth = modalState === 'login' || modalState === 'signup'
  const showEmailForm = (modalState === 'login' || modalState === 'signup') && mode === 'email'
  const showForgotPassword = modalState === 'forgot_password'
  const showResetPassword = modalState === 'reset_password'
  const showResetSuccess = modalState === 'reset_success'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-jet-950/90 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-jet-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-10"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-jet-800/50 hover:bg-jet-800 text-jet-400 hover:text-jet-200 transition-all duration-200 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-10 text-center">
            {/* Jetayu Logo Icon - Same as Sidebar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-6 flex justify-center"
            >
              <svg 
                className="transition-all duration-200" 
                viewBox="0 0 35 35" 
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  width: '25px',
                  height: '25px'
                }}
              >
                <path d="M33.9733 17.6613L34.0623 17.6386C34.1463 17.6024 34.2095 17.5285 34.2294 17.4383L34.2322 17.4245V17.419L34.237 17.3879V17.3478L34.2363 17.3458C34.2361 17.3436 34.2361 17.3408 34.2357 17.3368C34.2354 17.3348 34.2346 17.3324 34.2343 17.3299C34.2341 17.328 34.2338 17.3259 34.2336 17.3237C34.2332 17.3207 34.2324 17.3183 34.2322 17.3168L34.2336 17.3223C34.2325 17.3167 34.232 17.3129 34.2315 17.3106L34.2301 17.3092L34.2281 17.3002C34.1977 17.1807 34.0941 17.0917 33.9705 17.0813L33.9505 17.0806L33.9304 17.0772C29.1915 16.2868 25.5563 14.4902 22.8847 11.731C20.2237 8.98289 18.5566 5.31875 17.6739 0.849603C17.6661 0.821409 17.6602 0.79185 17.6573 0.761215C17.6445 0.62366 17.5351 0.514374 17.397 0.502265L17.3963 0.502955C17.3937 0.502794 17.3917 0.502347 17.3901 0.502265C17.3876 0.502146 17.3878 0.501574 17.3894 0.501574H17.388L17.3797 0.502955L17.3583 0.503646H17.3542C17.2133 0.509297 17.0961 0.619108 17.0814 0.761215L17.0787 0.783312L17.0745 0.805409C16.196 5.2942 14.5268 8.97356 11.8568 11.731C9.18369 14.4918 5.54583 16.2885 0.803458 17.0778L0.784123 17.082L0.764097 17.0827C0.638896 17.0934 0.534961 17.1852 0.507909 17.3071C0.507123 17.3106 0.505319 17.3139 0.504457 17.3175L0.501695 17.3423C0.501273 17.3463 0.50024 17.3506 0.499623 17.3554H0.501004V17.3637L0.500313 17.3741V17.3824L0.501695 17.3907C0.502005 17.3959 0.500862 17.3989 0.501004 17.401C0.501294 17.4035 0.502527 17.4043 0.502385 17.4024V17.4093L0.503766 17.4162C0.524133 17.5484 0.633252 17.6505 0.76686 17.6613L0.788266 17.6634L0.808982 17.6662C5.54808 18.4554 9.18414 20.2519 11.8561 23.0109C14.525 25.7667 16.194 29.444 17.0724 33.9296L17.0773 33.9538L17.0793 33.978C17.0926 34.1175 17.2025 34.2256 17.339 34.2376L17.3493 34.2383L17.359 34.2397L17.3597 34.2404H17.3804L17.4329 34.2335C17.5527 34.2065 17.6434 34.1068 17.6566 33.9821L17.6594 33.96L17.6635 33.9393C18.5437 29.4502 20.2128 25.7706 22.8819 23.013C25.5542 20.2521 29.191 18.4549 33.9332 17.6655L33.9339 17.6648C33.9466 17.6627 33.9597 17.6645 33.9726 17.6634M33.9733 17.6613L33.9726 17.6634M33.9733 17.6613L33.9726 17.6634M33.9733 17.6613C33.9804 17.6607 33.9876 17.6624 33.9947 17.662C33.9872 17.6623 33.98 17.6628 33.9726 17.6634M34.2847 17.7366L34.3696 17.805C34.3416 17.777 34.3103 17.7539 34.2778 17.7338C34.2799 17.7351 34.2826 17.7353 34.2847 17.7366ZM34.1742 17.6855C34.1978 17.6933 34.2197 17.7046 34.2419 17.7159C34.2196 17.7045 34.1977 17.6934 34.1742 17.6855ZM34.0672 17.6627C34.086 17.6646 34.104 17.6698 34.1224 17.6738C34.104 17.6697 34.0859 17.6647 34.0672 17.6627ZM18.2394 1.20937C18.2226 1.21215 18.2059 1.21461 18.189 1.21559C18.2059 1.21458 18.2226 1.21217 18.2394 1.20937ZM17.8935 0.290271C17.9121 0.278436 17.9307 0.267459 17.9501 0.258506C17.9307 0.267479 17.9121 0.278412 17.8935 0.290271ZM17.6691 0.394541C17.6656 0.397208 17.6615 0.398867 17.658 0.401447C17.6615 0.398841 17.6657 0.397234 17.6691 0.394541ZM17.8196 0.199811C17.8145 0.211367 17.8076 0.221849 17.8016 0.232957C17.8075 0.221806 17.8146 0.211394 17.8196 0.199811ZM17.5655 0.45669C17.5458 0.465506 17.5257 0.473946 17.5047 0.480168C17.5258 0.473846 17.5457 0.465589 17.5655 0.45669ZM17.8362 0.155617C17.8335 0.163819 17.8303 0.171762 17.8272 0.179785C17.8304 0.171467 17.832 0.162735 17.8348 0.154236L17.8362 0.155617ZM0.445071 17.4597C0.42457 17.4934 0.401288 17.5255 0.373255 17.5536C0.401452 17.5254 0.424597 17.4932 0.445071 17.4597ZM0.503766 17.3237C0.503504 17.3265 0.503042 17.3309 0.502385 17.3361V17.3347L0.503766 17.3237Z" fill="url(#paint0_linear_auth_star)"/>
                <defs>
                  <linearGradient id="paint0_linear_auth_star" x1="8.52142" y1="8.52295" x2="26.2179" y2="26.2194" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#683F49"/>
                    <stop offset="1" stopColor="#4A1E35"/>
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            
            {/* JETAYU Logo/Text - Same as landing page */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-4"
            >
              <h1
                style={{
                  fontFamily: '"Jt Barnez", sans-serif',
                  fontSize: '30px',
                  fontWeight: 600,
                  fontStyle: 'normal',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, #7B5159 0%, #2F1E22 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  margin: '0 auto',
                  padding: 0,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                JETAYU
              </h1>
            </motion.div>
            
            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-sm text-jet-400 font-light mb-6"
            >
              Continue your Jetayu experience
            </motion.p>
            
            {/* Context-specific subtitle (only for non-login/signup states) */}
            {(modalState === 'forgot_password' || modalState === 'reset_password' || modalState === 'reset_success') && (
              <p className="text-xs text-jet-500 font-light mb-6">
                {modalState === 'forgot_password' && 'Reset your password'}
                {modalState === 'reset_password' && 'Set new password'}
                {modalState === 'reset_success' && 'Check your email'}
              </p>
            )}
            
            {/* Auth Mode Toggle - only show for login/signup */}
            {(modalState === 'login' || modalState === 'signup') && (
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => {
                    setModalState('login')
                    setError(null)
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    modalState === 'login'
                      ? 'text-gold-400 border-b-2 border-gold-400'
                      : 'text-jet-400 hover:text-jet-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setModalState('signup')
                    setError(null)
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    modalState === 'signup'
                      ? 'text-gold-400 border-b-2 border-gold-400'
                      : 'text-jet-400 hover:text-jet-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          {/* OAuth Buttons - only show for login/signup */}
          {showOAuth && (
            <div className="space-y-3">
              <button
                onClick={() => handleOAuth('apple')}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-jet-950 hover:bg-jet-900 border border-jet-800/50 text-white font-medium rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.16c-.15-2.23 1.66-4.07 3.74-4.25.17 2.08-1.65 4.04-3.74 4.25z"/>
                </svg>
                Sign in with Apple
              </button>

              <button
                onClick={() => handleOAuth('google')}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-white hover:bg-gray-50 border border-white/10 text-jet-950 font-medium rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {/* Reset Success State */}
          {showResetSuccess && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl text-sm text-gold-400">
                We've sent a password reset link to your email.
              </div>
              <button
                onClick={() => {
                  setModalState('login')
                  setEmail('')
                  setError(null)
                }}
                className="w-full px-4 py-3 bg-jet-800/50 hover:bg-jet-800 border border-jet-700/50 text-jet-200 font-medium rounded-xl transition-all duration-200"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Forgot Password Request Form */}
          {showForgotPassword && (
            <div className="mt-6">
              <form onSubmit={handleResetPasswordRequest} className="space-y-4">
                <p className="text-sm text-jet-400 font-light mb-4">
                  Enter your email and we'll send you a secure reset link.
                </p>
                <div>
                  <label className="block text-sm text-jet-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gold-500/80 hover:bg-gold-500 text-jet-950 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalState('login')
                    setEmail('')
                    setError(null)
                  }}
                  className="w-full px-4 py-2 text-sm text-jet-400 hover:text-jet-200 transition-colors font-light"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          )}

          {/* Reset Password Form */}
          {showResetPassword && (
            <div className="mt-6">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-sm text-jet-400 mb-2">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm text-jet-400 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gold-500/80 hover:bg-gold-500 text-jet-950 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </div>
          )}

          {/* Email Auth Form */}
          {showEmailForm && (
            <div className="mt-6">
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm text-jet-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                    placeholder="you@example.com"
                  />
                </div>

                {modalState === 'signup' && (
                  <>
                    <div>
                      <label className="block text-sm text-jet-400 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={modalState === 'signup'}
                        className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-jet-400 mb-2">Phone Number (Optional)</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-jet-400 mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-jet-800/50 border border-jet-700/50 rounded-xl text-jet-100 placeholder-jet-500 focus:outline-none focus:border-gold-500/30 transition-colors backdrop-blur-sm"
                    placeholder="••••••••"
                  />
                  {modalState === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalState('forgot_password')
                        setError(null)
                      }}
                      className="mt-2 text-sm text-jet-400 hover:text-gold-400 transition-colors font-light"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gold-500/80 hover:bg-gold-500 text-jet-950 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Please wait...' : modalState === 'signup' ? 'Sign Up' : 'Sign In'}
                </button>
              </form>
            </div>
          )}
          
          {/* Show Email Auth Link - only for login/signup when not in email mode */}
          {showOAuth && mode !== 'email' && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMode('email')
                  setError(null)
                }}
                className="text-sm text-jet-400 hover:text-jet-200 transition-colors font-light"
              >
                {modalState === 'signup' ? 'Sign up with Email' : 'Sign in with Email'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
