# Backend API Node.js

Backend adalah aplikasi Next.js terpisah yang menjalankan seluruh route API. Koneksi SQL Server menggunakan `mssql`.

## Persyaratan

- Node.js versi 20.9 atau lebih baru
- SQL Server yang dapat diakses dari host backend

## Konfigurasi dan menjalankan

```powershell
Set-Location backend
npm ci
npm run dev
```

API berjalan pada `http://127.0.0.1:8000`. Atur `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD` di `backend/.env` (lihat `.env.example`).

Frontend meneruskan `/api/*` ke `http://127.0.0.1:8000` secara default. Untuk server berbeda, tambahkan `API_BACKEND_URL` ke `frontend/.env.local`, lalu restart frontend.

## Struktur

- `app/api/`: route handler dan helper endpoint.
- `src/config/db.js`: konfigurasi dan koneksi SQL Server.
- `src/services/`: service yang dipakai handler API.
- `tools/notifikasi-pc/`: utilitas notifikasi Windows.

Jangan simpan kredensial database di source control. Gunakan `backend/.env` lokal dan batasi akses file tersebut.
