import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');
import { adaTabelJatah, muatBaris, selaraskan, potong, tulisJatah, cariMesinPengambil } from '../_lib/jatah';
import { tetapkanStok } from '../_lib/stok';

const DEFAULT_DB_CONFIG = {
  server: process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DB || 'MCC_SparePartDB',
  user: process.env.MSSQL_USER || 'mcc_user',
  password: process.env.MSSQL_PASSWORD || 'Philips2026!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = Number(body.request_id ?? body.id ?? 0);
    const statusValue = String(body.status ?? body.verifikasi ?? '').trim().toLowerCase();
    const catatan = String(body.catatan ?? body.catatan_tolak ?? '').trim();
    const fotoVerifikasi = String(body.foto_verifikasi ?? body.foto_base64 ?? '').trim();

    if (!requestId || !statusValue) {
      return NextResponse.json({ success: false, error: 'request_id dan status verifikasi wajib diisi' }, { status: 400 });
    }

    const normalizedStatus = statusValue === 'sesuai' || statusValue === 'done' || statusValue === 'approved' || statusValue === 'verified'
      ? 'Approved'
      : statusValue === 'tidak' || statusValue === 'tidak sesuai' || statusValue === 'mismatch' || statusValue === 'rejected' || statusValue === 'reject'
        ? 'Rejected'
        : 'Pending';

    const pool = await sql.connect(DEFAULT_DB_CONFIG);

    const requestRes = await pool.request()
      .input('id', sql.Int, requestId)
      .query(`SELECT TOP 1 * FROM PartOutRequests WHERE id = @id`);

    const request = requestRes.recordset[0];
    if (!request) {
      return NextResponse.json({ success: false, error: 'Request tidak ditemukan' }, { status: 404 });
    }

    let catatanStok = '';
    let catatanPinjam = '';
    if (normalizedStatus === 'Approved') {
      try {
        const jumlah = Number(request.jumlah || 1);
        const partNama = request.part_nama;
        // Pakai ID part yang tersimpan di request (migrasi 02). Kalau kosong, cari berdasarkan nama seperti sebelumnya.
        const partRes = request.spare_part_id
          ? await pool.request()
              .input('pid', sql.Int, request.spare_part_id)
              .query(`SELECT TOP 1 id, stok_saat_ini FROM SpareParts WHERE id = @pid`)
          : await pool.request()
              .input('nama', sql.VarChar, partNama)
              .query(`SELECT TOP 1 id, stok_saat_ini FROM SpareParts WHERE LOWER(nama_part) = LOWER(@nama)`);

        const part = partRes.recordset[0];
        if (part) {
          // Dulu: kalau stok di sistem < jumlah, stok TIDAK berkurang sama sekali (diam-diam),
          // padahal barang sudah keluar. Sekarang stok dikurangi sampai 0 dan selisihnya dicatat.
          const stokSebelum = Number(part.stok_saat_ini) || 0;
          // Jatah per mesin (migrasi 18): potong dari jatah mesin pengambil; kalau kurang, ambil dari
          // jatah mesin lain dan catat di PinjamJatah (tanpa persetujuan, untuk audit di laporan).
          try {
            const rq = () => pool.request();
            if (await adaTabelJatah(rq)) {
              const rows = await muatBaris(rq, part.id);
              if (rows.length >= 2) {
                const awal = selaraskan(rows, stokSebelum);
                const pengambil = await cariMesinPengambil(rq, request.mesin_id, request.mesin_area);
                const hasil = potong(rows, awal, pengambil, Math.min(jumlah, stokSebelum));
                await tulisJatah(rq, part.id, rows, hasil.jatah);
                if (pengambil != null) {
                  for (const pj of hasil.pinjam) {
                    await rq().input('rid', sql.Int, requestId).input('pid', sql.Int, part.id)
                      .input('ke', sql.Int, pengambil).input('dari', sql.Int, pj.dari).input('qty', sql.Int, pj.qty)
                      .input('tid', sql.Int, request.teknisi_id || null).input('tn', sql.NVarChar(100), request.teknisi_nama || null)
                      .input('area', sql.NVarChar(100), String(request.mesin_area || '').slice(0, 100) || null)
                      .query(`INSERT INTO PinjamJatah (request_id, spare_part_id, ke_mesin_id, dari_mesin_id, qty, teknisi_id, teknisi_nama, mesin_area)
                              VALUES (@rid, @pid, @ke, @dari, @qty, @tid, @tn, @area)`);
                  }
                  if (hasil.pinjam.length) catatanPinjam = ` Diambil dari jatah mesin lain: ${hasil.pinjam.map(p => `${rows.find(r => r.mesin_jenis_id === p.dari)?.nama} ${p.qty}`).join(', ')} (tercatat di riwayat).`;
                }
              }
            }
          } catch (e: any) { console.error('[request-verifikasi] jatah error:', e.message); }
          if (stokSebelum < jumlah) {
            catatanStok = `Stok sistem ${stokSebelum}, keluar ${jumlah}: stok dibuat 0, cek fisik (stock opname).`;
            console.warn('[request-verifikasi]', requestId, catatanStok);
          }

          await pool.request()
            .input('pid', sql.Int, part.id)
            .input('qty', sql.Int, jumlah)
            .input('wo', sql.VarChar, request.nomor_wo || null)
            .input('area', sql.VarChar, request.mesin_area || null)
            .input('tid', sql.Int, request.teknisi_id || null)
            .input('rid', sql.Int, requestId)
            .query(`
              INSERT INTO PartOut (spare_part_id, admin_id, jumlah_keluar, nomor_wo, mesin_area, teknisi_id, request_id, tanggal_keluar)
              VALUES (@pid, 1, @qty, @wo, @area, @tid, @rid, GETDATE())
            `);
          // Stok akhir = stok sebelum - jumlah (min 0), tepat 1x walaupun database punya trigger stok
          await tetapkanStok(() => pool.request(), part.id, stokSebelum, -jumlah);
        }
      } catch (e: any) {
        console.error('[request-verifikasi] update stok error:', e.message);
      }
    }

    await pool.request()
      .input('id', sql.Int, requestId)
      .input('status', sql.NVarChar(20), normalizedStatus)
      .input('alasan', sql.NVarChar(100), ('Verifikasi tidak sesuai' + (catatan ? `: ${catatan}` : '')).slice(0, 100))
      .query(`
        UPDATE PartOutRequests SET
          status       = @status,
          approved_at  = CASE WHEN @status = 'Approved' AND approved_at IS NULL THEN GETDATE() ELSE approved_at END,
          alasan_tolak = CASE WHEN @status = 'Rejected' AND alasan_tolak IS NULL THEN @alasan ELSE alasan_tolak END
        WHERE id = @id
      `);

    if (fotoVerifikasi && fotoVerifikasi.startsWith('data:image/')) {
      await pool.request()
        .input('request_id', sql.Int, requestId)
        .input('tipe_foto', sql.NVarChar(20), 'verifikasi')
        .input('foto_base64', sql.NText, fotoVerifikasi)
        .input('catatan', sql.NVarChar(sql.MAX), catatan || null)
        .input('uploaded_by', sql.NVarChar(100), request.teknisi_nama || 'Teknisi')
        .query(`
          INSERT INTO RequestFoto (request_id, tipe_foto, foto_base64, catatan, uploaded_by)
          VALUES (@request_id, @tipe_foto, @foto_base64, @catatan, @uploaded_by)
        `);
    }

    return NextResponse.json({
      success: true,
      message: normalizedStatus === 'Approved'
        ? '✅ Verifikasi sesuai, request berhasil diselesaikan.' + (catatanStok ? ` (${catatanStok})` : '') + catatanPinjam
        : '⚠️ Verifikasi mismatch tercatat, data foto tersimpan di dokumentasi.',
      status: normalizedStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Gagal menyimpan verifikasi' }, { status: 500 });
  }
}
