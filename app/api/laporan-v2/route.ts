import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
import { selaraskan } from '../_lib/jatah';
import { xlsxDenganFoto, bacaGambar } from '../_lib/xlsxfoto';
import { koreksiDb, dariDb, keDb, fmtWaktuLengkap, fmtTanggal, fmtJam, fmtHari } from '../_lib/waktu';

/* =====================================================================
   Laporan versi baru
   GET /api/laporan-v2?jenis=audit|stok|stok_semua|pemakaian|periode&dari=YYYY-MM-DD&sampai=YYYY-MM-DD&area=semua|molding|nonmolding
   Tambahkan &format=pdf untuk laporan audit versi cetak.
   Hanya MEMBACA database. Laporan lama (/api/laporan) tidak diubah.
   ===================================================================== */

// Daftar kata kunci mesin non-molding (sama dengan yang dipakai di halaman Monitoring)
const NM_LIST = ['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];
// Area dari Master Data mesin (MesinJenis.area) supaya mesin baru otomatis masuk area yang benar.
// Daftar kata kunci di atas hanya cadangan kalau nama mesin tidak ditemukan di master.
let PETA_AREA: { n: string; a: 'molding' | 'nonmolding' }[] = [];
const muatPetaArea = async (pool: any) => {
  try {
    const mj = (await pool.request().query(`SELECT nama, area FROM MesinJenis WHERE nama IS NOT NULL`)).recordset;
    PETA_AREA = mj.map((x: any) => ({ n: String(x.nama).trim().toLowerCase(), a: /non/i.test(String(x.area || '')) ? 'nonmolding' as const : 'molding' as const }))
      .filter((x: any) => x.n.length >= 2).sort((a: any, b: any) => b.n.length - a.n.length);
  } catch { PETA_AREA = []; }
};
const labelAreaDari = (a: string) => a === 'molding' ? 'Molding' : a === 'nonmolding' ? 'Non-molding' : 'Consumable / lainnya';
const areaOf = (mesin: any): 'molding' | 'nonmolding' | 'kosong' => {
  const m = String(mesin || '').trim().toLowerCase();
  if (!m) return 'kosong';
  const hit = PETA_AREA.find(x => m.includes(x.n));
  if (hit) return hit.a;
  return NM_LIST.some(k => m.includes(k.toLowerCase())) ? 'nonmolding' : 'molding';
};
const cocokArea = (mesin: any, area: string) => area === 'semua' || areaOf(mesin) === area;

const parseTanggal = (v: string | null, fallback: Date) => {
  const d = v ? new Date(v + 'T00:00:00') : fallback;
  return isNaN(d.getTime()) ? fallback : d;
};

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams;
    const jenis = q.get('jenis') || 'audit';
    const area = ['molding', 'nonmolding'].includes(q.get('area') || '') ? String(q.get('area')) : 'semua';
    const now = new Date();
    const dari = parseTanggal(q.get('dari'), new Date(now.getFullYear(), now.getMonth(), 1));
    const sampaiInput = parseTanggal(q.get('sampai'), now);
    const sampai = new Date(sampaiInput.getFullYear(), sampaiInput.getMonth(), sampaiInput.getDate() + 1); // eksklusif

    const pool = await sql.connect(getDbConfig());
    await muatPetaArea(pool);
    const kor = await koreksiDb(pool); // koreksi jam database (lihat _lib/waktu.ts)
    const range = (r: any) => r.input('dari', sql.DateTime, keDb(dari, kor)).input('sampai', sql.DateTime, keDb(sampai, kor));

    /* ---------- 1. Audit pengambilan part ---------- */
    if (jenis === 'audit') {
      const adaAlasan = (await pool.request().query(`SELECT COL_LENGTH('PartOutRequests','alasan_ambil') AS n`)).recordset[0]?.n != null;
      const res = await range(pool.request()).query(`
        SELECT r.id, r.teknisi_nama, r.part_nama, sp.kode_12nc, r.jumlah, r.nomor_wo, r.mesin_area, ${adaAlasan ? 'r.alasan_ambil' : 'NULL AS alasan_ambil'},
               ISNULL(r.is_urgent,0) AS is_urgent, r.created_at, r.prepared_at, r.approved_at,
               (SELECT COUNT(*) FROM RequestFoto f WHERE f.request_id = r.id) AS jumlah_foto
        FROM PartOutRequests r
        LEFT JOIN SpareParts sp ON sp.id = r.spare_part_id
        WHERE r.status = 'Approved'
          AND ISNULL(r.approved_at, r.created_at) >= @dari AND ISNULL(r.approved_at, r.created_at) < @sampai
        ORDER BY ISNULL(r.approved_at, r.created_at) DESC`);
      const ringkasRes = await range(pool.request()).query(`
        SELECT status, alasan_tolak, mesin_area, jumlah, created_at, approved_at
        FROM PartOutRequests WHERE created_at >= @dari AND created_at < @sampai`);

      const rows = res.recordset.filter((r: any) => cocokArea(r.mesin_area, area)).map((r: any) => ({ ...r, area: areaOf(r.mesin_area) }));
      const semua = ringkasRes.recordset.filter((r: any) => cocokArea(r.mesin_area, area));
      const durasi = semua.filter((r: any) => r.approved_at).map((r: any) => (new Date(r.approved_at).getTime() - new Date(r.created_at).getTime()) / 60000);
      const alasan: Record<string, number> = {};
      semua.filter((r: any) => r.status === 'Rejected').forEach((r: any) => { const k = r.alasan_tolak || 'Tanpa alasan (data lama)'; alasan[k] = (alasan[k] || 0) + 1; });
      const ringkasan = {
        total_permintaan: semua.length,
        disetujui: semua.filter((r: any) => r.status === 'Approved').length,
        ditolak: semua.filter((r: any) => r.status === 'Rejected').length,
        menunggu: semua.filter((r: any) => r.status === 'Pending' || r.status === 'Prepared').length,
        total_item_keluar: rows.reduce((a: number, r: any) => a + (r.jumlah || 0), 0),
        mendesak: rows.filter((r: any) => r.is_urgent).length,
        rata_respons_menit: durasi.length ? Math.round(durasi.reduce((a: number, b: number) => a + b, 0) / durasi.length) : null,
        data_respons: durasi.length,
        alasan_tolak: alasan,
      };

      if (q.get('format') === 'pdf' || q.get('format') === 'xlsx') {
        // Foto bukti (RequestFoto) ikut dimuat untuk PDF (pakai &foto=1) dan Excel
        const pakaiFoto = q.get('format') === 'xlsx' || q.get('foto') === '1';
        const foto: Record<number, { siapkan?: string; verifikasi?: string }> = {};
        if (pakaiFoto && rows.length) {
          const ids = rows.map((r: any) => Number(r.id)).filter(Boolean);
          for (let i = 0; i < ids.length; i += 200) {
            const fr = await pool.request().query(`SELECT request_id, tipe_foto, foto_base64 FROM RequestFoto WHERE request_id IN (${ids.slice(i, i + 200).join(',')}) ORDER BY id`);
            fr.recordset.forEach((f: any) => {
              const k = String(f.tipe_foto || '').toLowerCase() === 'siapkan' ? 'siapkan' : 'verifikasi';
              (foto[f.request_id] ??= {})[k] = String(f.foto_base64 || '');
            });
          }
        }
        if (q.get('format') === 'xlsx') return xlsxAudit(rows, ringkasan, dari, sampaiInput, area, foto, kor);
        return pdfAudit(rows, ringkasan, dari, sampaiInput, area, pakaiFoto ? foto : null, kor);
      }
      return NextResponse.json({ success: true, jenis, rows, ringkasan });
    }

    /* ---------- 1b. Stok harian: stok awal hari (before stock), masuk, keluar, return, stok akhir ---------- */
    if (jenis === 'stok_harian') {
      const adaRet = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.ReturnParts', N'U') AS x`)).recordset[0]?.x != null;
      const parts = (await pool.request().query(`
        SELECT id, nama_part, kode_12nc, LTRIM(RTRIM(nomor_bin)) AS nomor_bin, mesin, ISNULL(stok_saat_ini,0) AS stok, ISNULL(reorder_point,0) AS min_stok
        FROM SpareParts WHERE ISNULL(is_active,1) = 1`)).recordset;
      // Semua transaksi dari tanggal "dari" sampai sekarang (dikelompokkan per hari kalender database)
      const ambil = async (tabel: string, kolTgl: string, kolQty: string) => (await pool.request().input('dari', sql.DateTime, keDb(dari, kor)).query(`
        SELECT spare_part_id AS pid, CONVERT(varchar(10), ${kolTgl}, 23) AS hari, SUM(ISNULL(${kolQty},0)) AS qty
        FROM ${tabel} WHERE ${kolTgl} >= @dari AND spare_part_id IS NOT NULL
        GROUP BY spare_part_id, CONVERT(varchar(10), ${kolTgl}, 23)`)).recordset;
      const masuk = await ambil('PartIn', 'tanggal_masuk', 'jumlah_masuk');
      const keluar = await ambil('PartOut', 'tanggal_keluar', 'jumlah_keluar');
      const retur = adaRet ? await ambil('ReturnParts', 'tanggal_return', 'jumlah_return') : [];
      const gerak: Record<number, Record<string, { in: number; out: number; ret: number }>> = {};
      const tambah = (arr: any[], k: 'in' | 'out' | 'ret') => arr.forEach((r: any) => {
        ((gerak[r.pid] ??= {})[r.hari] ??= { in: 0, out: 0, ret: 0 })[k] += Number(r.qty) || 0;
      });
      tambah(masuk, 'in'); tambah(keluar, 'out'); tambah(retur, 'ret');
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const batasDari = iso(dari), batasSampai = iso(sampaiInput);
      const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const rows: any[] = [];
      parts.filter((p: any) => gerak[p.id] && cocokArea(p.mesin, area)).forEach((p: any) => {
        // Mundur dari stok sekarang: stok akhir hari H = stok sekarang - (semua gerakan setelah H)
        const hariUrut = Object.keys(gerak[p.id]).sort().reverse();
        let saldo = Number(p.stok) || 0;
        for (const h of hariUrut) {
          const g = gerak[p.id][h];
          const akhir = saldo, awal = akhir - g.in + g.out + g.ret;
          if (h >= batasDari && h <= batasSampai) {
            const t = new Date(h + 'T00:00:00');
            rows.push({ tanggal: h, hari: HARI[t.getDay()], part_id: p.id, nama_part: p.nama_part, kode_12nc: p.kode_12nc, nomor_bin: p.nomor_bin,
              area: areaOf(p.mesin), mesin: p.mesin, stok_awal: awal, masuk: g.in, keluar: g.out, retur: g.ret, stok_akhir: akhir,
              min_stok: p.min_stok, di_bawah_min: akhir <= p.min_stok });
          }
          saldo = awal;
        }
      });
      rows.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : String(a.nama_part).localeCompare(String(b.nama_part))));
      const ringkasan = {
        part: new Set(rows.map(r => r.part_id)).size, hari: new Set(rows.map(r => r.tanggal)).size,
        masuk: rows.reduce((a, r) => a + r.masuk, 0), keluar: rows.reduce((a, r) => a + r.keluar, 0), retur: rows.reduce((a, r) => a + r.retur, 0),
      };
      return NextResponse.json({ success: true, jenis, rows, ringkasan });
    }

    /* ---------- 2. Stok kritis & reorder ---------- */
    if (jenis === 'stok') {
      const res = await pool.request().query(`
        SELECT sp.id, sp.kode_12nc, sp.nama_part, sp.kategori, sp.mesin, sp.lokasi_simpan, sp.nomor_bin,
               sp.stok_saat_ini, sp.reorder_point, ISNULL(sp.is_critical,0) AS is_critical,
               ISNULL((SELECT SUM(r.jumlah) FROM PartOutRequests r
                       WHERE r.status = 'Approved' AND r.created_at >= DATEADD(day,-30,GETDATE())
                         AND (r.spare_part_id = sp.id OR (r.spare_part_id IS NULL AND LOWER(LTRIM(RTRIM(r.part_nama))) = LOWER(LTRIM(RTRIM(sp.nama_part)))))),0) AS keluar_30_hari
        FROM SpareParts sp
        WHERE ISNULL(sp.is_active,1) = 1 AND sp.stok_saat_ini <= sp.reorder_point
        ORDER BY CASE WHEN sp.stok_saat_ini = 0 THEN 0 ELSE 1 END, ISNULL(sp.is_critical,0) DESC,
                 CAST(sp.stok_saat_ini AS FLOAT) / NULLIF(sp.reorder_point,0)`);
      const rows = res.recordset
        .filter((r: any) => cocokArea(r.mesin, area))
        // Rumus rekomendasi sama dengan halaman Monitoring: 3 x reorder point - stok
        .map((r: any) => ({ ...r, rekomendasi_pesan: Math.max(0, r.reorder_point * 3 - r.stok_saat_ini) }));
      const ringkasan = {
        total: rows.length,
        habis: rows.filter((r: any) => r.stok_saat_ini === 0).length,
        kritis: rows.filter((r: any) => r.is_critical).length,
      };
      return NextResponse.json({ success: true, jenis, rows, ringkasan });
    }

    /* ---------- 2b. Stok semua part (kondisi saat ini) + jumlah yang sedang dipesan ---------- */
    if (jenis === 'stok_semua') {
      const kol = async (t: string, k: string) => (await pool.request().query(`SELECT COL_LENGTH('${t}','${k}') AS n`)).recordset[0]?.n != null;
      const adaJenis = await kol('SpareParts', 'mesin_jenis_id');
      const adaHarga = await kol('SpareParts', 'harga_satuan');
      const adaRak = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.BinLokasi', N'U') AS a, OBJECT_ID(N'dbo.Rak', N'U') AS b`)).recordset[0];
      const rak = adaRak?.a != null && adaRak?.b != null;
      const res = await pool.request().query(`
        SELECT sp.id, sp.kode_12nc, sp.nama_part, sp.kategori,
               ${adaJenis ? 'ISNULL(mj.nama, sp.mesin) AS mesin, mj.area AS area_mesin,' : 'sp.mesin, NULL AS area_mesin,'}
               LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin, ${rak ? 'rk.kode AS rak_kode, bl.tingkat AS rak_tingkat,' : 'NULL AS rak_kode, NULL AS rak_tingkat,'}
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point,
               ISNULL(sp.is_critical,0) AS is_critical,
               ${adaHarga ? 'sp.harga_satuan, ISNULL(sp.is_consumable,0) AS is_consumable,' : 'NULL AS harga_satuan, 0 AS is_consumable,'}
               ISNULL((SELECT SUM(r.jumlah) FROM PartOutRequests r WHERE r.spare_part_id = sp.id AND r.status IN ('Pending','Prepared')),0) AS dipesan
        FROM SpareParts sp
        ${adaJenis ? 'LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id' : ''}
        ${rak ? 'LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin)) LEFT JOIN Rak rk ON rk.id = bl.rak_id' : ''}
        WHERE ISNULL(sp.is_active,1) = 1
        ORDER BY sp.nama_part`);
      // Jatah per mesin untuk part yang dipakai bersama (migrasi 18)
      const jatahTeks: Record<number, string> = {};
      if ((await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null) {
        const pm = (await pool.request().query(`
          SELECT pm.spare_part_id, pm.mesin_jenis_id, pm.qty_per_unit, pm.jatah, j.nama, ISNULL(sp.stok_saat_ini,0) AS stok,
                 (SELECT COUNT(*) FROM Mesin m WHERE m.jenis_id = pm.mesin_jenis_id AND ISNULL(m.is_active,1)=1) AS unit
          FROM PartMesin pm JOIN MesinJenis j ON j.id = pm.mesin_jenis_id JOIN SpareParts sp ON sp.id = pm.spare_part_id`)).recordset;
        const per: Record<number, any[]> = {};
        pm.forEach((x: any) => { (per[x.spare_part_id] ??= []).push(x); });
        Object.entries(per).forEach(([pid, rs]) => {
          if (rs.length < 2) return;
          const j = selaraskan(rs as any, rs[0].stok);
          jatahTeks[Number(pid)] = rs.map((x: any, i: number) => `${x.nama} ${j[i]}`).join(' · ');
        });
      }
      const rows = res.recordset
        .filter((r: any) => area === 'semua' || (r.area_mesin ? (r.area_mesin === 'Molding' ? 'molding' : 'nonmolding') === area : cocokArea(r.mesin, area)))
        .map((r: any) => {
          const harga = r.harga_satuan == null ? null : Number(r.harga_satuan);
          const status = r.stok_saat_ini <= 0 ? 'habis' : r.reorder_point > 0 && r.stok_saat_ini <= r.reorder_point ? 'warning' : 'aman';
          return { ...r, harga_satuan: harga, nilai_stok: harga == null ? null : harga * r.stok_saat_ini,
                   tersedia: Math.max(0, r.stok_saat_ini - (Number(r.dipesan) || 0)), status, jatah_teks: jatahTeks[r.id] || null };
        });
      const ringkasan = {
        total: rows.length,
        aman: rows.filter((r: any) => r.status === 'aman').length,
        warning: rows.filter((r: any) => r.status === 'warning').length,
        habis: rows.filter((r: any) => r.status === 'habis').length,
        nilai_stok: rows.reduce((a: number, r: any) => a + (r.nilai_stok || 0), 0),
        dipesan: rows.reduce((a: number, r: any) => a + (Number(r.dipesan) || 0), 0),
      };
      return NextResponse.json({ success: true, jenis, rows, ringkasan });
    }

    /* ---------- 3. Pemakaian per mesin ---------- */
    if (jenis === 'pemakaian') {
      const res = await range(pool.request()).query(`
        SELECT ISNULL(NULLIF(LTRIM(RTRIM(r.mesin_area)),''),'Tanpa mesin') AS mesin, r.part_nama, r.jumlah
        FROM PartOutRequests r
        WHERE r.status = 'Approved'
          AND ISNULL(r.approved_at, r.created_at) >= @dari AND ISNULL(r.approved_at, r.created_at) < @sampai`);
      const map: Record<string, { mesin: string; area: string; jumlah_permintaan: number; total_item: number; parts: Record<string, number> }> = {};
      res.recordset.filter((r: any) => cocokArea(r.mesin === 'Tanpa mesin' ? '' : r.mesin, area)).forEach((r: any) => {
        const k = r.mesin;
        map[k] ??= { mesin: k, area: areaOf(k === 'Tanpa mesin' ? '' : k), jumlah_permintaan: 0, total_item: 0, parts: {} };
        map[k].jumlah_permintaan++;
        map[k].total_item += r.jumlah || 0;
        const p = String(r.part_nama || '-').trim();
        map[k].parts[p] = (map[k].parts[p] || 0) + (r.jumlah || 0);
      });
      const rows = Object.values(map)
        .map(m => ({ mesin: m.mesin, area: m.area, jumlah_permintaan: m.jumlah_permintaan, total_item: m.total_item,
          part_teratas: Object.entries(m.parts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, j]) => `${n} (${j})`).join(', ') }))
        .sort((a, b) => b.total_item - a.total_item);
      return NextResponse.json({ success: true, jenis, rows, ringkasan: { total_mesin: rows.length, total_item: rows.reduce((a, r) => a + r.total_item, 0) } });
    }

    /* ---------- 4. Laporan periode lengkap (3 halaman: ringkasan, per mesin, stok & persetujuan) ---------- */
    if (jenis === 'periode') {
      const lamaHari = Math.max(1, Math.round((sampai.getTime() - dari.getTime()) / 86400000));
      const dariLalu = new Date(dari.getTime() - lamaHari * 86400000);
      const kol = async (tabel: string, kolom: string) => (await pool.request().query(`SELECT COL_LENGTH('${tabel}','${kolom}') AS n`)).recordset[0]?.n != null;
      const ada = async (tabel: string) => (await pool.request().query(`SELECT OBJECT_ID(N'dbo.${tabel}', N'U') AS id`)).recordset[0]?.id != null;
      const adaMold = await kol('PartOutRequests', 'mold_id') && await ada('Mold');
      const adaJenis = await kol('SpareParts', 'mesin_jenis_id') && await ada('MesinJenis');
      const adaOrder = await ada('OrderSparePart');
      const adaRak = await ada('BinLokasi') && await ada('Rak');
      const tglOut = `ISNULL(r.approved_at, r.created_at)`;
      const qr = (s: string) => range(pool.request()).input('dariLalu', sql.DateTime, keDb(dariLalu, kor)).query(s);

      // KPI
      const kOut = (await qr(`SELECT
          SUM(CASE WHEN ${tglOut} >= @dari THEN 1 ELSE 0 END) AS req, SUM(CASE WHEN ${tglOut} >= @dari THEN r.jumlah ELSE 0 END) AS pcs,
          SUM(CASE WHEN ${tglOut} < @dari THEN r.jumlah ELSE 0 END) AS pcs_lalu
        FROM PartOutRequests r WHERE r.status='Approved' AND ${tglOut} >= @dariLalu AND ${tglOut} < @sampai`)).recordset[0];
      const kIn = (await qr(`SELECT
          SUM(CASE WHEN tanggal_masuk >= @dari THEN 1 ELSE 0 END) AS trx, SUM(CASE WHEN tanggal_masuk >= @dari THEN jumlah_masuk ELSE 0 END) AS pcs,
          SUM(CASE WHEN tanggal_masuk < @dari THEN jumlah_masuk ELSE 0 END) AS pcs_lalu
        FROM PartIn WHERE tanggal_masuk >= @dariLalu AND tanggal_masuk < @sampai`)).recordset[0];
      const kRet = (await qr(`SELECT COUNT(*) AS trx, ISNULL(SUM(jumlah_return),0) AS pcs FROM ReturnParts WHERE tanggal_return >= @dari AND tanggal_return < @sampai`)).recordset[0];
      const kOrder = adaOrder ? (await qr(`SELECT COUNT(*) AS total,
          SUM(CASE WHEN status='selesai' THEN 1 ELSE 0 END) AS diterima, SUM(CASE WHEN status='batal' THEN 1 ELSE 0 END) AS batal
        FROM OrderSparePart WHERE created_at >= @dari AND created_at < @sampai`)).recordset[0] : { total: 0, diterima: 0, batal: 0 };
      const kStok = (await pool.request().query(`SELECT
          SUM(CASE WHEN stok_saat_ini <= reorder_point AND reorder_point > 0 THEN 1 ELSE 0 END) AS warning,
          SUM(CASE WHEN ISNULL(is_critical,0)=1 AND stok_saat_ini <= 0 THEN 1 ELSE 0 END) AS critical_habis,
          SUM(CASE WHEN stok_saat_ini <= 0 THEN 1 ELSE 0 END) AS habis
        FROM SpareParts WHERE ISNULL(is_active,1)=1`)).recordset[0];

      // Tren harian
      const tren = (await qr(`
        SELECT CONVERT(date, ${tglOut}) AS tgl, SUM(r.jumlah) AS keluar, 0 AS masuk FROM PartOutRequests r
          WHERE r.status='Approved' AND ${tglOut} >= @dari AND ${tglOut} < @sampai GROUP BY CONVERT(date, ${tglOut})
        UNION ALL
        SELECT CONVERT(date, tanggal_masuk), 0, SUM(jumlah_masuk) FROM PartIn
          WHERE tanggal_masuk >= @dari AND tanggal_masuk < @sampai GROUP BY CONVERT(date, tanggal_masuk)`)).recordset;

      // Top 10 part keluar
      const top = (await qr(`
        SELECT TOP 10 MAX(ISNULL(sp.nama_part, r.part_nama)) AS nama_part, MAX(sp.kode_12nc) AS kode_12nc,
               MAX(${adaJenis ? 'ISNULL(mj.nama, sp.mesin)' : 'sp.mesin'}) AS mesin, SUM(r.jumlah) AS qty,
               MAX(sp.stok_saat_ini) AS stok, MAX(sp.reorder_point) AS min_stok
        FROM PartOutRequests r
        LEFT JOIN SpareParts sp ON sp.id = r.spare_part_id
        ${adaJenis ? 'LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id' : ''}
        WHERE r.status='Approved' AND ${tglOut} >= @dari AND ${tglOut} < @sampai
        GROUP BY ISNULL(CAST(r.spare_part_id AS NVARCHAR(20)), N'n:' + LOWER(LTRIM(RTRIM(r.part_nama))))
        ORDER BY SUM(r.jumlah) DESC`)).recordset;

      // Per mesin (dari mesin pemilik part; kalau part belum punya mesin pakai teks area request)
      const perMesin = (await qr(`
        SELECT ${adaJenis ? `ISNULL(mj.nama, ISNULL(NULLIF(LTRIM(RTRIM(LEFT(r.mesin_area, CHARINDEX(N'·', r.mesin_area + N'·') - 1))),''), N'Tanpa mesin'))` : `ISNULL(NULLIF(LTRIM(RTRIM(r.mesin_area)),''), N'Tanpa mesin')`} AS mesin,
               ${adaJenis ? 'MAX(mj.area)' : 'NULL'} AS area, ${adaJenis ? 'MAX(mj.id)' : 'NULL'} AS jenis_id,
               COUNT(*) AS req, SUM(r.jumlah) AS pcs
        FROM PartOutRequests r
        LEFT JOIN SpareParts sp ON sp.id = r.spare_part_id
        ${adaJenis ? 'LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id' : ''}
        WHERE r.status='Approved' AND ${tglOut} >= @dari AND ${tglOut} < @sampai
        GROUP BY ${adaJenis ? `ISNULL(mj.nama, ISNULL(NULLIF(LTRIM(RTRIM(LEFT(r.mesin_area, CHARINDEX(N'·', r.mesin_area + N'·') - 1))),''), N'Tanpa mesin'))` : `ISNULL(NULLIF(LTRIM(RTRIM(r.mesin_area)),''), N'Tanpa mesin')`}
        ORDER BY SUM(r.jumlah) DESC`)).recordset;
      const warnMesin = adaJenis ? (await pool.request().query(`
        SELECT mesin_jenis_id AS jenis_id, COUNT(*) AS total,
               SUM(CASE WHEN stok_saat_ini <= reorder_point AND reorder_point > 0 THEN 1 ELSE 0 END) AS warning,
               SUM(CASE WHEN ISNULL(is_critical,0)=1 AND stok_saat_ini <= 0 THEN 1 ELSE 0 END) AS critical_habis
        FROM SpareParts WHERE ISNULL(is_active,1)=1 AND mesin_jenis_id IS NOT NULL GROUP BY mesin_jenis_id`)).recordset : [];
      const mesinRows = perMesin.map((m: any) => {
        const w = warnMesin.find((x: any) => x.jenis_id === m.jenis_id);
        const persen = w && w.total ? Math.round((w.warning / w.total) * 100) : null;
        return { mesin: m.mesin, area: m.area || '-', req: m.req, pcs: m.pcs, persen_warning: persen,
                 status: (persen != null && persen >= 10) || (w && w.critical_habis > 0) ? 'Alert' : 'Normal' };
      });

      // Maintenance Mold
      let mold: any = { batch: 0, pcs: 0, top: [] as any[] };
      if (adaMold) {
        const b = (await qr(`SELECT COUNT(DISTINCT CONCAT(r.mold_id, '|', r.teknisi_nama, '|', CONVERT(varchar(16), r.created_at, 120))) AS batch, ISNULL(SUM(r.jumlah),0) AS pcs
          FROM PartOutRequests r WHERE r.status='Approved' AND r.mold_id IS NOT NULL AND ${tglOut} >= @dari AND ${tglOut} < @sampai`)).recordset[0];
        const t = (await qr(`SELECT TOP 5 mo.nama_mold, mo.kode_mold, mj.nama AS mesin, SUM(r.jumlah) AS pcs
          FROM PartOutRequests r JOIN Mold mo ON mo.id = r.mold_id LEFT JOIN MesinJenis mj ON mj.id = mo.mesin_jenis_id
          WHERE r.status='Approved' AND ${tglOut} >= @dari AND ${tglOut} < @sampai
          GROUP BY mo.nama_mold, mo.kode_mold, mj.nama ORDER BY SUM(r.jumlah) DESC`)).recordset;
        mold = { batch: b.batch, pcs: b.pcs, top: t };
      }
      // Maintenance Machine (PM): request dengan area "<mesin> · PM"
      const pmB = (await qr(`SELECT COUNT(DISTINCT CONCAT(r.mesin_area, '|', r.teknisi_nama, '|', CONVERT(varchar(16), r.created_at, 120))) AS batch, ISNULL(SUM(r.jumlah),0) AS pcs
          FROM PartOutRequests r WHERE r.status='Approved' AND r.mesin_area LIKE N'%· PM%' AND ${tglOut} >= @dari AND ${tglOut} < @sampai`)).recordset[0];
      const pmT = (await qr(`SELECT TOP 5 MAX(ISNULL(sp.nama_part, r.part_nama)) AS nama_part,
            LTRIM(RTRIM(LEFT(r.mesin_area, CHARINDEX(N'·', r.mesin_area) - 1))) AS mesin, SUM(r.jumlah) AS pcs
          FROM PartOutRequests r LEFT JOIN SpareParts sp ON sp.id = r.spare_part_id
          WHERE r.status='Approved' AND r.mesin_area LIKE N'%· PM%' AND ${tglOut} >= @dari AND ${tglOut} < @sampai
          GROUP BY ISNULL(CAST(r.spare_part_id AS NVARCHAR(20)), r.part_nama), LTRIM(RTRIM(LEFT(r.mesin_area, CHARINDEX(N'·', r.mesin_area) - 1)))
          ORDER BY SUM(r.jumlah) DESC`)).recordset;

      // Halaman 3: part perlu dipesan (kondisi saat ini)
      const reorder = (await pool.request().query(`
        SELECT TOP 40 sp.nama_part, sp.kode_12nc, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin,
               ${adaRak ? 'rk.kode AS rak_kode, bl.tingkat AS rak_tingkat' : 'NULL AS rak_kode, NULL AS rak_tingkat'},
               sp.stok_saat_ini AS stok, sp.reorder_point AS min_stok, ISNULL(sp.is_critical,0) AS is_critical,
               ${adaJenis ? 'ISNULL(mj.nama, sp.mesin)' : 'sp.mesin'} AS mesin
        FROM SpareParts sp
        ${adaJenis ? 'LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id' : ''}
        ${adaRak ? 'LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin)) LEFT JOIN Rak rk ON rk.id = bl.rak_id' : ''}
        WHERE ISNULL(sp.is_active,1)=1 AND sp.stok_saat_ini <= sp.reorder_point AND sp.reorder_point > 0
        ORDER BY CASE WHEN sp.stok_saat_ini <= 0 THEN 0 ELSE 1 END, ISNULL(sp.is_critical,0) DESC,
                 CAST(sp.stok_saat_ini AS FLOAT) / NULLIF(sp.reorder_point,0), sp.nama_part`)).recordset;
      // Order (dibuat pada periode, atau masih berjalan) + return pada periode
      const orders = adaOrder ? (await qr(`
        SELECT TOP 25 o.id, o.nomor_order, o.nomor_po, o.status, o.eta, o.supplier_nama, o.created_at,
               (SELECT TOP 1 i.nama_part FROM OrderSparePartItem i WHERE i.order_id = o.id ORDER BY i.id) AS part_pertama,
               (SELECT COUNT(*) FROM OrderSparePartItem i WHERE i.order_id = o.id) AS jumlah_item,
               (SELECT ISNULL(SUM(i.qty),0) FROM OrderSparePartItem i WHERE i.order_id = o.id) AS qty
        FROM OrderSparePart o
        WHERE (o.created_at >= @dari AND o.created_at < @sampai) OR o.status NOT IN ('selesai','batal')
        ORDER BY CASE WHEN o.status IN ('selesai','batal') THEN 1 ELSE 0 END, o.created_at DESC`)).recordset : [];
      const returns = (await qr(`
        SELECT TOP 15 rp.id, rp.nomor_do, rp.jumlah_return AS qty, rp.alasan_return AS alasan, rp.tanggal_return,
               sp.nama_part, s.nama_supplier
        FROM ReturnParts rp LEFT JOIN SpareParts sp ON sp.id = rp.spare_part_id LEFT JOIN Suppliers s ON s.id = rp.supplier_id
        WHERE rp.tanggal_return >= @dari AND rp.tanggal_return < @sampai ORDER BY rp.tanggal_return DESC`)).recordset;

      // Biaya pemakaian (migrasi 16): qty keluar x harga satuan part saat ini
      const adaHarga = await kol('SpareParts', 'harga_satuan');
      let biaya: any = { ada_harga: adaHarga, total: 0, total_lalu: 0, tanpa_harga: 0, consumable: 0, rows: [] as any[] };
      if (adaHarga) {
        const rowsB = (await qr(`
          SELECT MAX(ISNULL(sp.nama_part, r.part_nama)) AS nama_part, MAX(sp.kode_12nc) AS kode_12nc,
                 MAX(${adaJenis ? 'ISNULL(mj.nama, sp.mesin)' : 'sp.mesin'}) AS mesin,
                 MAX(sp.kategori) AS kategori, CAST(MAX(CAST(ISNULL(sp.is_consumable,0) AS INT)) AS BIT) AS is_consumable,
                 CAST(MAX(CAST(ISNULL(sp.is_critical,0) AS INT)) AS BIT) AS is_critical,
                 MAX(sp.harga_satuan) AS harga_satuan, SUM(r.jumlah) AS qty, COUNT(*) AS req
          FROM PartOutRequests r
          LEFT JOIN SpareParts sp ON sp.id = r.spare_part_id
          ${adaJenis ? 'LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id' : ''}
          WHERE r.status='Approved' AND ${tglOut} >= @dari AND ${tglOut} < @sampai
          GROUP BY ISNULL(CAST(r.spare_part_id AS NVARCHAR(20)), N'n:' + LOWER(LTRIM(RTRIM(r.part_nama))))`)).recordset
          .map((r: any) => ({ ...r, harga_satuan: r.harga_satuan == null ? null : Number(r.harga_satuan),
            subtotal: r.harga_satuan == null ? null : Number(r.harga_satuan) * (Number(r.qty) || 0) }))
          .sort((x: any, y: any) => (y.subtotal ?? -1) - (x.subtotal ?? -1) || (y.qty || 0) - (x.qty || 0));
        const lalu = (await qr(`
          SELECT ISNULL(SUM(r.jumlah * sp.harga_satuan), 0) AS total FROM PartOutRequests r
          JOIN SpareParts sp ON sp.id = r.spare_part_id
          WHERE r.status='Approved' AND ${tglOut} >= @dariLalu AND ${tglOut} < @dari AND sp.harga_satuan IS NOT NULL`)).recordset[0];
        const perMesinB: Record<string, number> = {};
        rowsB.forEach((r: any) => { if (r.subtotal != null) perMesinB[r.mesin || 'Tanpa mesin'] = (perMesinB[r.mesin || 'Tanpa mesin'] || 0) + r.subtotal; });
        biaya = { ada_harga: true,
          total: rowsB.reduce((a: number, r: any) => a + (r.subtotal || 0), 0),
          total_lalu: Number(lalu?.total) || 0,
          consumable: rowsB.filter((r: any) => r.is_consumable).reduce((a: number, r: any) => a + (r.subtotal || 0), 0),
          tanpa_harga: rowsB.filter((r: any) => r.harga_satuan == null).length,
          per_mesin: Object.entries(perMesinB).map(([mesin, total]) => ({ mesin, total })).sort((a, b) => b.total - a.total),
          rows: rowsB };
      }

      const n = (v: any) => Number(v) || 0;
      return NextResponse.json({ success: true, jenis, periode: { dari, sampai: sampaiInput, lama_hari: lamaHari },
        kpi: {
          keluar: { pcs: n(kOut.pcs), req: n(kOut.req), pcs_lalu: n(kOut.pcs_lalu) },
          masuk: { pcs: n(kIn.pcs), trx: n(kIn.trx), pcs_lalu: n(kIn.pcs_lalu) },
          order: { total: n(kOrder.total), diterima: n(kOrder.diterima), batal: n(kOrder.batal), proses: n(kOrder.total) - n(kOrder.diterima) - n(kOrder.batal) },
          retur: { pcs: n(kRet.pcs), trx: n(kRet.trx) },
          warning: n(kStok.warning), critical_habis: n(kStok.critical_habis), habis: n(kStok.habis),
        },
        tren, top, mesin: mesinRows, mold, pm: { batch: n(pmB.batch), pcs: n(pmB.pcs), top: pmT },
        reorder, orders, returns, biaya,
        info: { ada_mold: adaMold, ada_jenis: adaJenis, ada_order: adaOrder, ada_harga: adaHarga } });
    }

    return NextResponse.json({ success: false, error: 'Jenis laporan tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    console.error('[laporan-v2]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* ---------- PDF laporan audit (A4 mendatar, siap cetak & tanda tangan) ---------- */
async function pdfAudit(rows: any[], ringkasan: any, dari: Date, sampai: Date, area: string, foto: Record<number, { siapkan?: string; verifikasi?: string }> | null = null, kor = 0) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36, CW = W - M * 2;
  const navy = rgb(0.075, 0.161, 0.294), muted = rgb(0.357, 0.42, 0.502),
        line = rgb(0.851, 0.871, 0.898), shade = rgb(0.973, 0.976, 0.984);
  const fmtTgl = (d: any) => fmtWaktuLengkap(dariDb(d, kor)) || '-'; // dd/mm/yyyy jj:mm:dd
  const labelArea = area === 'molding' ? 'Molding' : area === 'nonmolding' ? 'Non-molding' : 'Semua area';

  let page = pdf.addPage([W, H]); let y = H - M;
  const txt = (t: any, x: number, ty: number, o: any = {}) => {
    const f = o.bold ? bold : font, size = o.size || 8; let s = String(t ?? '-').replace(/[^\x20-\x7E]/g, '');
    if (o.maxW) { while (s.length > 2 && f.widthOfTextAtSize(s, size) > o.maxW) s = s.slice(0, -1); }
    page.drawText(s, { x, y: ty, size, font: f, color: o.color || navy });
  };
  const cols = [
    { t: 'No', w: 24 }, { t: 'Tanggal & jam disetujui', w: 92 }, { t: 'Area', w: 62 }, { t: 'Mesin / unit', w: 96 }, { t: 'No. WO', w: 62 },
    { t: 'Kode 12NC', w: 70 }, { t: 'Nama part', w: 150 }, { t: 'Jml', w: 26 }, { t: 'Teknisi', w: 106 }, { t: 'Foto', w: 28 },
  ];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 16, width: CW, height: 18, color: shade });
    let x = M + 4; cols.forEach(c => { txt(c.t, x, y - 11, { bold: true, size: 7.5, color: muted, maxW: c.w - 6 }); x += c.w; });
    y -= 18;
  };

  txt('PHILIPS', M, y - 14, { bold: true, size: 16 });
  txt('Laporan Audit Pengambilan Part - Store MCC', M + 90, y - 14, { bold: true, size: 13 });
  y -= 30;
  txt(`Periode: ${dari.toLocaleDateString('id-ID')} s/d ${sampai.toLocaleDateString('id-ID')}     Area: ${labelArea}     Dicetak: ${new Date().toLocaleString('id-ID')}`, M, y, { size: 9, color: muted });
  y -= 22;
  const kpi = [
    ['Permintaan masuk', ringkasan.total_permintaan], ['Disetujui', ringkasan.disetujui], ['Ditolak', ringkasan.ditolak],
    ['Total item keluar', ringkasan.total_item_keluar], ['Rata-rata respons', ringkasan.rata_respons_menit === null ? '-' : `${ringkasan.rata_respons_menit} menit`],
  ];
  kpi.forEach(([l, v], i) => {
    const x = M + i * (CW / 5);
    txt(l, x, y, { size: 8, color: muted }); txt(v, x, y - 16, { bold: true, size: 14 });
  });
  y -= 36;
  page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.5, color: line }); y -= 10;

  header();
  if (!rows.length) { txt('Tidak ada pengambilan part pada periode ini.', M + 4, y - 12, { size: 9, color: muted }); y -= 24; }
  rows.forEach((r, i) => {
    if (y < 110) { page = pdf.addPage([W, H]); y = H - M; header(); }
    const cells = [String(i + 1), fmtTgl(r.approved_at || r.created_at), labelAreaDari(r.area), r.mesin_area || '-', r.nomor_wo || '-', r.kode_12nc || '-',
      (r.is_urgent ? '[MENDESAK] ' : '') + (r.part_nama || '-'), String(r.jumlah || 0), r.teknisi_nama || '-', String(r.jumlah_foto || 0)];
    let x = M + 4; cells.forEach((c, j) => { txt(c, x, y - 11, { size: 7.5, maxW: cols[j].w - 6 }); x += cols[j].w; });
    page.drawLine({ start: { x: M, y: y - 16 }, end: { x: M + CW, y: y - 16 }, thickness: 0.4, color: line });
    y -= 17;
  });

  if (y < 110) { page = pdf.addPage([W, H]); y = H - M; }
  y -= 30;
  [['Disiapkan oleh', 'Admin Store MCC'], ['Diperiksa oleh', 'Supervisor Store MCC'], ['Mengetahui', 'Team Leader Area']].forEach(([a, b], i) => {
    const x = M + i * (CW / 3);
    txt(a, x, y, { size: 9, color: muted });
    page.drawLine({ start: { x, y: y - 44 }, end: { x: x + 170, y: y - 44 }, thickness: 0.5, color: navy });
    txt(b, x, y - 56, { size: 9 });
  });

  // Lampiran foto bukti (kalau diminta): tiap pengambilan 1 blok berisi foto admin saat siapkan + foto verifikasi
  if (foto) {
    const adaFoto = rows.map((r, i) => ({ r, i })).filter(({ r }) => foto[r.id]?.siapkan || foto[r.id]?.verifikasi);
    page = pdf.addPage([W, H]); y = H - M;
    txt('Lampiran foto bukti pengambilan part', M, y - 14, { bold: true, size: 13 }); y -= 26;
    txt(adaFoto.length ? `${adaFoto.length} pengambilan dengan foto. Nomor mengikuti kolom "No" pada tabel.` : 'Tidak ada foto pada periode ini.', M, y, { size: 9, color: muted }); y -= 14;
    const BOX_W = (CW - 20) / 2, BOX_H = 190;
    for (const { r, i } of adaFoto) {
      if (y - (BOX_H + 34) < 40) { page = pdf.addPage([W, H]); y = H - M; }
      txt(`No ${i + 1}  |  ${fmtTgl(r.approved_at || r.created_at)}  |  ${r.part_nama || '-'} x${r.jumlah || 0}  |  ${r.teknisi_nama || '-'}  |  ${r.mesin_area || '-'}${r.nomor_wo ? '  |  WO ' + r.nomor_wo : ''}`, M, y - 12, { bold: true, size: 9, maxW: CW });
      y -= 18;
      const item = [['Foto admin saat siapkan', foto[r.id]?.siapkan], ['Foto verifikasi teknisi', foto[r.id]?.verifikasi]];
      for (let k = 0; k < 2; k++) {
        const [label, src] = item[k] as [string, string | undefined];
        const x = M + k * (BOX_W + 20);
        page.drawRectangle({ x, y: y - BOX_H, width: BOX_W, height: BOX_H, borderColor: line, borderWidth: 0.6, color: shade });
        const g = src ? bacaGambar(src) : null;
        if (g) {
          try {
            const img = g.ext === 'png' ? await pdf.embedPng(g.buf) : await pdf.embedJpg(g.buf);
            const sc = Math.min((BOX_W - 8) / img.width, (BOX_H - 8) / img.height);
            const w = img.width * sc, h = img.height * sc;
            page.drawImage(img, { x: x + (BOX_W - w) / 2, y: y - BOX_H + (BOX_H - h) / 2, width: w, height: h });
          } catch { txt('Foto tidak bisa dibaca', x + 8, y - BOX_H / 2, { size: 8, color: muted }); }
        } else txt(src ? 'Format foto tidak didukung (bukan JPG/PNG)' : 'Tidak ada foto', x + 8, y - BOX_H / 2, { size: 8, color: muted });
        txt(label, x, y - BOX_H - 11, { size: 8, color: muted });
      }
      y -= BOX_H + 26;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p: any, i: number) => {
    p.drawText(`PT Philips Industries Batam - Store MCC   |   Halaman ${i + 1} dari ${pages.length}`, { x: M, y: 18, size: 7, font, color: muted });
  });
  const bytes = await pdf.save();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nama = `Audit_Pengambilan_Part_${iso(dari)}_sd_${iso(sampai)}.pdf`;
  return new NextResponse(Buffer.from(bytes), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nama}"` } });
}

/* ---------- Excel laporan audit dengan foto bukti di dalam sel ---------- */
function xlsxAudit(rows: any[], ringkasan: any, dari: Date, sampai: Date, area: string, foto: Record<number, { siapkan?: string; verifikasi?: string }>, kor = 0) {
  const fmtTgl = (d: any) => fmtWaktuLengkap(dariDb(d, kor));
  const labelArea = area === 'molding' ? 'Molding' : area === 'nonmolding' ? 'Non-molding' : 'Semua area';
  // Satu baris = satu pengambilan part. Hari / tanggal / jam (sampai detik) saat disetujui teknisi.
  const header = ['No', 'Hari', 'Tanggal', 'Jam', 'Area', 'Mesin / unit', 'No. WO', 'Kode 12NC', 'Nama part', 'Jumlah', 'Mendesak', 'Teknisi', 'Alasan pengambilan', 'Dipesan', 'Disiapkan', 'Jumlah foto', 'Foto admin saat siapkan', 'Foto verifikasi teknisi'];
  const baris = rows.map((r: any, i: number) => { const t = dariDb(r.approved_at || r.created_at, kor); return [i + 1, fmtHari(t), fmtTanggal(t), fmtJam(t), labelAreaDari(r.area), r.mesin_area || '', r.nomor_wo || '', r.kode_12nc || '', r.part_nama || '', r.jumlah || 0,
    r.is_urgent ? 'Ya' : 'Tidak', r.teknisi_nama || '', r.alasan_ambil || '', fmtTgl(r.created_at), fmtTgl(r.prepared_at), r.jumlah_foto || 0,
    foto[r.id]?.siapkan ? (bacaGambar(foto[r.id].siapkan!) ? '' : 'format tidak didukung') : '-', foto[r.id]?.verifikasi ? (bacaGambar(foto[r.id].verifikasi!) ? '' : 'format tidak didukung') : '-']; });
  const fotos: { row: number; col: number; dataUrl: string }[] = [];
  rows.forEach((r: any, i: number) => {
    if (foto[r.id]?.siapkan) fotos.push({ row: i, col: 16, dataUrl: foto[r.id].siapkan! });
    if (foto[r.id]?.verifikasi) fotos.push({ row: i, col: 17, dataUrl: foto[r.id].verifikasi! });
  });
  const info = `Periode ${dari.toLocaleDateString('id-ID')} s/d ${sampai.toLocaleDateString('id-ID')} · Area: ${labelArea} · ${rows.length} pengambilan · ${ringkasan.total_item_keluar} item keluar · Dicetak ${new Date().toLocaleString('id-ID')}`;
  const buf = xlsxDenganFoto('Audit pengambilan part - Store MCC', info, header, baris, fotos);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return new NextResponse(new Uint8Array(buf), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Audit_Pengambilan_Part_${iso(dari)}_sd_${iso(sampai)}.xlsx"` } });
}
