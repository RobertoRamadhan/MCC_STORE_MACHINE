import { NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   GET /api/notif  (hanya membaca)
   Ringkasan untuk program notifikasi Windows di Admin PC (backend/tools/notifikasi-pc/MCC-Notif.ps1),
   supaya notifikasi tetap muncul walaupun browser / aplikasi ditutup.
   - pending : request yang menunggu disiapkan admin
   - reject  : request yang ditolak teknisi saat verifikasi (50 terakhir)
   - low     : part dengan stok <= min stok (min stok > 0)
   ===================================================================== */
export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const pending = (await pool.request().query(`
      SELECT TOP 50 id, teknisi_nama, part_nama, jumlah, ISNULL(is_urgent,0) AS urgent
      FROM PartOutRequests WHERE status = 'Pending' ORDER BY id DESC`)).recordset;
    const reject = (await pool.request().query(`
      SELECT TOP 50 id, teknisi_nama, part_nama, jumlah, alasan_tolak
      FROM PartOutRequests WHERE status = 'Rejected' AND alasan_tolak LIKE 'Verifikasi%' ORDER BY id DESC`)).recordset;
    const low = (await pool.request().query(`
      SELECT id, nama_part, ISNULL(stok_saat_ini,0) AS stok, ISNULL(reorder_point,0) AS min_stok, LTRIM(RTRIM(nomor_bin)) AS rak
      FROM SpareParts
      WHERE ISNULL(is_active,1) = 1 AND ISNULL(reorder_point,0) > 0 AND ISNULL(stok_saat_ini,0) <= reorder_point
      ORDER BY nama_part`)).recordset;
    return NextResponse.json({ success: true, pending, reject, low });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
