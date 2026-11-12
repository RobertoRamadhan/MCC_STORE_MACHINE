import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* =====================================================================
   Kartu stok per spare part (hanya membaca).
   GET /api/kartu-stok?part=ID
   Menjelaskan asal angka stok: semua Part In (+), Part Out (-) dan Return ke supplier (-),
   urut waktu dengan saldo berjalan. Selisih yang tidak punya riwayat (stok awal yang
   diisi saat part dibuat, atau data lama sebelum sistem) ditampilkan sebagai "Stok awal".
   ===================================================================== */
export async function GET(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('part')) || 0;
    if (!id) return NextResponse.json({ success: false, error: 'Part tidak valid' }, { status: 400 });
    const pool = await sql.connect(getDbConfig());
    const p = (await pool.request().input('id', sql.Int, id).query(`
      SELECT id, nama_part, kode_12nc, ISNULL(stok_saat_ini,0) AS stok, created_at FROM SpareParts WHERE id=@id`)).recordset[0];
    if (!p) return NextResponse.json({ success: false, error: 'Part tidak ditemukan' }, { status: 404 });

    const ada = async (t: string) => (await pool.request().query(`SELECT OBJECT_ID(N'dbo.${t}', N'U') AS x`)).recordset[0]?.x != null;
    // Kolom opsional dicek dulu: tiap database bisa beda (mis. ReturnParts tanpa kolom "alasan")
    const kol = async (t: string, c: string) => (await pool.request().query(`SELECT COL_LENGTH('dbo.${t}','${c}') AS n`)).recordset[0]?.n != null;
    const K = async (t: string, alias: string, cols: string[]) => (await Promise.all(cols.map(async c => (await kol(t, c)) ? `${alias}.${c}` : `NULL AS ${c}`))).join(', ');
    const rows: any[] = [];
    const masuk = (await pool.request().input('id', sql.Int, id).query(`
      SELECT pi.id, pi.tanggal_masuk AS tgl, ISNULL(pi.jumlah_masuk,0) AS qty, ${await K('PartIn', 'pi', ['nomor_do', 'brand', 'kondisi', 'catatan'])}, su.nama_supplier
      FROM PartIn pi LEFT JOIN Suppliers su ON su.id = pi.supplier_id
      WHERE pi.spare_part_id=@id`)).recordset;
    masuk.forEach((r: any) => rows.push({ jenis: 'Part In', tgl: r.tgl, qty: Number(r.qty), ref: r.nomor_do ? String(r.nomor_do) : `IN-${r.id}`,
      ket: [r.nama_supplier, r.brand && `merk ${r.brand}`, r.kondisi && r.kondisi !== 'Baik' && r.kondisi, r.catatan].filter(Boolean).join(' · ') }));
    const keluar = (await pool.request().input('id', sql.Int, id).query(`
      SELECT po.id, po.tanggal_keluar AS tgl, ISNULL(po.jumlah_keluar,0) AS qty, ${await K('PartOut', 'po', ['nomor_wo', 'mesin_area', 'request_id', 'keterangan'])}, t.nama AS teknisi
      FROM PartOut po LEFT JOIN Users t ON t.id = po.teknisi_id
      WHERE po.spare_part_id=@id`)).recordset;
    keluar.forEach((r: any) => rows.push({ jenis: 'Part Out', tgl: r.tgl, qty: -Number(r.qty), ref: r.request_id ? `Request ${r.request_id}` : `OUT-${r.id}`,
      ket: [r.keterangan, r.teknisi, r.mesin_area, r.nomor_wo && `WO ${r.nomor_wo}`].filter(Boolean).join(' · ') }));
    if (await ada('ReturnParts')) {
      const ret = (await pool.request().input('id', sql.Int, id).query(`
        SELECT rp.id, rp.tanggal_return AS tgl, ISNULL(rp.jumlah_return,0) AS qty, ${await K('ReturnParts', 'rp', ['nomor_do', 'alasan', 'catatan'])}, s.nama_supplier
        FROM ReturnParts rp LEFT JOIN Suppliers s ON s.id = rp.supplier_id WHERE rp.spare_part_id=@id`)).recordset;
      ret.forEach((r: any) => rows.push({ jenis: 'Return', tgl: r.tgl, qty: -Number(r.qty), ref: r.nomor_do ? String(r.nomor_do) : `RET-${r.id}`,
        ket: [r.nama_supplier, r.alasan, r.catatan].filter(Boolean).join(' · ') }));
    }
    rows.sort((a, b) => new Date(a.tgl || 0).getTime() - new Date(b.tgl || 0).getTime());
    const totalMasuk = rows.filter(r => r.qty > 0).reduce((s, r) => s + r.qty, 0);
    const totalKeluar = -rows.filter(r => r.jenis === 'Part Out').reduce((s, r) => s + r.qty, 0);
    const totalReturn = -rows.filter(r => r.jenis === 'Return').reduce((s, r) => s + r.qty, 0);
    const awal = Number(p.stok) - (totalMasuk - totalKeluar - totalReturn);
    let saldo = awal;
    const kartu = rows.map(r => { saldo += r.qty; return { ...r, saldo }; });
    return NextResponse.json({ success: true, part: p,
      ringkas: { awal, masuk: totalMasuk, keluar: totalKeluar, retur: totalReturn, stok: Number(p.stok) },
      rows: kartu.reverse() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
