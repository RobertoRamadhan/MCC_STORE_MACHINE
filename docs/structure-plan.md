# Rencana Struktur Proyek yang Lebih Rapi

## Pembagian utama

```text
philips-mcc-system/
  frontend/
    README.md
    app/
    components/
    hooks/
    lib/
    styles/
    public/

  backend/
    README.md
    src/
    config/
    database/
    services/
    utils/

  docs/
    architecture.md
```

## Kriteria pemisahan

### Frontend
- semuafiles UI dan tampilan
- halaman `app/page.tsx`, `app/admin/...`, `app/rfid/...`
- state, modal, form, UI components
- fetch ke endpoint backend seperti `/api/parts`, `/api/teknisi`

### Backend
- semua route `app/api/*/route.ts`
- koneksi `mssql` dan konfigurasi database
- service layer untuk operasi CRUD, upload, email, laporan
- logika autentikasi, validasi, business rules

## Status saat ini

Project saat ini masih dalam satu repository dengan pola Next.js full stack. Ini berarti UI dan API bersatu di root. Untuk menjaga stabilitas, lebih baik:
1. pindah file UI lama ke `frontend/` secara bertahap
2. pindah semua API dan SQL logic ke `backend/`
3. sesuaikan import path dan base URL setelah pemindahan selesai

## Saran implementasi

- mulai dari frontend: pisahkan halaman dan komponen
- lalu backend: ambil semua API route ke folder backend/src/routes
- gunakan `axios`/fetch client di frontend untuk memanggil backend
- simpan variabel environment di `.env.local` atau `backend/.env`
- hindari menumpuk query SQL di halaman frontend

## Target struktur ideal setelah refactor

```text
root/
  frontend/
    app/
    components/
    hooks/
    lib/
  backend/
    src/
      routes/
      services/
      database/
  package.json
  docker-compose.yml (opsional)
  .env.example
```
