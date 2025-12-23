import { supabase } from './supabase'

/**
 * Get user context for API requests
 * Returns user info if authenticated, null otherwise
 */
export async function getUserContext() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return {
        isAuthenticated: false,
        user_id: null,
        email: null,
        full_name: null
      }
    }

    // Try to get full_name from profiles table
    let fullName = session.user.user_metadata?.full_name || null
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      
      if (profile?.full_name) {
        fullName = profile.full_name
      }
    } catch (error) {
      // Fallback to user_metadata if profiles query fails
      console.warn('Could not fetch profile:', error)
    }

    return {
      isAuthenticated: true,
      user_id: session.user.id,
      email: session.user.email,
      full_name: fullName
    }
  } catch (error) {
    console.error('Error getting user context:', error)
    return {
      isAuthenticated: false,
      user_id: null,
      email: null,
      full_name: null
    }
  }
}


