# Panduan Migrasi Storage: Cloudflare R2 → Backblaze B2

Aplikasi: **nota-fixed** (reimbursement nota IOH)
Tanggal: September 2026

---

## Kenapa migrasi

Hasil diagnosa di laptop server (`DESKTOP-8669AOT`, WSL2 + Docker):

| Kondisi | R2 | B2 | Supabase | Google |
|---|---|---|---|---|
| VPN mati | **000 (diblokir)** | 403 (OK) | 404 (OK) | 400 (OK) |
| VPN nyala (sebelum fix DNS) | 000 | 000 | 000 | 000 |

Kesimpulan:

1. **R2 diblokir permanen** oleh jaringan kantor (rentang IP Cloudflare `172.64.0.0/13`),
   terhenti setelah gateway internal `10.2.1.2`. Ganti account ID atau bucket tidak menolong.
2. **Saat VPN nyala semua koneksi mati** karena `/etc/wsl.conf` memaksa DNS `8.8.8.8`
   (sudah diperbaiki: `generateResolvConf = true`).
3. **B2 bisa diakses** saat VPN mati → dipakai sebagai storage utama.
4. Ditambah **antrean di harddisk server**: kalau storage tidak terjangkau,
   foto disimpan lokal dulu lalu otomatis dipindah ke B2 saat jaringan pulih.
   Upload tidak pernah gagal lagi.

---

## Ringkasan perubahan kode

| File | Status | Isi perubahan |
|---|---|---|
| `lib/r2.ts` | diganti total | Storage S3 generik (R2/B2), antrean disk lokal, worker sync otomatis, signed URL |
| `app/api/files/route.ts` | **baru** | Menyajikan foto yang masih antre di disk server (URL bertanda tangan HMAC) |
| `lib/image-processing.ts` | ditambah | `compressSupportImage()` — kompres foto bukti & timestamp (±3 MB → ±150 KB) |
| `app/api/submissions/route.ts` | diubah | Pakai path hasil `r2Upload`, kompres foto bukti, log error storage |
| `app/api/submissions/[id]/upload-proof/route.ts` | diubah | Sama seperti di atas |
| `app/api/submissions/[id]/upload-marking/route.ts` | diubah | Sama seperti di atas |
| `app/api/submissions/[id]/replace-photo/route.ts` | diubah | Sama seperti di atas |
| `Dockerfile` | diubah | Buat folder `/app/storage-buffer` milik user `nextjs` |
| `docker-compose.yml` | diubah | Volume `nota-buffer` supaya antrean tidak hilang saat rebuild |
| `.env.local.example` | diubah | Dokumentasi semua env (termasuk yang selama ini tidak tercatat) |
| `.github/workflows/migrate-r2-to-b2.yml` | **baru** | Migrasi file lama R2 → B2 lewat GitHub Actions |

**Catatan penting:** `r2Upload()` sekarang **mengembalikan path final** (bisa berawalan
`local/`). Path itu yang wajib disimpan ke database. Semua pemanggilnya sudah disesuaikan.

---

# LANGKAH-LANGKAH

## STEP 0 — Backup (5 menit)

```bash
cd ~/nota-fixed
git status                  # pastikan tidak ada perubahan yang belum di-commit
cp .env.local ~/env-backup-$(date +%F).txt
git checkout -b storage-b2  # kerja di branch baru
```

Backup database dari dashboard Supabase: **Database → Backups**, atau minimal catat
jumlah baris saat ini lewat SQL Editor:

```sql
select count(*) from submissions;
```

---

## STEP 1 — Buat akun & bucket Backblaze B2 (10 menit)

1. Daftar di <https://www.backblaze.com> → pilih **B2 Cloud Storage** (gratis 10 GB).
2. **Buckets → Create a Bucket**
   - Nama: `nota-reimburse-ioh` (harus unik global, tambahkan angka kalau ditolak)
   - Files in Bucket are: **Private**
   - Default Encryption: Disable (boleh Enable, tidak berpengaruh)
3. Setelah bucket jadi, catat **Endpoint** yang tampil di daftar bucket,
   contoh: `s3.us-west-004.backblazeb2.com`
   → berarti `S3_REGION` = `us-west-004`
4. **Application Keys → Add a New Application Key**
   - Name: `nota-app`
   - Allow access to Bucket: pilih bucket tadi (jangan "All")
   - Type of Access: **Read and Write**
   - Klik Create, lalu **catat `keyID` dan `applicationKey`**
     (applicationKey hanya ditampilkan SEKALI)

---

## STEP 2 — Tes B2 dari laptop server (5 menit, VPN mati)

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 https://s3.us-west-004.backblazeb2.com
```

Harus keluar `403` (bukan `000`). Lalu tes upload sungguhan — ganti 4 nilai berikut:

```bash
docker exec \
  -e S3_ENDPOINT="https://s3.us-west-004.backblazeb2.com" \
  -e S3_REGION="us-west-004" \
  -e S3_KEY="KEY_ID_KAMU" \
  -e S3_SECRET="APPLICATION_KEY_KAMU" \
  -e S3_BUCKET="nota-reimburse-ioh" \
  nota-reimburse timeout 30 node -e '
const {S3Client,PutObjectCommand}=require("@aws-sdk/client-s3");
const c=new S3Client({region:process.env.S3_REGION,endpoint:process.env.S3_ENDPOINT,
 credentials:{accessKeyId:process.env.S3_KEY,secretAccessKey:process.env.S3_SECRET},
 requestChecksumCalculation:"WHEN_REQUIRED",responseChecksumValidation:"WHEN_REQUIRED"});
c.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:"tes/tes.txt",Body:"halo"}))
 .then(()=>console.log("UPLOAD B2 OK")).catch(e=>console.log("ERROR:",e.name,e.message))' 2>&1 | grep -iv warning
```

**Harus keluar `UPLOAD B2 OK`.** Kalau `ERROR: AccessDenied` → application key salah/
tidak punya izin write. Kalau timeout → B2 ikut diblokir, hubungi IT dulu.

> Jangan lanjut ke step berikutnya sebelum step ini berhasil.

---

## STEP 3 — Pasang file-file baru (10 menit)

Salin semua file dari folder `nota-migrasi/` ini ke folder project, menimpa yang lama:

```
lib/r2.ts                                        (ganti total)
lib/image-processing.ts                          (ganti total)
app/api/files/route.ts                           (BARU - buat folder dulu)
app/api/submissions/route.ts                     (ganti total)
app/api/submissions/[id]/upload-proof/route.ts   (ganti total)
app/api/submissions/[id]/upload-marking/route.ts (ganti total)
app/api/submissions/[id]/replace-photo/route.ts  (ganti total)
Dockerfile                                       (ganti total)
docker-compose.yml                               (ganti total)
.env.local.example                               (ganti total)
.github/workflows/migrate-r2-to-b2.yml           (BARU)
```

Kalau menyalin manual, buat foldernya dulu:

```bash
cd ~/nota-fixed
mkdir -p app/api/files .github/workflows
```

Verifikasi tidak ada typo:

```bash
npx tsc --noEmit -p .    # harus selesai tanpa pesan error
```

---

## STEP 4 — Migrasi foto lama R2 → B2 (15 menit)

Laptop server tidak bisa menjangkau R2, jadi penyalinan dijalankan di GitHub Actions
(server GitHub bisa menjangkau R2 maupun B2).

### 4a. Isi secrets di GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Tambahkan 7 secret berikut (nilai R2 diambil dari `.env.local`):

| Nama secret | Isi |
|---|---|
| `R2_ACCOUNT_ID` | `f2bda77e1b7a303d9bc660aacddc5f48` |
| `R2_ACCESS_KEY_ID` | dari `.env.local` |
| `R2_SECRET_ACCESS_KEY` | dari `.env.local` |
| `R2_BUCKET_NAME` | dari `.env.local` |
| `B2_KEY_ID` | keyID dari STEP 1 |
| `B2_APP_KEY` | applicationKey dari STEP 1 |
| `B2_BUCKET` | nama bucket B2 |

### 4b. Push workflow & jalankan

```bash
git add -A
git commit -m "Storage: B2 + antrean lokal"
git push -u origin storage-b2
```

Buka tab **Actions → Migrasi R2 ke B2 → Run workflow** (pilih branch `storage-b2`).
Tunggu selesai, lalu **cek di log bagian bawah**: `Ukuran R2` dan `Ukuran B2` harus
menunjukkan **jumlah objek yang sama**.

Nama file (key) di B2 identik dengan di R2, jadi **database tidak perlu diubah sama sekali**.

---

## STEP 5 — Alihkan aplikasi ke B2 (5 menit)

Tambahkan ke `.env.local` (baris `R2_*` yang lama **jangan dihapus**, biarkan sebagai cadangan):

```
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_ACCESS_KEY_ID=KEY_ID_KAMU
S3_SECRET_ACCESS_KEY=APPLICATION_KEY_KAMU
S3_BUCKET=nota-reimburse-ioh
```

Pastikan `JWT_SECRET` sudah terisi (dipakai untuk menandatangani URL foto antrean):

```bash
grep JWT_SECRET .env.local
```

Rebuild:

```bash
cd ~/nota-fixed
docker compose down
docker compose up --build -d
docker compose logs --tail 30 app
```

---

## STEP 6 — Verifikasi (10 menit)

1. **Buka aplikasi** → login → daftar nota muncul → **foto lama tampil** (sekarang dari B2).
2. **Upload 1 nota baru** → berhasil, fotonya tampil.
3. **Cek log storage:**
   ```bash
   docker compose logs --tail 50 app | grep -iE "storage|sync"
   ```
   - Tidak ada pesan = foto langsung masuk B2 (ideal).
   - Ada `R2 tidak terjangkau, simpan ke disk lokal` = jaringan sedang putus,
     foto masuk antrean (tetap aman).
4. **Cek antrean:**
   ```bash
   docker exec nota-reimburse sh -c 'find /app/storage-buffer -type f | wc -l'
   ```
   `0` artinya semua sudah terkirim ke B2.
5. **Tes export PDF** salah satu periode → foto muncul di PDF.
6. **Ulangi migrasi sekali lagi** (Actions → Run workflow) untuk menyalin file yang
   sempat masuk R2 di sela-sela proses. Aman diulang, hanya menyalin yang belum ada.

7. **Merge ke main** setelah semua beres:
   ```bash
   git checkout main && git merge storage-b2 && git push
   ```

---

## STEP 7 — Saat VPN menyala (tes lanjutan)

Perbaikan DNS sudah dilakukan (`/etc/wsl.conf` → `generateResolvConf = true`).
Saat VPN aktif, jalankan:

```bash
nslookup nnbzqazbxrgnlipceyjn.supabase.co
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 https://nnbzqazbxrgnlipceyjn.supabase.co
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 https://s3.us-west-004.backblazeb2.com
docker exec nota-reimburse sh -c 'wget -qO- -T5 https://s3.us-west-004.backblazeb2.com >/dev/null; echo exit=$?'
```

- **Semua dapat angka (bukan 000)** → masalah VPN selesai, aplikasi jalan 24 jam.
- **Masih 000** → VPN memutus WSL. Aplikasi tetap bisa dipakai: foto masuk antrean
  lokal dan terkirim otomatis setelah VPN mati. Tapi kalau Supabase juga 000,
  database tidak terjangkau dan upload gagal total → **harus lapor IT**.

---

## Cara kembali ke R2 (kalau IT membuka blokir)

1. Hapus/komentari baris `S3_*` di `.env.local` (biarkan `R2_*` terisi).
2. `docker compose up -d --force-recreate`
3. File yang sudah telanjur di B2 perlu disalin balik: ubah arah `rclone copy`
   di workflow menjadi `b2:... r2:...`.

---

## Yang perlu disampaikan ke tim IT

> Aplikasi internal reimbursement nota (server: laptop WSL2+Docker, `DESKTOP-8669AOT`)
> membutuhkan akses keluar HTTPS (443) ke:
>
> 1. `https://nnbzqazbxrgnlipceyjn.supabase.co` — database aplikasi
> 2. `https://s3.us-west-004.backblazeb2.com` — penyimpanan foto (Backblaze B2)
> 3. `https://f2bda77e1b7a303d9bc660aacddc5f48.r2.cloudflarestorage.com` — penyimpanan lama
>    (Cloudflare R2, IP 172.64.66.1 / 172.64.190.1). **Timeout, terhenti setelah gateway
>    internal 10.2.1.2.** Mohon dicek apakah rentang 172.64.0.0/13 diblokir.
> 4. Saat VPN aktif, seluruh koneksi keluar dari WSL/Docker terputus, padahal Windows
>    host tetap normal. Mohon lalu lintas dari WSL2 (Hyper-V vEthernet/WSL) diizinkan
>    lewat VPN, atau R2/B2 dikecualikan dari tunnel (split tunneling).

---

## Catatan tambahan (di luar migrasi)

Temuan lain saat membaca repo, sebaiknya dikerjakan menyusul:

1. **`supabase-schema.sql` usang** — tidak punya kolom `username`, role `cse`, tabel
   `branches`, `login_audit_log`, `bill_date`, dll. Setup baru dari file ini akan gagal.
2. **`.gitignore` baris terakhir rusak**: `lib/google-credentials.jsonservice-acc.json`
   (dua entri menyatu) → file kredensial tidak ter-ignore. Pisahkan jadi 2 baris.
3. **JWT_SECRET punya fallback hardcoded** di `lib/auth.ts` — pastikan env selalu terisi.
4. **Driver/CSE bisa DELETE nota yang sudah approved** (PATCH cek status pending, DELETE tidak).
5. **File sampah**: `0`, `trace.txt`, `eng.traineddata`, `ind.traineddata`, `lib/ocr.ts`
   (Tesseract, tidak dipakai), dependency `next-auth` & `googleapis` tidak terpakai.
6. **`GET /api/submissions` tanpa paginasi** — akan melambat kalau data sudah ribuan.
