# Struktur Proyek MCC

## Struktur repository

```text
/
  frontend/
    app/
      admin/page.tsx
      admin/teknisi/page.tsx
      login/page.tsx
      rfid/page.tsx
      components/
        admin/AdminDashboard.tsx
        auth/LoginForm.tsx
    public/                   # Aset website
    package.json
    next.config.ts
    tsconfig.json
  backend/
    app/api/                  # Seluruh route API
      _lib/                   # Helper API
    package.json
    next.config.ts
    tsconfig.json
    src/
      config/db.js            # Koneksi SQL Server
      services/               # Logika bisnis API
    tools/notifikasi-pc/      # Utilitas notifikasi Windows yang masih dipakai
  docs/
```

Frontend dan backend berjalan sebagai aplikasi Next.js/Node.js terpisah. Frontend hanya menangani halaman dan aset website; semua endpoint API berada di backend. Akses `/` diarahkan ke `/admin`; sesi admin yang tidak valid diarahkan ke `/login`.

## Routing API

- Route handler yang semula berada di `frontend/app/api` telah dipindahkan ke `backend/app/api`.
- Frontend meneruskan seluruh path `/api/*` ke backend melalui rewrite.
- `API_BACKEND_URL` dapat digunakan untuk menentukan alamat backend selain `http://127.0.0.1:8000`.

## Menjalankan aplikasi

Jalankan dari dua terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

```powershell
Set-Location backend
npm ci
npm run dev
```

Atur konfigurasi SQL Server di `backend\.env` berdasarkan `backend\.env.example`.
