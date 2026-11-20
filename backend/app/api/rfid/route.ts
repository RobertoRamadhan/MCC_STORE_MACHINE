import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   Login teknisi dengan tap kartu RFID (halaman /rfid).
   Perubahan dari versi lama:
   - Koneksi database pakai setelan yang sama dengan halaman lain (getDbConfig),
     bukan password yang ditulis langsung di file ini.
   - Nomor kartu dicocokkan tanpa spasi, tanpa beda huruf besar/kecil, dan tanpa
     nol di depan (0002912555 = 2912555).
   - Akun admin juga boleh tap (diperlakukan seperti teknisi sesuai bagiannya).
   - Pesan gagal lebih jelas: kartu belum terdaftar / akun nonaktif / database.
   ===================================================================== */

const bakuRfid = (v: any) => {
  const s = String(v ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d+$/.test(s) ? s.replace(/^0+/, '') : s;
};
const SQL_RFID = `CASE WHEN UPPER(LTRIM(RTRIM(u.rfid_tag))) NOT LIKE '%[^0-9]%'
  THEN SUBSTRING(LTRIM(RTRIM(u.rfid_tag)), PATINDEX('%[^0]%', LTRIM(RTRIM(u.rfid_tag)) + 'x'), 50)
  ELSE UPPER(REPLACE(LTRIM(RTRIM(u.rfid_tag)), ' ', '')) END`;

export async function POST(req: NextRequest) {
  let pool: any;
  try {
    const { rfid } = await req.json();
    const mentah = String(rfid ?? '').trim();
    if (!mentah) return NextResponse.json({ success: false, error: 'RFID kosong' }, { status: 400 });
    const baku = bakuRfid(mentah);

    try { pool = await sql.connect(getDbConfig()); }
    catch (e: any) {
      return NextResponse.json({ success: false, error: 'Database tidak terhubung. Hubungi admin (cek SQL Server di Panel PC).', detail: e.message }, { status: 500 });
    }

    const dh = (await pool.request().query(`SELECT COL_LENGTH('dbo.Users','dihapus') AS n`)).recordset[0]?.n != null;
    const r = await pool.request()
      .input('rfid', sql.VarChar(50), baku)
      .input('emp', sql.VarChar(50), mentah)
      .query(`
        SELECT TOP 2 u.id, u.nama, u.employee_id, u.role, u.rfid_tag, u.gender,
               ISNULL(u.bagian, '-') AS bagian, u.nomor_mesin, CAST(ISNULL(u.is_active,1) AS BIT) AS is_active
        FROM Users u
        WHERE ((u.rfid_tag IS NOT NULL AND ${SQL_RFID} = @rfid) OR LTRIM(RTRIM(u.employee_id)) = @emp)
          ${dh ? 'AND ISNULL(u.dihapus,0) = 0' : ''}
        ORDER BY CASE WHEN ISNULL(u.is_active,1)=1 THEN 0 ELSE 1 END, u.id`);

    const aktif = r.recordset.filter((u: any) => u.is_active);
    if (!r.recordset.length) {
      return NextResponse.json({ success: false, kode: 'tidak_terdaftar', error: `Kartu ${mentah} belum terdaftar. Minta admin mendaftarkan kartu ini di Kelola Pengguna.` });
    }
    if (!aktif.length) {
      return NextResponse.json({ success: false, kode: 'nonaktif', error: `Akun ${r.recordset[0].nama} sedang nonaktif. Hubungi admin.` });
    }
    const { is_active, ...user } = aktif[0];
    // Mesin tambahan (migrasi 17) -> ditampilkan sebagai pintasan "Mesin saya" di web Teknisi
    let mesin_tambahan: { id: number; nama: string }[] = [];
    const um = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.UserMesin', N'U') AS id`)).recordset[0]?.id != null;
    if (um) {
      mesin_tambahan = (await pool.request().input('u', sql.Int, user.id).query(`
        SELECT j.id, j.nama FROM UserMesin x JOIN MesinJenis j ON j.id = x.mesin_jenis_id
        WHERE x.user_id = @u AND j.is_active = 1 ORDER BY j.nama`)).recordset;
    }
    return NextResponse.json({ success: true, user: { ...user, mesin_tambahan } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
