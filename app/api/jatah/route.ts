import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');
import { adaTabelJatah, muatBaris, selaraskan, aturMesin, selaraskanPart, kebutuhanMesin, BarisJatah } from '../_lib/jatah';

/* =====================================================================
   Jatah stok per mesin (migrasi 18)
   GET  /api/jatah?part=ID                      -> mesin pemakai + kebutuhan + jatah
   GET  /api/jatah?pratinjau=1&part=ID|nama=..|kode=..&qty=N&mesin=ID:QPU,ID:QPU&utama=NamaMesin
                                                -> simulasi pembagian Part In (tidak menyimpan)
   GET  /api/jatah?peta=1                       -> semua part bersama (untuk web Teknisi)
   GET  /api/jatah?riwayat=1&dari=YYYY-MM-DD&sampai=YYYY-MM-DD  -> riwayat pinjam jatah
   POST /api/jatah { aksi:'atur', part_id, mesin:[{id, qty_per_unit}] }
   ===================================================================== */

const belum = () => NextResponse.json({ success: false, aktif: false, error: 'Fitur jatah per mesin butuh migrasi 18. Jalankan dulu di SSMS.' });

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const pool = await sql.connect(getDbConfig());
    const rq = () => pool.request();
    if (!(await adaTabelJatah(rq))) return belum();

    if (q.get('peta')) {
      const r = await rq().query(`
        SELECT pm.spare_part_id, pm.mesin_jenis_id, pm.qty_per_unit, pm.jatah, ISNULL(sp.stok_saat_ini,0) AS stok,
               (SELECT COUNT(*) FROM Mesin m WHERE m.jenis_id = pm.mesin_jenis_id AND ISNULL(m.is_active,1)=1) AS unit
        FROM PartMesin pm JOIN SpareParts sp ON sp.id = pm.spare_part_id
        WHERE pm.spare_part_id IN (SELECT spare_part_id FROM PartMesin GROUP BY spare_part_id HAVING COUNT(*) >= 2)`);
      const per: Record<number, any[]> = {};
      r.recordset.forEach((x: any) => { (per[x.spare_part_id] ??= []).push(x); });
      const data = Object.entries(per).map(([pid, rows]) => {
        const j = selaraskan(rows as any, rows[0].stok);
        return { part_id: Number(pid), mesin: rows.map((x: any, i: number) => ({ id: x.mesin_jenis_id, jatah: j[i] })) };
      });
      return NextResponse.json({ success: true, aktif: true, data });
    }

    if (q.get('riwayat')) {
      const dari = new Date((q.get('dari') || '2000-01-01') + 'T00:00:00');
      const s = new Date((q.get('sampai') || new Date().toISOString().slice(0, 10)) + 'T00:00:00'); s.setDate(s.getDate() + 1);
      const r = await rq().input('dari', sql.DateTime, dari).input('sampai', sql.DateTime, s).query(`
        SELECT pj.id, pj.created_at, pj.qty, pj.teknisi_nama, pj.mesin_area, pj.request_id,
               sp.nama_part, sp.kode_12nc, ke.nama AS ke_mesin, dr.nama AS dari_mesin
        FROM PinjamJatah pj
        LEFT JOIN SpareParts sp ON sp.id = pj.spare_part_id
        LEFT JOIN MesinJenis ke ON ke.id = pj.ke_mesin_id
        LEFT JOIN MesinJenis dr ON dr.id = pj.dari_mesin_id
        WHERE pj.created_at >= @dari AND pj.created_at < @sampai
        ORDER BY pj.created_at DESC`);
      return NextResponse.json({ success: true, aktif: true, data: r.recordset });
    }

    // Cari part (id / 12NC / nama)
    let partId = Number(q.get('part')) || 0;
    if (!partId && (q.get('kode') || q.get('nama'))) {
      const kode = String(q.get('kode') || '').trim(), nama = String(q.get('nama') || '').trim();
      const r = kode
        ? await rq().input('k', sql.VarChar(50), kode).query(`SELECT TOP 1 id FROM SpareParts WHERE LTRIM(RTRIM(kode_12nc)) = @k`)
        : { recordset: [] as any[] };
      partId = r.recordset[0]?.id
        || (nama ? (await rq().input('n', sql.VarChar(200), nama).query(`SELECT TOP 1 id FROM SpareParts WHERE LOWER(LTRIM(RTRIM(nama_part))) = LOWER(@n)`)).recordset[0]?.id : 0)
        || 0;
    }
    const info = partId ? (await rq().input('pid', sql.Int, partId).query(`
      SELECT sp.id, sp.nama_part, ISNULL(sp.stok_saat_ini,0) AS stok, sp.mesin_jenis_id, j.nama AS mesin_utama
      FROM SpareParts sp LEFT JOIN MesinJenis j ON j.id = sp.mesin_jenis_id WHERE sp.id=@pid`)).recordset[0] : null;
    const lama: BarisJatah[] = partId ? await muatBaris(rq, partId) : [];

    if (q.get('pratinjau')) {
      const qty = Math.max(0, parseInt(q.get('qty') || '0') || 0);
      const pilih = String(q.get('mesin') || '').split(',').map(s => s.split(':')).filter(a => Number(a[0]) > 0)
        .map(a => ({ id: Number(a[0]), qty_per_unit: Math.max(1, parseInt(a[1]) || 1) }));
      // Mesin utama: dari part (kalau sudah ada) atau dari nama mesin di form Part In
      let utamaId = info?.mesin_jenis_id ? Number(info.mesin_jenis_id) : 0;
      if (!utamaId && q.get('utama')) {
        utamaId = (await rq().input('n', sql.NVarChar(100), String(q.get('utama')).trim())
          .query(`SELECT TOP 1 id FROM MesinJenis WHERE LTRIM(RTRIM(nama)) = @n ORDER BY is_active DESC, id`)).recordset[0]?.id || 0;
      }
      const ids = new Map<number, number>();
      if (utamaId) ids.set(utamaId, lama.find(r => r.mesin_jenis_id === utamaId)?.qty_per_unit || 1);
      // Kalau admin tidak memilih apa-apa, pakai daftar yang sudah tersimpan
      (pilih.length ? pilih : lama.map(r => ({ id: r.mesin_jenis_id, qty_per_unit: r.qty_per_unit }))).forEach(m => ids.set(m.id, m.qty_per_unit));
      if (ids.size < 2) return NextResponse.json({ success: true, aktif: true, bersama: false, part: info, rows: [] });
      const idList = Array.from(ids.keys());
      const meta = (await rq().query(`
        SELECT j.id, j.nama, (SELECT COUNT(*) FROM Mesin m WHERE m.jenis_id = j.id AND ISNULL(m.is_active,1)=1) AS unit
        FROM MesinJenis j WHERE j.id IN (${idList.join(',')})`)).recordset as any[];
      const rows: BarisJatah[] = idList.map(id => {
        const m = meta.find(x => x.id === id); const l = lama.find(x => x.mesin_jenis_id === id);
        return { mesin_jenis_id: id, nama: m?.nama || '?', qty_per_unit: ids.get(id) || 1, unit: Number(m?.unit) || 0, jatah: l ? Number(l.jatah) || 0 : 0 };
      });
      const stok = Number(info?.stok) || 0;
      const sebelum = selaraskan(rows, stok);
      const sesudah = selaraskan(rows.map((r, i) => ({ ...r, jatah: sebelum[i] })), stok + qty);
      return NextResponse.json({ success: true, aktif: true, bersama: true, part: info,
        rows: rows.map((r, i) => ({ ...r, kebutuhan: kebutuhanMesin(r), jatah_sebelum: sebelum[i], jatah_sesudah: sesudah[i], tambah: sesudah[i] - sebelum[i] })) });
    }

    if (!partId) return NextResponse.json({ success: false, error: 'Part tidak ditemukan' }, { status: 404 });
    const j = selaraskan(lama, Number(info?.stok) || 0);
    return NextResponse.json({ success: true, aktif: true, part: info, bersama: lama.length >= 2,
      rows: lama.map((r, i) => ({ ...r, kebutuhan: kebutuhanMesin(r), jatah: lama.length >= 2 ? j[i] : Number(info?.stok) || 0 })) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());
    const rq = () => pool.request();
    if (!(await adaTabelJatah(rq))) return belum();
    if (b.aksi !== 'atur') return NextResponse.json({ success: false, error: 'Aksi tidak dikenal' }, { status: 400 });
    const partId = Number(b.part_id);
    if (!partId) return NextResponse.json({ success: false, error: 'Part tidak valid' }, { status: 400 });
    await aturMesin(rq, partId, Array.isArray(b.mesin) ? b.mesin : []);
    const { rows, jatah } = await selaraskanPart(rq, partId);
    return NextResponse.json({ success: true, message: rows.length >= 2 ? `Dipakai ${rows.length} mesin, jatah dibagi ulang` : 'Part hanya dipakai 1 mesin',
      rows: rows.map((r, i) => ({ ...r, kebutuhan: kebutuhanMesin(r), jatah: jatah[i] })) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
