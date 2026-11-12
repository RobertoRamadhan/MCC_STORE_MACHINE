import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');
import { koreksiDb, keDb } from '../_lib/waktu';

/* =====================================================================
   API Riwayat transaksi per mesin (hanya membaca data)
   GET /api/riwayat?dari=2026-07-01&sampai=2026-10-02
   Setiap baris: tipe (in/out/return), tanggal, part, jumlah, jenis mesin, area,
   unit (khusus part keluar dari permintaan teknisi), oleh, referensi, keterangan,
   request_id (untuk foto siapkan/verifikasi) dan foto spare part.
   Kolom opsional (keterangan/catatan/alasan) dicek dulu, karena tiap database bisa berbeda.
   ===================================================================== */

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const hariIni = new Date();
    const sampai = q.get('sampai') ? new Date(q.get('sampai') + 'T23:59:59') : hariIni;
    const dari = q.get('dari') ? new Date(q.get('dari') + 'T00:00:00') : new Date(hariIni.getTime() - 90 * 86400000);
    if (isNaN(+dari) || isNaN(+sampai)) return NextResponse.json({ success: false, error: 'Tanggal tidak valid' }, { status: 400 });

    const pool = await sql.connect(getDbConfig());
    const ada = async (t: string, c: string) => (await pool.request().query(`SELECT COL_LENGTH('dbo.${t}','${c}') AS n`)).recordset[0]?.n != null;
    const [poKet, piCat, rpCat, rpAls, poReq] = await Promise.all([
      ada('PartOut', 'keterangan'), ada('PartIn', 'catatan'), ada('ReturnParts', 'catatan'), ada('ReturnParts', 'alasan'), ada('PartOut', 'request_id'),
    ]);
    const A = 'CAST(rp.alasan AS NVARCHAR(200))', C = 'CAST(rp.catatan AS NVARCHAR(200))';
    const ketRet = rpAls && rpCat ? `CONCAT(${A}, CASE WHEN ${C} IS NULL OR ${C} = '' THEN '' ELSE N' · ' + ${C} END)`
      : rpAls ? A : rpCat ? C : 'NULL';

    const kor = await koreksiDb(pool); // filter tanggal memakai jam database (lihat _lib/waktu.ts)
    const r = await pool.request().input('dari', sql.DateTime, keDb(dari, kor)).input('sampai', sql.DateTime, keDb(sampai, kor)).query(`
      WITH t AS (
        SELECT 'out' AS tipe, po.id, po.tanggal_keluar AS tanggal, po.spare_part_id, po.jumlah_keluar AS jumlah,
               ${poReq ? 'r.mesin_id' : 'NULL'} AS unit_id, po.nomor_wo AS ref,
               COALESCE(NULLIF(${poReq ? 'r.teknisi_nama' : "''"}, ''), tk.nama, '') AS oleh, po.mesin_area AS area_teks,
               ${poKet ? 'CAST(po.keterangan AS NVARCHAR(400))' : 'NULL'} AS keterangan, ${poReq ? 'po.request_id' : 'NULL'} AS request_id
        FROM PartOut po
        ${poReq ? 'LEFT JOIN PartOutRequests r ON r.id = po.request_id' : ''}
        LEFT JOIN Users tk ON tk.id = po.teknisi_id
        WHERE po.tanggal_keluar BETWEEN @dari AND @sampai
        UNION ALL
        SELECT 'in', pi.id, pi.tanggal_masuk, pi.spare_part_id, pi.jumlah_masuk, NULL, pi.nomor_do, '', NULL,
               ${piCat ? 'CAST(pi.catatan AS NVARCHAR(400))' : 'NULL'}, NULL
        FROM PartIn pi WHERE pi.tanggal_masuk BETWEEN @dari AND @sampai
        UNION ALL
        SELECT 'return', rp.id, rp.tanggal_return, rp.spare_part_id, rp.jumlah_return, NULL, rp.nomor_do, '', NULL,
               CAST(${ketRet} AS NVARCHAR(400)), NULL
        FROM ReturnParts rp WHERE rp.tanggal_return BETWEEN @dari AND @sampai
      )
      SELECT t.tipe, t.id, t.tanggal, t.spare_part_id, t.jumlah, t.ref, t.oleh, t.area_teks, t.keterangan, t.request_id,
             sp.nama_part, sp.kode_12nc, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin, sp.foto_url AS foto_part,
             u.id AS unit_id, u.nomor_unit,
             j.id AS jenis_id, j.nama AS jenis_nama, j.area
      FROM t
      LEFT JOIN SpareParts sp ON sp.id = t.spare_part_id
      LEFT JOIN Mesin u ON u.id = t.unit_id
      LEFT JOIN MesinJenis j ON j.id = COALESCE(u.jenis_id, sp.mesin_jenis_id)
      ORDER BY t.tanggal DESC
    `);
    return NextResponse.json({ success: true, dari, sampai, data: r.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
