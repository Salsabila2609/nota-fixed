# Nota Reimbursement App

## Deployment Guide

### Prerequisites
- Server Linux (Ubuntu recommended)
- Docker & Docker Compose installed on the server

---

### 1. Install Docker
Install Docker Engine dan Docker Compose di server.

---

### 2. Clone Repository
```bash
git clone https://github.com/Salsabila2609/nota-reimbursement.git
cd nota-reimbursement
```

---

### 3. Buat file `.env.local`
Buat file `.env.local` di root project dan isi dengan nilai yang diberikan oleh tim:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

JWT_SECRET=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=nota-images

NEXT_PUBLIC_APP_URL=http://YOUR_SERVER_IP:3000
```

> Ganti `YOUR_SERVER_IP` dengan IP address server.

---

### 4. Jalankan Aplikasi
```bash
docker compose up --build -d
```

---

### 5. Cek Status
```bash
docker compose ps        # cek container berjalan
docker compose logs -f   # lihat log realtime
```

---

### 6. Akses Aplikasi
Buka browser dan akses:
```
http://YOUR_SERVER_IP:3000
```

---

### Update Aplikasi
Jika ada update code:
```bash
git pull
docker compose down
docker compose up --build -d
```
