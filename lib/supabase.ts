import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export type User = {
  id: string
  name: string
  username: string
  email?: string
  role: 'driver' | 'admin'
}

export type Submission = {
  id: string
  driver_id: string
  driver_name: string
  category: string
  description?: string
  amount?: number
  submission_date: string
  bill_date?: string
  image_path: string
  image_url?: string
  proof_image_path?: string   
  proof_image_url?: string   
  status: 'pending' | 'approved' | 'rejected'
  blur_rejected: boolean
  ocr_raw_text?: string
  created_at: string
}
