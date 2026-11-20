import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');
import { samakanMinStok } from '../_lib/minunit';

/* =====================================================================
   API Master Data Mesin (induk data untuk Admin & Teknisi)
   GET  /api/mesin                      -> daftar jenis + unit + jumlah part
   GET  /api/mesin?foto=ID              -> gambar jenis mesin (dipakai di <img src>)
   GET  /api/mesin?parts=ID             -> part milik jenis mesin ID
   GET  /api/mesin?parts=none           -> part yang belum punya jenis mesin
   GET  /api/mesin?parts=all            -> semua part aktif (daftar lengkap untuk Part In & web Teknisi)
   GET  /api/mesin?peta=1               -> pasangan id part -> mesin_jenis_id (+ is_consumable) untuk web Teknisi
   GET  /api/mesin?parts=consumable     -> semua consumable part (migrasi 16)
   POST /api/mesin  { aksi, ... }       -> simpan / hapus (lihat fungsi POST)
   Butuh migrasi 06.
   ===================================================================== */

const AREA = ['Molding', 'Non-molding'];
const MAX_FOTO = 3_000_000; // karakter base64 (foto sudah diperkecil di browser)
const fotoUrl = (j: any) =>
  !j.foto ? null : String(j.foto).startsWith('/') ? j.foto : `/api/mesin?foto=${j.id}&v=${new Date(j.updated_at || j.created_at).getTime()}`;
const str = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
// Kolom harga_satuan & is_consumable (migrasi 16). Sebelum migrasi dijalankan, fitur ini dilewati.
const adaKolom16 = async (pool: any) =>
  (await pool.request().query(`SELECT COL_LENGTH('dbo.SpareParts','is_consumable') AS n`)).recordset[0]?.n != null;
// Kolom merk (migrasi 20). Sebelum migrasi dijalankan, merk dilewati.
const adaKolomMerk = async (pool: any) =>
  (await pool.request().query(`SELECT COL_LENGTH('dbo.SpareParts','merk') AS n`)).recordset[0]?.n != null;
const angkaHarga = (v: any): number | null => {
  if (typeof v === 'number') return isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export async function GET(req: NextRequest) {
  try {
    const pool = await sql.connect(getDbConfig());
    const q = req.nextUrl.searchParams;

    // Gambar jenis mesin
    const fotoId = Number(q.get('foto'));
    if (fotoId) {
      const r = await pool.request().input('id', sql.Int, fotoId).query(`SELECT foto FROM MesinJenis WHERE id = @id`);
      const foto: string | null = r.recordset[0]?.foto ?? null;
      if (!foto) return new NextResponse('Not found', { status: 404 });
      if (foto.startsWith('/')) return NextResponse.redirect(new URL(foto, req.url));
      const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(foto);
      if (!m) return new NextResponse('Format foto tidak dikenal', { status: 415 });
      return new NextResponse(Buffer.from(m[2], 'base64'), {
        headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
    }

    // Peta part -> jenis mesin (dipakai web Teknisi)
    if (q.get('peta')) {
      const k16 = await adaKolom16(pool);
      const r = await pool.request().query(k16
        ? `SELECT id, mesin_jenis_id, is_consumable FROM SpareParts WHERE mesin_jenis_id IS NOT NULL OR is_consumable = 1`
        : `SELECT id, mesin_jenis_id FROM SpareParts WHERE mesin_jenis_id IS NOT NULL`);
      // Semua pasangan "Dipakai di mesin" (termasuk part yang hanya dipakai 1 mesin tambahan),
      // supaya web Teknisi menghitung part per mesin sama persis dengan Admin
      const adaPM = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
      const pakai = adaPM ? (await pool.request().query(`SELECT spare_part_id, mesin_jenis_id FROM PartMesin`)).recordset : [];
      return NextResponse.json({ success: true, data: r.recordset, pakai });
    }

    // Part per jenis mesin
    const partsParam = q.get('parts');
    if (partsParam) {
      const tanpa = partsParam === 'none';
      const semuaPart = partsParam === 'all'; // semua part aktif (Part In & web Teknisi), tanpa batas jumlah
      const k16 = await adaKolom16(pool);
      const cons = partsParam === 'consumable';
      if (cons && !k16) return NextResponse.json({ success: false, error: 'Fitur consumable part butuh migrasi 16. Jalankan dulu di SSMS.' }, { status: 400 });
      // Part yang dipakai bersama (migrasi 18) ikut tampil di setiap mesin pemakainya
      const bersama = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
      const k20 = await adaKolomMerk(pool);
      const rq = pool.request();
      if (!tanpa && !cons && !semuaPart) rq.input('jid', sql.Int, Number(partsParam) || 0);
      const r = await rq.query(`
        SELECT sp.id, sp.kode_12nc, sp.nama_part, sp.kategori, sp.mesin, sp.mesin_jenis_id,
               LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin, sp.lokasi_simpan, sp.foto_url,
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point,
               ISNULL(sp.is_critical,0) AS is_critical,
               ${k16 ? 'sp.harga_satuan, sp.is_consumable, mj.nama AS mesin_jenis_nama,' : 'NULL AS harga_satuan, CAST(0 AS BIT) AS is_consumable, NULL AS mesin_jenis_nama,'}
               ${bersama ? '(SELECT COUNT(*) FROM PartMesin pm WHERE pm.spare_part_id = sp.id) AS jumlah_mesin_pakai,' : '0 AS jumlah_mesin_pakai,'}
               ${k20 ? 'sp.merk,' : 'NULL AS merk,'}
               rk.kode AS rak_kode, bl.tingkat AS rak_tingkat
        FROM SpareParts sp
        LEFT JOIN MesinJenis mj ON mj.id = sp.mesin_jenis_id
        LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin))
        LEFT JOIN Rak rk ON rk.id = bl.rak_id
        WHERE ISNULL(sp.is_active,1) = 1 AND ${semuaPart ? '1 = 1' : cons ? 'sp.is_consumable = 1' : tanpa ? 'sp.mesin_jenis_id IS NULL' : bersama ? '(sp.mesin_jenis_id = @jid OR EXISTS (SELECT 1 FROM PartMesin pm WHERE pm.spare_part_id = sp.id AND pm.mesin_jenis_id = @jid))' : 'sp.mesin_jenis_id = @jid'}
        ORDER BY sp.nama_part
      `);
      return NextResponse.json({ success: true, data: r.recordset });
    }

    // Daftar jenis + unit
    const semua = q.get('semua') === '1'; // termasuk yang dinonaktifkan (untuk admin)
    // Jumlah part = part milik mesin ini + part bersama ("Dipakai di mesin"), sama dengan yang tampil di web Teknisi
    const adaPM = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
    const jenis = await pool.request().query(`
      SELECT j.id, j.area, j.nama, j.foto, j.emoji, j.warna, j.leader_nama, j.keterangan, j.urutan, j.is_active,
             j.created_at, j.updated_at,
             COUNT(DISTINCT sp.id) AS jumlah_part,
             COUNT(DISTINCT CASE WHEN ISNULL(sp.stok_saat_ini,0) <= ISNULL(sp.reorder_point,0) THEN sp.id END) AS jumlah_warning
      FROM MesinJenis j
      LEFT JOIN SpareParts sp ON ISNULL(sp.is_active,1) = 1 AND (sp.mesin_jenis_id = j.id
        ${adaPM ? 'OR EXISTS (SELECT 1 FROM PartMesin pm WHERE pm.spare_part_id = sp.id AND pm.mesin_jenis_id = j.id)' : ''})
      ${semua ? '' : 'WHERE j.is_active = 1'}
      GROUP BY j.id, j.area, j.nama, j.foto, j.emoji, j.warna, j.leader_nama, j.keterangan, j.urutan, j.is_active, j.created_at, j.updated_at
      ORDER BY j.area, j.urutan, j.nama
    `);
    const unit = await pool.request().query(`
      SELECT id, jenis_id, nomor_unit, kode_aset, leader_nama, keterangan, is_active
      FROM Mesin WHERE jenis_id IS NOT NULL ${semua ? '' : 'AND is_active = 1'}
      ORDER BY jenis_id, LEN(nomor_unit), nomor_unit
    `);
    const tanpa = await pool.request().query(`SELECT COUNT(*) AS n FROM SpareParts WHERE mesin_jenis_id IS NULL AND ISNULL(is_active,1) = 1`);
    const k16 = await adaKolom16(pool);
    const cons = k16 ? (await pool.request().query(`SELECT COUNT(*) AS n,
        SUM(CASE WHEN ISNULL(stok_saat_ini,0) <= ISNULL(reorder_point,0) THEN 1 ELSE 0 END) AS warning
        FROM SpareParts WHERE is_consumable = 1 AND ISNULL(is_active,1) = 1`)).recordset[0] : null;

    return NextResponse.json({
      success: true,
      jenis: jenis.recordset.map((j: any) => { const { foto, ...rest } = j; return { ...rest, foto_url: fotoUrl(j) }; }),
      unit: unit.recordset,
      part_tanpa_mesin: tanpa.recordset[0].n,
      consumable: cons ? { jumlah: cons.n || 0, warning: cons.warning || 0 } : null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());

    switch (b.aksi) {
      /* Tambah / ubah jenis mesin */
      case 'jenis_simpan': {
        const nama = str(b.nama, 100), area = String(b.area || '');
        if (!nama) return bad('Nama mesin wajib diisi');
        if (!AREA.includes(area)) return bad('Area harus Molding atau Non-molding');
        const rq = pool.request()
          .input('area', sql.NVarChar(20), area).input('nama', sql.NVarChar(100), nama)
          .input('emoji', sql.NVarChar(10), str(b.emoji, 10)).input('warna', sql.VarChar(9), str(b.warna, 9))
          .input('leader', sql.NVarChar(100), str(b.leader_nama, 100)).input('ket', sql.NVarChar(255), str(b.keterangan, 255))
          .input('aktif', sql.Bit, b.is_active === false ? 0 : 1);
        if (b.id) {
          await rq.input('id', sql.Int, Number(b.id)).query(`
            UPDATE MesinJenis SET area=@area, nama=@nama, emoji=@emoji, warna=@warna, leader_nama=@leader,
                   keterangan=@ket, is_active=@aktif, updated_at=GETDATE() WHERE id=@id;
            UPDATE Mesin SET area=@area, jenis_mesin=@nama, updated_at=GETDATE() WHERE jenis_id=@id;`);
          return ok('Mesin diperbarui');
        }
        const r = await rq.query(`
          INSERT INTO MesinJenis (area, nama, emoji, warna, leader_nama, keterangan, is_active, urutan)
          OUTPUT INSERTED.id
          VALUES (@area, @nama, @emoji, @warna, @leader, @ket, @aktif,
                  (SELECT ISNULL(MAX(urutan),0)+10 FROM MesinJenis WHERE area=@area))`);
        return NextResponse.json({ success: true, message: 'Mesin ditambahkan', id: r.recordset[0].id });
      }

      /* Ganti / hapus foto jenis mesin */
      case 'jenis_foto': {
        const id = Number(b.id);
        const foto = b.foto == null ? null : String(b.foto);
        if (!id) return bad('Mesin tidak valid');
        if (foto && !/^data:image\/[a-z+.-]+;base64,/i.test(foto)) return bad('Format foto tidak dikenal');
        if (foto && foto.length > MAX_FOTO) return bad('Ukuran foto terlalu besar');
        await pool.request().input('id', sql.Int, id).input('foto', sql.VarChar(sql.MAX), foto)
          .query(`UPDATE MesinJenis SET foto=@foto, updated_at=GETDATE() WHERE id=@id`);
        return ok(foto ? 'Foto mesin disimpan' : 'Foto mesin dihapus');
      }

      /* Tambah / ubah unit */
      case 'unit_simpan': {
        const nomor = str(b.nomor_unit, 20);
        if (!nomor) return bad('Nama / nomor unit wajib diisi (maks 20 karakter)');
        const jenisId = Number(b.jenis_id);
        const j = await pool.request().input('jid', sql.Int, jenisId).query(`SELECT area, nama FROM MesinJenis WHERE id=@jid`);
        if (!j.recordset.length) return bad('Jenis mesin tidak ditemukan');
        const rq = pool.request()
          .input('jid', sql.Int, jenisId).input('area', sql.NVarChar(20), j.recordset[0].area)
          .input('jenis', sql.NVarChar(100), j.recordset[0].nama).input('nomor', sql.NVarChar(20), nomor)
          .input('aset', sql.NVarChar(50), str(b.kode_aset, 50)).input('leader', sql.NVarChar(100), str(b.leader_nama, 100))
          .input('ket', sql.NVarChar(255), str(b.keterangan, 255));
        const dup = await pool.request().input('jid', sql.Int, jenisId).input('nomor', sql.NVarChar(20), nomor).input('id', sql.Int, Number(b.id) || 0)
          .query(`SELECT id, is_active FROM Mesin WHERE jenis_id=@jid AND nomor_unit=@nomor AND id<>@id`);
        if (dup.recordset.length) {
          if (!dup.recordset[0].is_active && !b.id) {
            await pool.request().input('id', sql.Int, dup.recordset[0].id).query(`UPDATE Mesin SET is_active=1, updated_at=GETDATE() WHERE id=@id`);
            await hitungUlangMinUnit(pool, dup.recordset[0].id);
            return ok('Unit diaktifkan kembali');
          }
          return bad('Unit dengan nama itu sudah ada');
        }
        if (b.id) {
          await rq.input('id', sql.Int, Number(b.id)).query(`
            UPDATE Mesin SET nomor_unit=@nomor, kode_aset=@aset, leader_nama=@leader, keterangan=@ket, updated_at=GETDATE() WHERE id=@id`);
          return ok('Unit diperbarui');
        }
        await rq.query(`INSERT INTO Mesin (area, jenis_mesin, nomor_unit, kode_aset, leader_nama, keterangan, jenis_id)
                        VALUES (@area, @jenis, @nomor, @aset, @leader, @ket, @jid)`);
        return ok('Unit ditambahkan');
      }

      /* Nonaktifkan unit / jenis (tidak dihapus permanen karena dipakai riwayat) */
      case 'unit_nonaktif': {
        await pool.request().input('id', sql.Int, Number(b.id)).query(`UPDATE Mesin SET is_active=0, updated_at=GETDATE() WHERE id=@id`);
        await hitungUlangMinUnit(pool, Number(b.id));
        return ok('Unit disembunyikan');
      }
      case 'jenis_nonaktif': {
        await pool.request().input('id', sql.Int, Number(b.id)).input('aktif', sql.Bit, b.aktif ? 1 : 0)
          .query(`UPDATE MesinJenis SET is_active=@aktif, updated_at=GETDATE() WHERE id=@id`);
        return ok(b.aktif ? 'Mesin ditampilkan lagi' : 'Mesin disembunyikan');
      }

      /* Hapus permanen unit (hanya kalau belum pernah dipakai di permintaan) */
      case 'unit_hapus': {
        const id = Number(b.id);
        const ref = await pool.request().input('id', sql.Int, id).query(`SELECT COUNT(*) AS n FROM PartOutRequests WHERE mesin_id=@id`);
        if (ref.recordset[0].n > 0) return bad(`Unit ini sudah tercatat di ${ref.recordset[0].n} permintaan, jadi tidak bisa dihapus. Pakai "Sembunyikan".`);
        const terkena = await partMinUnit(pool, id);
        if (terkena.length) await pool.request().input('id', sql.Int, id).query(`DELETE FROM PartMinUnit WHERE unit_id=@id`);
        await pool.request().input('id', sql.Int, id).query(`DELETE FROM Mesin WHERE id=@id`);
        for (const pid of terkena) await samakanMinStok(() => pool.request(), pid);
        return ok('Unit dihapus');
      }

      /* Hapus permanen jenis mesin (untuk mesin yang salah dibuat).
         Ditolak kalau masih punya part atau sudah dipakai di riwayat permintaan. */
      case 'jenis_hapus': {
        const id = Number(b.id);
        const cek = await pool.request().input('id', sql.Int, id).query(`
          SELECT (SELECT COUNT(*) FROM SpareParts WHERE mesin_jenis_id=@id) AS part,
                 (SELECT COUNT(*) FROM PartOutRequests r JOIN Mesin u ON u.id=r.mesin_id WHERE u.jenis_id=@id) AS req_unit,
                 (SELECT COUNT(*) FROM PartOutRequests r JOIN Mold m ON m.id=r.mold_id WHERE m.mesin_jenis_id=@id) AS req_mold`);
        const c = cek.recordset[0];
        if (c.part > 0) return bad(`Mesin ini masih punya ${c.part} part. Pindahkan / lepas dulu part-nya, baru hapus.`);
        if (c.req_unit + c.req_mold > 0) return bad('Mesin ini sudah dipakai di riwayat permintaan, jadi tidak bisa dihapus. Pakai "Sembunyikan".');
        const trx = new sql.Transaction(pool);
        await trx.begin();
        try {
          await new sql.Request(trx).input('id', sql.Int, id).query(`
            IF OBJECT_ID(N'dbo.PmItemPart', N'U') IS NOT NULL DELETE FROM PmItemPart WHERE mesin_jenis_id=@id;
            IF COL_LENGTH(N'dbo.PmItem', N'mesin_jenis_id') IS NOT NULL
              EXEC sp_executesql N'DELETE FROM PmItemPart WHERE pm_item_id IN (SELECT id FROM PmItem WHERE mesin_jenis_id=@j); DELETE FROM PmItem WHERE mesin_jenis_id=@j;', N'@j INT', @j=@id;
            DELETE i FROM MoldItem i JOIN Mold m ON m.id = i.mold_id WHERE m.mesin_jenis_id=@id;
            DELETE FROM Mold WHERE mesin_jenis_id=@id;
            DELETE FROM Mesin WHERE jenis_id=@id;
            DELETE FROM MesinJenis WHERE id=@id;`);
          await trx.commit();
        } catch (e) { await trx.rollback(); throw e; }
        return ok('Mesin dihapus');
      }

      /* Tetapkan banyak part ke satu jenis mesin (atau lepas: jenis_id null) */
      case 'part_tetapkan': {
        const ids: number[] = Array.isArray(b.part_ids) ? b.part_ids.map(Number).filter((n: number) => n > 0).slice(0, 2000) : [];
        if (!ids.length) return bad('Pilih part dulu');
        const jenisId = b.jenis_id == null ? null : Number(b.jenis_id);
        let nama: string | null = null;
        if (jenisId) {
          const j = await pool.request().input('jid', sql.Int, jenisId).query(`SELECT nama FROM MesinJenis WHERE id=@jid`);
          if (!j.recordset.length) return bad('Jenis mesin tidak ditemukan');
          nama = j.recordset[0].nama;
        }
        const trx = new sql.Transaction(pool);
        await trx.begin();
        try {
          for (const id of ids) {
            // Kolom teks lama "mesin" hanya diisi kalau masih kosong (supaya halaman lama tetap cocok)
            await new sql.Request(trx).input('id', sql.Int, id).input('jid', sql.Int, jenisId).input('nama', sql.VarChar(100), nama)
              .query(`UPDATE SpareParts SET mesin_jenis_id=@jid,
                        mesin = CASE WHEN @nama IS NOT NULL AND LTRIM(RTRIM(ISNULL(mesin,'')))='' THEN @nama ELSE mesin END,
                        updated_at=GETDATE() WHERE id=@id`);
          }
          await trx.commit();
        } catch (e) { await trx.rollback(); throw e; }
        return ok(`${ids.length} part ${jenisId ? `ditetapkan ke ${nama}` : 'dilepas dari mesin'}`);
      }

      /* Part baru langsung dari Master Data */
      case 'part_baru': {
        const nama = str(b.nama_part, 200), kategori = str(b.kategori, 50), bin = str(b.nomor_bin, 30);
        if (!nama || !bin) return bad('Nama part dan nomor bin wajib diisi');
        if (!kategori) return bad('Kategori wajib diisi');
        const jenisId = Number(b.mesin_jenis_id) || null;
        const k16 = await adaKolom16(pool);
        if (!jenisId && !(k16 && b.is_consumable)) return bad('Pilih mesin pemilik part (atau tandai sebagai consumable part)');
        // Satu barang = satu part. Nama yang sudah ada tidak boleh dibuat lagi (stok akan terpecah / terhitung dua kali).
        const namaNorm = String(nama).replace(/\s+/g, ' ').trim();
        const kembar = await pool.request().input('nm', sql.VarChar(200), namaNorm)
          .query(`SELECT TOP 1 nama_part, nomor_bin, ISNULL(stok_saat_ini,0) AS stok FROM SpareParts
                  WHERE ISNULL(is_active,1) = 1
                    AND LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(nama_part, CHAR(160), ' '), CHAR(9), ' '), '   ', ' '), '  ', ' ')))) = LOWER(@nm)`);
        if (kembar.recordset.length) {
          const k = kembar.recordset[0];
          return bad(`Part "${k.nama_part}" sudah ada (rak ${k.nomor_bin || '-'}, stok ${k.stok}). Tidak dibuat part baru. Untuk menambah jumlah pakai menu Part In; untuk merk lain tambahkan merk di part tersebut; untuk mesin lain pakai "Dipakai di mesin". Kalau part lama itu hanya percobaan, buka part itu lalu klik "Hapus part".`);
        }
        const kodeBaru = str(b.kode_12nc, 50);
        if (kodeBaru) {
          const ada = await pool.request().input('kode', sql.VarChar(50), kodeBaru)
            .query(`SELECT TOP 1 nama_part FROM SpareParts WHERE LTRIM(RTRIM(kode_12nc)) = @kode`);
          if (ada.recordset.length) return bad(`12NC ${kodeBaru} sudah dipakai oleh part "${ada.recordset[0].nama_part}". Perbaiki 12NC atau kosongkan.`);
        }
        let mesinNama: string | null = str(b.mesin, 100);
        if (jenisId && !mesinNama) {
          const j = await pool.request().input('jid', sql.Int, jenisId).query(`SELECT nama FROM MesinJenis WHERE id=@jid`);
          mesinNama = j.recordset[0]?.nama ?? null;
        }
        const r = await pool.request()
          .input('kode', sql.VarChar(50), str(b.kode_12nc, 50)).input('nama', sql.VarChar(200), nama)
          .input('kat', sql.VarChar(50), kategori).input('bin', sql.VarChar(30), bin)
          .input('stok', sql.Int, parseInt(b.stok_saat_ini) || 0).input('rop', sql.Int, parseInt(b.reorder_point) || 0)
          .input('mesin', sql.VarChar(100), mesinNama).input('crit', sql.Bit, b.is_critical ? 1 : 0)
          .input('jid', sql.Int, jenisId).input('foto', sql.NVarChar(500), str(b.foto_url, 500))
          .input('harga', sql.Decimal(18, 2), angkaHarga(b.harga_satuan)).input('cons', sql.Bit, b.is_consumable ? 1 : 0)
          .query(`INSERT INTO SpareParts (kode_12nc, nama_part, kategori, lokasi_simpan, nomor_bin, stok_saat_ini, reorder_point,
                                          is_active, created_at, updated_at, mesin, is_critical, mesin_jenis_id, foto_url${k16 ? ', harga_satuan, is_consumable' : ''})
                  OUTPUT INSERTED.id
                  VALUES (@kode, @nama, @kat, 'Spare Part Rack', @bin, @stok, @rop, 1, GETDATE(), GETDATE(), @mesin, @crit, @jid, @foto${k16 ? ', @harga, @cons' : ''})`);
        const idBaru = r.recordset[0].id;
        if (b.merk !== undefined && await adaKolomMerk(pool)) {
          await pool.request().input('id', sql.Int, idBaru).input('m', sql.NVarChar(200), str(b.merk, 200)).query(`UPDATE SpareParts SET merk=@m WHERE id=@id`);
        }
        return NextResponse.json({ success: true, message: `${nama} ditambahkan`, id: idBaru });
      }

      /* Ubah data part dari Master Data */
      /* Hapus part dari master (mis. part percobaan). Dinonaktifkan, bukan dihapus dari database,
         supaya riwayat tetap utuh untuk audit. Syarat: stok 0 dan tidak ada request yang belum selesai. */
      case 'part_hapus_master': {
        // Banyak sekaligus (dari centang di tabel): yang memenuhi syarat dihapus, sisanya dilaporkan
        if (Array.isArray(b.ids)) {
          const ids = b.ids.map(Number).filter((x: number) => x > 0).slice(0, 500);
          if (!ids.length) return bad('Pilih part dulu');
          const ok1: string[] = [], tolak: string[] = [];
          for (const pid of ids) {
            const x = (await pool.request().input('id', sql.Int, pid).query(`
              SELECT sp.nama_part, ISNULL(sp.stok_saat_ini,0) AS stok, ISNULL(sp.is_active,1) AS aktif,
                     (SELECT COUNT(*) FROM PartOutRequests r WHERE r.spare_part_id = sp.id AND r.status IN ('Pending','Prepared')) AS req
              FROM SpareParts sp WHERE sp.id = @id`)).recordset[0];
            if (!x || !x.aktif) continue;
            if (Number(x.stok) > 0) { tolak.push(`${x.nama_part} (stok ${x.stok})`); continue; }
            if (Number(x.req) > 0) { tolak.push(`${x.nama_part} (${x.req} request belum selesai)`); continue; }
            await pool.request().input('id', sql.Int, pid)
              .query(`UPDATE SpareParts SET is_active = 0, kode_12nc = NULL, updated_at = GETDATE() WHERE id = @id`);
            ok1.push(x.nama_part);
          }
          if (!ok1.length) return bad(`Tidak ada part yang dihapus. ${tolak.length ? 'Tidak memenuhi syarat: ' + tolak.slice(0, 10).join(', ') + (tolak.length > 10 ? ` +${tolak.length - 10} lain` : '') + '. Keluarkan stoknya dulu lewat Part Out manual.' : ''}`);
          return ok(`${ok1.length} part dihapus dari master data.${tolak.length ? ` Tidak dihapus (${tolak.length}): ${tolak.slice(0, 10).join(', ')}${tolak.length > 10 ? ' ...' : ''}.` : ''}`);
        }
        const id = Number(b.id);
        if (!id) return bad('Part tidak valid');
        const pr = (await pool.request().input('id', sql.Int, id)
          .query(`SELECT id, nama_part, ISNULL(stok_saat_ini,0) AS stok, ISNULL(is_active,1) AS aktif FROM SpareParts WHERE id = @id`)).recordset[0];
        if (!pr || !pr.aktif) return bad('Part tidak ditemukan atau sudah dihapus');
        if (Number(pr.stok) > 0) return bad(`Stok "${pr.nama_part}" masih ${pr.stok}. Keluarkan dulu lewat Part Out manual (jenis Koreksi salah input) supaya tercatat, lalu hapus.`);
        const aktifReq = (await pool.request().input('id', sql.Int, id)
          .query(`SELECT COUNT(*) AS n FROM PartOutRequests WHERE spare_part_id = @id AND status IN ('Pending','Prepared')`)).recordset[0]?.n || 0;
        if (aktifReq) return bad(`"${pr.nama_part}" masih punya ${aktifReq} request yang belum selesai. Selesaikan / tolak dulu, lalu hapus.`);
        await pool.request().input('id', sql.Int, id)
          .query(`UPDATE SpareParts SET is_active = 0, kode_12nc = NULL, updated_at = GETDATE() WHERE id = @id`);
        return ok(`"${pr.nama_part}" dihapus dari master data. Riwayatnya tetap tersimpan. Nama ini sekarang bisa dipakai untuk part baru.`);
      }

      case 'part_ubah': {
        const id = Number(b.id);
        const nama = str(b.nama_part, 200), kategori = str(b.kategori, 50);
        if (!id || !nama || !kategori) return bad('Nama dan kategori wajib diisi');
        const k16 = await adaKolom16(pool);
        const setHarga = k16 && b.harga_satuan !== undefined, setCons = k16 && b.is_consumable !== undefined;
        const setMerk = b.merk !== undefined && await adaKolomMerk(pool);
        await pool.request().input('merk', sql.NVarChar(200), str(b.merk, 200))
          .input('harga', sql.Decimal(18, 2), angkaHarga(b.harga_satuan)).input('cons', sql.Bit, b.is_consumable ? 1 : 0)
          .input('id', sql.Int, id).input('kode', sql.VarChar(50), str(b.kode_12nc, 50)).input('nama', sql.VarChar(200), nama)
          .input('kat', sql.VarChar(50), kategori).input('bin', sql.VarChar(30), str(b.nomor_bin, 30))
          .input('rop', sql.Int, parseInt(b.reorder_point) || 0).input('crit', sql.Bit, b.is_critical ? 1 : 0)
          .input('setfoto', sql.Bit, b.foto_url !== undefined ? 1 : 0).input('foto', sql.NVarChar(500), str(b.foto_url, 500))
          .query(`UPDATE SpareParts SET kode_12nc=@kode, nama_part=@nama, kategori=@kat, nomor_bin=@bin,
                    reorder_point=@rop, is_critical=@crit,
                    foto_url = CASE WHEN @setfoto=1 THEN @foto ELSE foto_url END,${setHarga ? ' harga_satuan=@harga,' : ''}${setCons ? ' is_consumable=@cons,' : ''}${setMerk ? ' merk=@merk,' : ''}
                    updated_at=GETDATE() WHERE id=@id`);
        // Kalau min per unit sudah diisi (migrasi 22), min stok part tetap = jumlah semua unit
        const totalUnit = await samakanMinStok(() => pool.request(), id);
        return ok(totalUnit != null ? `Part diperbarui. Min stok = ${totalUnit} (dari min per unit).` : 'Part diperbarui');
      }

      default:
        return bad('Aksi tidak dikenal');
    }
  } catch (err: any) {
    const pesan = /SpareParts/i.test(err.message) && /UNIQUE|duplicate/i.test(err.message) ? '12NC itu sudah dipakai part lain. Perbaiki 12NC atau kosongkan.'
      : /UNIQUE|UX_MesinJenis/i.test(err.message) ? 'Nama mesin itu sudah ada di area yang sama' : err.message;
    return NextResponse.json({ success: false, error: pesan }, { status: 500 });
  }
}

/* Min per unit (migrasi 22): part yang punya isian min untuk unit ini -> min stok part dihitung ulang */
async function partMinUnit(pool: any, unitId: number): Promise<number[]> {
  const ada = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMinUnit', N'U') AS id`)).recordset[0]?.id != null;
  if (!ada || !unitId) return [];
  return (await pool.request().input('u', sql.Int, unitId).query(`SELECT DISTINCT spare_part_id FROM PartMinUnit WHERE unit_id=@u`)).recordset.map((r: any) => Number(r.spare_part_id));
}
async function hitungUlangMinUnit(pool: any, unitId: number) {
  for (const pid of await partMinUnit(pool, unitId)) await samakanMinStok(() => pool.request(), pid);
}

function ok(message: string) { return NextResponse.json({ success: true, message }); }
function bad(error: string) { return NextResponse.json({ success: false, error }, { status: 400 }); }
