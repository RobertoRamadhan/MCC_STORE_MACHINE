import { NextRequest, NextResponse } from 'next/server';
import { adaTabelMinUnit, samakanMinStok } from '../_lib/minunit';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   Min stok per unit mesin (migrasi 22)
   GET  /api/min-unit?part=ID  -> mesin pemakai part + semua unit aktifnya + min per unit
   POST /api/min-unit { part_id, rows: [{ unit_id, min_qty }] }
        -> simpan; min stok part (reorder_point) = jumlah semua unit aktif
   ===================================================================== */
const belum = () => NextResponse.json({ success: true, aktif: false, pesan: 'Fitur min stok per unit butuh migrasi 22 (22_min_stok_per_unit.sql). Jalankan dulu di SSMS.' });

export async function GET(req: NextRequest) {
  try {
    const partId = Number(req.nextUrl.searchParams.get('part')) || 0;
    if (!partId) return NextResponse.json({ success: false, error: 'Part tidak valid' }, { status: 400 });
    const pool = await sql.connect(getDbConfig());
    const rq = () => pool.request();
    if (!(await adaTabelMinUnit(rq))) return belum();
    const adaPM = (await rq().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
    const part = (await rq().input('pid', sql.Int, partId).query(`
      SELECT id, nama_part, mesin_jenis_id, ISNULL(reorder_point,0) AS reorder_point FROM SpareParts WHERE id = @pid`)).recordset[0];
    if (!part) return NextResponse.json({ success: false, error: 'Part tidak ditemukan' }, { status: 404 });
    // Mesin pemakai: mesin utama + mesin di "Dipakai di mesin"
    const jenis = (await rq().input('pid', sql.Int, partId).query(`
      SELECT j.id, j.nama, j.area FROM MesinJenis j
      WHERE j.id = (SELECT mesin_jenis_id FROM SpareParts WHERE id = @pid)
      ${adaPM ? 'OR j.id IN (SELECT mesin_jenis_id FROM PartMesin WHERE spare_part_id = @pid)' : ''}
      ORDER BY j.nama`)).recordset;
    const unit = jenis.length ? (await rq().input('pid', sql.Int, partId).query(`
      SELECT m.id, m.jenis_id, m.nomor_unit, ISNULL(pmu.min_qty,0) AS min_qty
      FROM Mesin m
      LEFT JOIN PartMinUnit pmu ON pmu.unit_id = m.id AND pmu.spare_part_id = @pid
      WHERE ISNULL(m.is_active,1) = 1 AND m.jenis_id IN (${jenis.map((j: any) => Number(j.id)).join(',')})
      ORDER BY m.jenis_id, CASE WHEN ISNUMERIC(m.nomor_unit) = 1 THEN CAST(m.nomor_unit AS INT) ELSE 9999 END, m.nomor_unit`)).recordset : [];
    return NextResponse.json({ success: true, aktif: true, part, mesin: jenis.map((j: any) => ({ ...j, unit: unit.filter((u: any) => u.jenis_id === j.id) })) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let tx: any = null;
  try {
    const b = await req.json();
    const partId = Number(b.part_id) || 0;
    const rows: { unit_id: number; min_qty: number }[] = (Array.isArray(b.rows) ? b.rows : [])
      .map((r: any) => ({ unit_id: Number(r.unit_id) || 0, min_qty: Math.max(0, Math.min(100000, parseInt(r.min_qty) || 0)) }))
      .filter((r: any) => r.unit_id > 0);
    if (!partId) return NextResponse.json({ success: false, error: 'Part tidak valid' }, { status: 400 });
    const pool = await sql.connect(getDbConfig());
    if (!(await adaTabelMinUnit(() => pool.request()))) return belum();
    tx = new sql.Transaction(pool); await tx.begin();
    const rq = () => new sql.Request(tx);
    for (const r of rows) {
      if (r.min_qty > 0) {
        await rq().input('pid', sql.Int, partId).input('uid', sql.Int, r.unit_id).input('q', sql.Int, r.min_qty).query(`
          UPDATE PartMinUnit SET min_qty = @q, updated_at = GETDATE() WHERE spare_part_id = @pid AND unit_id = @uid;
          IF @@ROWCOUNT = 0 INSERT INTO PartMinUnit (spare_part_id, unit_id, min_qty) VALUES (@pid, @uid, @q);`);
      } else {
        await rq().input('pid', sql.Int, partId).input('uid', sql.Int, r.unit_id)
          .query(`DELETE FROM PartMinUnit WHERE spare_part_id = @pid AND unit_id = @uid`);
      }
    }
    const total = await samakanMinStok(rq, partId);
    await tx.commit(); tx = null;
    return NextResponse.json({ success: true, total,
      message: total == null ? 'Min per unit dikosongkan. Min stok part kembali diisi manual.' : `Min per unit disimpan. Min stok part = ${total} (jumlah semua unit).` });
  } catch (err: any) {
    if (tx) { try { await tx.rollback(); } catch { /* batal */ } }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
