import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* =====================================================================
   API role pengguna. Butuh migrasi 15.
   GET  /api/role                 -> daftar role + jumlah user
   POST /api/role { aksi:'simpan', kode, nama, warna, kode_lama? }
   POST /api/role { aksi:'hapus', kode }   (role bawaan / masih dipakai user tidak bisa dihapus)
   ===================================================================== */

const ok = (message: string, extra: any = {}) => NextResponse.json({ success: true, message, ...extra });
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });
const belumMigrasi = (m: string) => /Invalid object name 'UserRole'/i.test(m);

export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const r = await pool.request().query(`
      SELECT r.kode, r.nama, r.warna, r.urutan, r.is_system,
             (SELECT COUNT(*) FROM Users u WHERE u.role = r.kode) AS jumlah_user
      FROM UserRole r ORDER BY r.urutan, r.kode`);
    return NextResponse.json({ success: true, data: r.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: belumMigrasi(err.message) ? 'Tabel role belum ada. Jalankan migrasi 15.' : err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());
    if (b.aksi === 'simpan') {
      const kode = String(b.kode ?? '').trim();
      const nama = String(b.nama ?? '').trim().slice(0, 60);
      const warna = /^#[0-9a-fA-F]{6}$/.test(String(b.warna)) ? String(b.warna) : '#1e7e34';
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(kode)) return bad('Kode role 1-20 karakter, hanya huruf, angka, - atau _ (tanpa spasi)');
      if (!nama) return bad('Nama role wajib diisi');
      const lama = String(b.kode_lama ?? '').trim();
      if (lama) {
        await pool.request().input('k', sql.VarChar(20), lama).input('n', sql.NVarChar(60), nama).input('w', sql.VarChar(10), warna)
          .query(`UPDATE UserRole SET nama=@n, warna=@w WHERE kode=@k`);
        return ok('Role diperbarui');
      }
      const ada = await pool.request().input('k', sql.VarChar(20), kode).query(`SELECT COUNT(*) AS n FROM UserRole WHERE kode=@k`);
      if (ada.recordset[0].n > 0) return bad(`Kode role "${kode}" sudah ada`);
      await pool.request().input('k', sql.VarChar(20), kode).input('n', sql.NVarChar(60), nama).input('w', sql.VarChar(10), warna)
        .query(`INSERT INTO UserRole (kode, nama, warna, urutan) VALUES (@k, @n, @w, (SELECT ISNULL(MAX(urutan),0)+10 FROM UserRole WHERE urutan < 90))`);
      return ok('Role ditambahkan');
    }
    if (b.aksi === 'hapus') {
      const kode = String(b.kode ?? '').trim();
      const r = await pool.request().input('k', sql.VarChar(20), kode).query(`
        SELECT is_system, (SELECT COUNT(*) FROM Users u WHERE u.role = @k) AS dipakai FROM UserRole WHERE kode=@k`);
      const x = r.recordset[0];
      if (!x) return bad('Role tidak ditemukan');
      if (x.is_system) return bad('Role bawaan tidak bisa dihapus');
      if (x.dipakai > 0) return bad(`Role ini masih dipakai ${x.dipakai} pengguna. Ganti role mereka dulu.`);
      await pool.request().input('k', sql.VarChar(20), kode).query(`DELETE FROM UserRole WHERE kode=@k`);
      return ok('Role dihapus');
    }
    return bad('Aksi tidak dikenal');
  } catch (err: any) {
    return NextResponse.json({ success: false, error: belumMigrasi(err.message) ? 'Tabel role belum ada. Jalankan migrasi 15.' : err.message }, { status: 500 });
  }
}
