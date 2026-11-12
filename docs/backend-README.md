# Backend

Folder ini berisi semua logika server-side dan API.

Struktur final:

```text
backend/
  src/
    api/
      routes/
      controllers/
    auth/
      index.ts
    config/
      db.ts
    database/
      sql.ts
    middleware/
      authMiddleware.ts
    routes/
      index.ts
      parts.ts
    services/
      partService.ts
      emailService.ts
      uploadService.ts
    utils/
      response.ts
      validation.ts
```

Tanggung jawab:
- endpoint API dan route handler
- koneksi SQL Server
- CRUD part, teknisi, request, laporan
- auth dan role permission
- validasi, upload, email, business logic

Aturan:
- backend hanya untuk server-side logic
- frontend tidak boleh menyentuh database secara langsung
- semua API harus lewat route dan service layer yang jelas
