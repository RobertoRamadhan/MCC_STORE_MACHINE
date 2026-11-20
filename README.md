# MCC Store Machine

Frontend dan backend API adalah dua aplikasi Next.js/Node.js yang terpisah.

`frontend/` hanya berisi website dan aset. Semua route API ada di `backend/app/api/`; frontend meneruskan `/api/*` ke backend.

## Menjalankan aplikasi

Jalankan di dua terminal:

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

Backend berjalan di port 8000 dan frontend di port 3000. Atur kredensial SQL Server di `backend/.env`; salin format dari `backend/.env.example`. Untuk host backend selain lokal, atur `API_BACKEND_URL` di `frontend/.env.local`.
