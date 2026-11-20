import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');
import { adaTabelJatah, selaraskanPart } from '../_lib/jatah';
import { kunciStok, tetapkanStok } from '../_lib/stok';

/* =====================================================================
   Part Out
   GET  /api/partout            -> riwayat Part Out (200 terbaru)
   POST /api/partout            -> Part Out manual oleh admin (koreksi stok, dipakai tanpa request, rusak, dll.)
        { spare_part_id, spare_part_nama?, jumlah, nomor_wo?, mesin_area?, teknisi_id?, keterangan, jenis?, admin_nama? }
        - Alasan (keterangan) wajib, jumlah tidak boleh melebihi stok.
        - Kalau tidak ada teknisi, transaksi dicatat atas nama admin yang login.
        - Stok dan riwayat disimpan dalam satu transaksi (dulu riwayat tetap tersimpan walau stok tidak berkurang).
   ===================================================================== */

export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const result = await pool.request().query(`
      SELECT TOP 200
        po.id, po.spare_part_id, sp.nama_part, po.jumlah_keluar, po.nomor_wo, po.mesin_area,
        po.teknisi_id, po.keterangan, po.tanggal_keluar, t.nama AS teknisi_nama
      FROM PartOut po
      LEFT JOIN SpareParts sp ON sp.id = po.spare_part_id
      LEFT JOIN Users t ON t.id = po.teknisi_id
      ORDER BY po.tanggal_keluar DESC
    `);
    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let trx: any = null;
  try {
    const b = await req.json();
    const qty = parseInt(b.jumlah) || 0;
    const alasan = String(b.keterangan ?? '').trim();
    const jenis = String(b.jenis ?? '').trim();
    if (qty <= 0) return NextResponse.json({ success: false, error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    if (!alasan) return NextResponse.json({ success: false, error: 'Alasan / keterangan wajib diisi supaya tercatat di kartu stok' }, { status: 400 });

    const pool = await sql.connect(getDbConfig());
    // Cari part: id dulu, baru nama persis
    let part: any = null;
    if (Number(b.spare_part_id) > 0) part = (await pool.request().input('id', sql.Int, Number(b.spare_part_id)).query(`SELECT id, nama_part, ISNULL(stok_saat_ini,0) AS stok FROM SpareParts WHERE id=@id`)).recordset[0];
    if (!part && b.spare_part_nama) part = (await pool.request().input('n', sql.VarChar(200), String(b.spare_part_nama).trim()).query(`SELECT TOP 1 id, nama_part, ISNULL(stok_saat_ini,0) AS stok FROM SpareParts WHERE LTRIM(RTRIM(nama_part))=@n`)).recordset[0];
    if (!part) return NextResponse.json({ success: false, error: 'Spare part tidak ditemukan. Pilih dari daftar yang muncul saat mengetik.' }, { status: 400 });

    // Pencatat: teknisi kalau dipilih, kalau tidak admin yang login (kolom teknisi_id wajib terisi)
    let pencatat = Number(b.teknisi_id) || 0;
    let namaAdmin = String(b.admin_nama ?? '').trim();
    if (!pencatat) {
      const rq = pool.request().input('n', sql.VarChar(100), namaAdmin);
      const u = (await rq.query(`
        SELECT TOP 1 id, nama FROM Users
        WHERE role = 'admin' AND ISNULL(is_active,1) = 1
        ORDER BY CASE WHEN LTRIM(RTRIM(nama)) = @n THEN 0 ELSE 1 END, id`)).recordset[0];
      if (!u) return NextResponse.json({ success: false, error: 'Tidak ada akun admin aktif untuk mencatat Part Out ini' }, { status: 400 });
      pencatat = u.id; if (!namaAdmin) namaAdmin = u.nama;
    }
    const ket = (`[${jenis || 'Manual'}${!Number(b.teknisi_id) ? ` · oleh ${namaAdmin}` : ''}] ${alasan}`).slice(0, 200);

    trx = new sql.Transaction(pool);
    await trx.begin();
    const rqS = () => new sql.Request(trx);
    const stokSebelum = await kunciStok(rqS, part.id);
    if (stokSebelum < qty) {
      await trx.rollback(); trx = null;
      return NextResponse.json({ success: false, error: `Stok ${part.nama_part} hanya ${stokSebelum}. Jumlah tidak boleh melebihi stok.` }, { status: 400 });
    }
    await new sql.Request(trx)
      .input('pid', sql.Int, part.id).input('qty', sql.Int, qty)
      .input('wo', sql.VarChar(50), b.nomor_wo ? String(b.nomor_wo).slice(0, 50) : null)
      .input('area', sql.VarChar(100), b.mesin_area ? String(b.mesin_area).slice(0, 100) : null)
      .input('tid', sql.Int, pencatat).input('ket', sql.VarChar(255), ket)
      .query(`INSERT INTO PartOut (spare_part_id, jumlah_keluar, nomor_wo, mesin_area, teknisi_id, keterangan, tanggal_keluar)
              VALUES (@pid, @qty, @wo, @area, @tid, @ket, GETDATE())`);
    // Stok akhir = stok sebelum - jumlah (tepat 1x, walaupun database punya trigger stok)
    await tetapkanStok(rqS, part.id, stokSebelum, -qty);
    // Part dipakai banyak mesin (migrasi 18): jatah diselaraskan dengan stok baru
    const rqT = () => new sql.Request(trx);
    if (await adaTabelJatah(rqT)) await selaraskanPart(rqT, part.id);
    await trx.commit(); trx = null;

    const stokBaru = stokSebelum - qty;
    return NextResponse.json({ success: true, message: `Part OUT ${part.nama_part} -${qty} pcs tercatat. Stok sekarang ${stokBaru}.`, stok_baru: stokBaru });
  } catch (err: any) {
    if (trx) { try { await trx.rollback(); } catch { /* sudah batal */ } }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
