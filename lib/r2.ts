/**
 * Storage: Cloudflare R2 (utama) + ANTREAN DISK LOKAL (saat R2 tak terjangkau,
 * mis. ketika VPN laptop server sedang aktif).
 *
 * - Upload: coba R2. Kalau gagal, simpan ke disk server dengan awalan "local/".
 * - Worker di background mencoba memindahkan file "local/..." ke R2 secara
 *   berkala. Begitu R2 terjangkau lagi (VPN mati), file dipindah, path di DB
 *   diperbarui, dan file lokal dihapus.
 * - Tampil: "local/..." dilayani server lewat /api/files (URL bertanda tangan),
 *   selain itu presigned URL R2 seperti biasa.
 * - Path "sb/..." (Supabase, dari versi sebelumnya) tetap bisa dibaca.
 * - r2Upload MENGEMBALIKAN path final. Path itulah yang wajib disimpan ke DB.
 *
 * Env opsional:
 *   LOCAL_STORAGE_DIR        (default /app/storage-buffer)
 *   LOCAL_SYNC_INTERVAL_MS   (default 120000 = 2 menit)
 *   SUPABASE_STORAGE_BUCKET  (default "nota-images", hanya untuk path sb/ lama)
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHmac, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import nodePath from 'path'
import { getSupabaseAdmin } from './supabase'

const LOCAL_PREFIX = 'local/'
const SB_PREFIX = 'sb/'
const LOCAL_DIR = process.env.LOCAL_STORAGE_DIR || '/app/storage-buffer'
const SB_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'nota-images'
const SYNC_INTERVAL = Number(process.env.LOCAL_SYNC_INTERVAL_MS) || 2 * 60 * 1000
const URL_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production-32ch'

// Storage S3-compatible: default Cloudflare R2. Untuk Backblaze B2 dll,
// isi S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET.
const r2Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: (process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)!,
    secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)!,
  },
  // Checksum hanya saat wajib: dibutuhkan Backblaze B2, aman untuk R2
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  maxAttempts: 1,
  requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
})
const R2_BUCKET = (process.env.S3_BUCKET || process.env.R2_BUCKET_NAME)!

const isLocal = (p: string) => p.startsWith(LOCAL_PREFIX)
const isSb = (p: string) => p.startsWith(SB_PREFIX)
const stripPrefix = (p: string) => p.slice(p.indexOf('/') + 1)
const sb = () => getSupabaseAdmin().storage.from(SB_BUCKET)

/** Path file di disk; menolak path yang mencoba keluar folder. */
export function localFilePath(key: string): string {
  const full = nodePath.resolve(LOCAL_DIR, key)
  if (!full.startsWith(nodePath.resolve(LOCAL_DIR) + nodePath.sep)) {
    throw new Error('Path tidak valid')
  }
  return full
}

export function contentTypeFor(key: string): string {
  const ext = nodePath.extname(key).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

// Circuit breaker: setelah R2 gagal, upload langsung ke disk selama 5 menit
let r2DownUntil = 0
const R2_COOLDOWN_MS = 5 * 60 * 1000
const markR2Down = (err: unknown) => {
  if (Date.now() >= r2DownUntil) {
    console.warn('[storage] R2 tidak terjangkau, simpan ke disk lokal:', (err as any)?.name, (err as any)?.message)
  }
  r2DownUntil = Date.now() + R2_COOLDOWN_MS
}

async function r2Put(key: string, body: Buffer | Uint8Array, contentType: string) {
  await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }))
}

async function r2Get(key: string): Promise<Buffer> {
  const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const c of res.Body as AsyncIterable<Uint8Array>) chunks.push(c)
  return Buffer.concat(chunks)
}

/**
 * Upload file. Mengembalikan path final yang HARUS disimpan ke database.
 */
export async function r2Upload(
  path: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (Date.now() >= r2DownUntil) {
    try {
      await r2Put(path, buffer, contentType)
      return path
    } catch (err) {
      markR2Down(err)
    }
  }
  const file = localFilePath(path)
  await fs.mkdir(nodePath.dirname(file), { recursive: true })
  await fs.writeFile(file, buffer)
  ensureSyncWorker()
  return LOCAL_PREFIX + path
}

/**
 * Download file (untuk export PDF & image-proxy).
 */
export async function r2Download(path: string): Promise<Buffer> {
  if (isLocal(path)) {
    const key = stripPrefix(path)
    try {
      return await fs.readFile(localFilePath(key))
    } catch {
      return r2Get(key) // mungkin baru saja dipindah ke R2
    }
  }
  if (isSb(path)) {
    const { data, error } = await sb().download(stripPrefix(path))
    if (error || !data) throw error || new Error('File tidak ditemukan')
    return Buffer.from(await data.arrayBuffer())
  }
  return r2Get(path)
}

/**
 * Hapus file (tidak pernah throw).
 */
export async function r2Delete(path: string): Promise<void> {
  try {
    if (isLocal(path)) {
      await fs.rm(localFilePath(stripPrefix(path)), { force: true })
    } else if (isSb(path)) {
      await sb().remove([stripPrefix(path)])
    } else {
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: path }))
    }
  } catch {
    // abaikan
  }
}

function signLocal(key: string, exp: number): string {
  return createHmac('sha256', URL_SECRET).update(`${key}:${exp}`).digest('hex')
}

/** Dipakai /api/files untuk memeriksa URL file lokal. */
export function verifyLocalSignature(key: string, exp: number, sig: string): boolean {
  if (!key || !exp || !sig || Date.now() / 1000 > exp) return false
  const a = Buffer.from(signLocal(key, exp))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Presigned URL R2 untuk key tanpa awalan. */
export async function r2PresignKey(key: string, expiresInSeconds = 60 * 60): Promise<string> {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  })
}

/**
 * URL sementara untuk menampilkan gambar (default 1 jam).
 * Tidak pernah throw: kalau gagal, kembalikan string kosong.
 */
export async function r2SignedUrl(path: string, expiresInSeconds = 60 * 60): Promise<string> {
  try {
    if (isLocal(path)) {
      const key = stripPrefix(path)
      const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
      const q = new URLSearchParams({ k: key, e: String(exp), s: signLocal(key, exp) })
      return `/api/files?${q.toString()}`
    }
    if (isSb(path)) {
      const { data, error } = await sb().createSignedUrl(stripPrefix(path), expiresInSeconds)
      if (error || !data) throw error || new Error('signed url kosong')
      return data.signedUrl
    }
    return await r2PresignKey(path, expiresInSeconds)
  } catch (err) {
    console.warn('[storage] Gagal membuat signed URL:', path, (err as any)?.message)
    return ''
  }
}

// ───────────────────────── Worker sinkronisasi ─────────────────────────
const COLUMNS = ['image_path', 'marking_image_path', 'proof_image_path'] as const
const g = globalThis as any

async function syncLocalToR2(): Promise<void> {
  if (g.__notaSyncRunning) return
  g.__notaSyncRunning = true
  let moved = 0
  try {
    const db = getSupabaseAdmin()
    for (const column of COLUMNS) {
      while (true) {
        const { data, error } = await db
          .from('submissions')
          .select(`id, ${column}`)
          .like(column, `${LOCAL_PREFIX}%`)
          .limit(50)
        if (error) throw error
        if (!data?.length) break

        for (const row of data as any[]) {
          const oldPath: string = row[column]
          const key = stripPrefix(oldPath)
          const file = localFilePath(key)

          let body: Buffer
          try {
            body = await fs.readFile(file)
          } catch {
            console.error(`[sync] File lokal hilang: ${file} (submission ${row.id})`)
            // tandai supaya tidak diulang terus
            await db.from('submissions').update({ [column]: key }).eq('id', row.id).eq(column, oldPath)
            continue
          }

          // Kalau R2 masih tak terjangkau, lempar error -> berhenti, coba lagi nanti
          await r2Put(key, body, contentTypeFor(key))
          r2DownUntil = 0

          const { error: upErr } = await db
            .from('submissions')
            .update({ [column]: key })
            .eq('id', row.id)
            .eq(column, oldPath)
          if (upErr) throw upErr

          await fs.rm(file, { force: true })
          moved++
        }
      }
    }
    if (moved) console.log(`[sync] ${moved} file dipindah dari disk lokal ke R2`)
  } catch (err) {
    if (moved) console.log(`[sync] ${moved} file dipindah sebelum berhenti`)
    const name = (err as any)?.name
    if (name && name !== 'Error') markR2Down(err)
    else console.warn('[sync] Tertunda:', (err as any)?.message)
  } finally {
    g.__notaSyncRunning = false
  }
}

export function ensureSyncWorker() {
  if (g.__notaSyncTimer || process.env.NEXT_PHASE === 'phase-production-build') return
  g.__notaSyncTimer = setInterval(() => { void syncLocalToR2() }, SYNC_INTERVAL)
  g.__notaSyncTimer.unref?.()
  setTimeout(() => { void syncLocalToR2() }, 10_000).unref?.()
}

// Mulai worker begitu modul dimuat di server (sisa antrean dari sebelum restart ikut terproses)
ensureSyncWorker()
