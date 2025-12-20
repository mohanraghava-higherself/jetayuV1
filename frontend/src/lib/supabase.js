import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if credentials are configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '' && 
                     supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder-key'

if (!isSupabaseConfigured) {
  console.error('❌ Supabase credentials not configured or invalid!')
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing')
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing')
  console.error('   Make sure:')
  console.error('   1. .env file exists in frontend/ directory')
  console.error('   2. Variables start with VITE_ prefix')
  console.error('   3. Vite dev server was restarted after creating .env')
  console.error('   4. No typos in variable names')
}

// CRITICAL: Don't create client with placeholder values - it will cause "Invalid API key" errors
// Only create client if we have real credentials
let supabase = null
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
    console.log('✅ Supabase client initialized successfully')
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
  }
} else {
  // Create a mock client that will throw helpful errors
  supabase = {
    auth: {
      signUp: async () => ({ error: { message: 'Supabase not configured. Please check your .env file and restart the dev server.' } }),
      signInWithPassword: async () => ({ error: { message: 'Supabase not configured. Please check your .env file and restart the dev server.' } }),
      signInWithOAuth: async () => ({ error: { message: 'Supabase not configured. Please check your .env file and restart the dev server.' } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  }
}

// Export a flag to check if Supabase is properly configured
export { supabase, isSupabaseConfigured }

