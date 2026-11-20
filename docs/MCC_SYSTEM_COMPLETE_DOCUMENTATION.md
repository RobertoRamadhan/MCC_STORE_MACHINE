# MCC System Complete Documentation

## 1. Overview

MCC System adalah aplikasi manajemen spare part dan workflow teknisi yang terdiri dari:

- Frontend Next.js untuk admin dan teknisi
- API backend / route server-side untuk operasi database
- SQL Server database untuk data master dan transaksi operasional
- RFID-based attendance dan authorization untuk teknisi
- Dokumentasi foto untuk workflow pengambilan, persiapan, dan verifikasi part

Aplikasi ini digunakan dalam arsitektur jaringan lokal (LAN) dengan:

- Admin Laptop sebagai client/browser hanya
- Panel PC sebagai server utama semua layanan
- SQL Server berjalan di Panel PC
- API berjalan di Panel PC pada port 3002

---

## 2. Deployment Architecture

### Network layout

- Admin Laptop: 169.254.144.116
  - Berperan sebagai browser client
  - Tidak menjalankan service utama
- Panel PC: 169.254.57.26
  - Menjadi host untuk aplikasi dan database
  - Menjalankan Next.js / API / SQL Server
- API Endpoint: http://169.254.57.26:3002
- Database: localhost\SQLEXPRESS

### Runtime roles

- Frontend app: Next.js
- Backend/API: Node.js + Express/Next API route
- Database: Microsoft SQL Server

### Access model

- Admin Laptop membuka aplikasi lewat browser ke Panel PC
- Panel PC memproses request, terhubung ke localhost SQL Server instance
- Database dan API berada pada host yang sama, yaitu Panel PC

---

## 3. Project Structure

### Frontend / application

- frontend/app/
  - admin/
  - api/
  - rfid/
  - page.tsx
- frontend/public/

### Backend / service routes

- backend/app/api/
  - route handlers
  - _lib/
- backend/src/
  - services/
  - config/

### Key implementation notes

- Routing website menggunakan Next.js App Router di `frontend/app/`
- Seluruh route API berada di `backend/app/api/`
- Frontend meneruskan seluruh `/api/*` ke backend Node.js
- `backend/app/api/` menyediakan endpoint untuk:
  - RFID
  - teknisi
  - request
  - request-foto
  - request-siapkan
  - request-verifikasi
  - partin
  - partout
  - upload
  - email
- `frontend/app/login/page.tsx` merupakan halaman login terpisah
- `frontend/app/rfid/page.tsx` merupakan handler utama RFID login / scan
- `frontend/app/admin/teknisi/page.tsx` merupakan panel admin untuk teknisi dan RFID assignment

---

## 4. Application Roles

### Admin app

Digunakan untuk pengelolaan:

- data teknisi
- RFID tag
- data spare part
- monitoring request
- verifikasi workflow

### Teknisi app / RFID flow

Digunakan untuk:

- scan RFID badge
- validasi teknisi
- mengambil/mengembalikan part
- dokumentasi foto
- proses request siapkan / verifikasi

### Important note

Aplikasi tidak sepenuhnya dibangun sebagai dua environment terpisah di satu laptop. Dalam deployment nyata, role ditentukan oleh route dan sistem yang berjalan di Panel PC, bukan semata-mata port yang digunakan.

---

## 5. Runtime and Development Commands

### Frontend scripts

Frontend dan backend dijalankan dari folder masing-masing:

- `frontend`: `npm run dev` → website port 3000
- `backend`: `npm run dev` → API port 8000
- `frontend`: `npm run start` → website production port 3000
- `backend`: `npm run start` → API production port 8000

### Actual deployed runtime

- API endpoint: http://169.254.57.26:3002
- Browser access from Admin Laptop depends on LAN addressing to Panel PC

---

## 6. Database Schema: RequestFoto

Schema database yang dipakai untuk dokumentasi foto request adalah:

```sql
CREATE TABLE RequestFoto (
    id INT IDENTITY PRIMARY KEY,
    request_id INT NOT NULL,
    tipe_foto NVARCHAR(20) NOT NULL,
    foto_base64 NTEXT,
    catatan NTEXT,
    uploaded_by NVARCHAR(100),
    uploaded_at DATETIME DEFAULT GETDATE()
);
```

### Field details

- `id`: primary key auto increment
- `request_id`: ID request terkait
- `tipe_foto`: tipe dokumentasi foto
  - pengambilan
  - siapkan
  - verifikasi
- `foto_base64`: data foto dalam format base64 / binary image data compatible text field
- `catatan`: catatan tambahan foto
- `uploaded_by`: siapa yang mengupload foto
- `uploaded_at`: waktu upload, default `GETDATE()`

### Valid values for `tipe_foto`

```text
pengambilan
siapkan
verifikasi
```

### API behavior

Fungsi API untuk RequestFoto umumnya melakukan:

- insert foto saat proses pengambilan part
- insert foto saat proses persiapan part
- insert foto saat proses verifikasi part
- ambil data foto berdasarkan `request_id`

---

## 7. RequestFoto API Logic

### Endpoint pattern

- `GET /api/request-foto?request_id=...`
- `POST /api/request-siapkan`
- `POST /api/request-verifikasi`

### Example payload pattern

```json
{
  "id": 123,
  "request_id": 45,
  "tipe_foto": "siapkan",
  "foto_base64": "data:image/jpeg;base64,...",
  "catatan": "Foto dokumen sebelum dikirim",
  "uploaded_by": "admin01"
}
```

### Response pattern

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "request_id": 45,
      "tipe_foto": "siapkan",
      "foto_base64": "...",
      "catatan": "...",
      "uploaded_by": "admin01",
      "uploaded_at": "2026-09-23T10:15:00.000Z"
    }
  ]
}
```

---

## 8. Related Modules

### RFID module

- RFID tag validasi untuk technician / employee
- Data user di `Users` table
- Logic check dengan `rfid_tag` atau `employee_id`

### Request workflow

- `request-siapkan`: foto dokumentasi saat siapkan request
- `request-verifikasi`: foto dokumentasi saat verifikasi request
- `request-foto`: query foto berdasarkan request

### Spare part module

- part entry / part out / request management
- foto part juga dapat dipasang pada data part sesuai kebutuhan

---

## 9. Database Configuration Notes

Project uses SQL Server connection with configuration similar to:

```js
const config = {
  server: '192.168.100.1',
  port: 1433,
  database: 'MCC_SparePartDB',
  user: 'mcc_user',
  password: 'Philips2026!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};
```

However, in the actual deployment context, the real runtime environment is defined as:

- Panel PC host: 169.254.57.26
- Database instance: localhost\SQLEXPRESS

This means the system must be validated against the real panel runtime, not only local laptop assumptions.

---

## 10. Operational Notes

### Recommended access pattern

- Admin Laptop opens the app via the Panel PC IP
- API accessed through `http://169.254.57.26:3002`
- SQL Server access validated on the Panel PC machine

### Critical validation point

Before making database schema changes, verify:

1. actual SQL Server instance name
2. actual database name
3. actual credential and login
4. actual table `RequestFoto`
5. whether `foto_base64` field already exists or needs migration

---

## 11. Summary

MCC System is a LAN-based maintenance and spare-part management application with a centralized database and RFID-driven technician workflow. The RequestFoto table is the main photo documentation store and is designed to support:

- pengambilan part
- persiapan part
- verifikasi part

using `request_id` and `tipe_foto` as the core relation keys.

This project is deployed around the Panel PC at `169.254.57.26`, while the Admin Laptop acts as a browser-only access terminal.

---

## 12. Quick Reference

- Admin Laptop: 169.254.144.116
- Panel PC: 169.254.57.26
- API: http://169.254.57.26:3002
- Database: localhost\SQLEXPRESS
- Photo table: RequestFoto
- Main photo field: `foto_base64`
- Photo type values: `pengambilan`, `siapkan`, `verifikasi`
