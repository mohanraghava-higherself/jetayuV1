import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      // Wait for Supabase to process the auth tokens from URL hash
      // Supabase automatically processes hash fragments on page load
      try {
        // Get session to ensure auth state is processed
        await supabase.auth.getSession()
        
        // Small delay to ensure Supabase has processed the tokens
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // MOBILE: Cannot rely on window.opener or postMessage
        // Desktop: Try to notify opener, but always redirect as fallback
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin)
            // Try to close popup (works on desktop)
            window.close()
            // If close fails, redirect will happen below
          } catch (err) {
            // postMessage failed - redirect instead
            window.location.href = '/'
          }
        } else {
          // No opener (mobile or direct navigation) - always redirect to HOME
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        // Always redirect to HOME on error
        window.location.href = '/'
      }
    }

    handleCallback()
  }, [])

  // Minimal UI - should redirect before user sees it
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#060201',
      color: '#FFFFFF',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <p>Completing login...</p>
    </div>
  )
}

