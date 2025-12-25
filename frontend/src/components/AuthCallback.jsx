import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      // Wait for Supabase to process the auth tokens from URL hash
      // Supabase automatically processes hash fragments on page load
      try {
        // Get session to ensure auth state is processed
        const { data: { session } } = await supabase.auth.getSession()
        
        // Small delay to ensure Supabase has processed the tokens
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Notify opener that login succeeded
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin)
          // Close popup immediately
          window.close()
        } else {
          // If no opener (direct navigation), redirect to home
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        // Still try to close/redirect even on error
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin)
          window.close()
        } else {
          window.location.href = '/'
        }
      }
    }

    handleCallback()
  }, [])

  // Minimal UI - should close before user sees it
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

