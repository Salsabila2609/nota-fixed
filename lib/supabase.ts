import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// NEXT_PUBLIC_* aman divalidasi di module scope karena memang harus ada
// saat build (di-inline ke bundle client).
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Lazy-init: service role key adalah secret runtime, sengaja TIDAK dibaca
// di module scope supaya `next build` / collect-page-data tidak gagal
// hanya karena env belum tersedia di build stage Docker.
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin

  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  }

  _supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return _supabaseAdmin
}

// NOTE: role 'cse' sudah dimigrasikan menjadi 'cse' (lihat migration_cse_branch.sql).
// CSE = Customer Service Executive, ditempatkan di 1 branch, memegang 1 nama MC.
export type User = {
  id: string
  name: string
  username: string
  email?: string
  role: 'driver' | 'admin' | 'cse'
  branch_id?: string | null   // hanya relevan utk role 'cse'
  mc_name?: string | null     // hanya relevan utk role 'cse' — 1 CSE = 1 MC
}

export type Branch = {
  id: string
  name: string
  brand: 'IM3' | '3ID'
  created_at?: string
}

export type Submission = {
  id: string
  driver_id: string          // tetap dipakai sbg "uploader_id" generik (driver ATAU cse)
  driver_name: string
  category: string
  description?: string
  amount?: number
  submission_date: string
  bill_date?: string
  image_path: string
  image_url?: string
  proof_image_path?: string  // bukti transfer bank, wajib jika amount > threshold
  proof_image_url?: string
  marking_image_path?: string  // "Foto Bukti CSE" (dulu disebut Foto Bukti cse) — wajib tiap nota dari CSE
  marking_image_url?: string
  status: 'pending' | 'approved' | 'rejected'
  blur_rejected: boolean
  ocr_raw_text?: string
  created_at: string
}
