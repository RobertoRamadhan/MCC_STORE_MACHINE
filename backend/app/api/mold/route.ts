import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   API Mold & template ganti mold (Maintenance Mold). Butuh migrasi 09.
   Parameter kategori: 'mold' (Maintenance Mold, default) atau 'mesin'
   (Maintenance Machine: "mold" di sini berarti jenis pekerjaan). Butuh migrasi 11.
   GET  /api/mold                 -> mesin Molding + jumlah mold
   GET  /api/mold?mesin=ID        -> daftar mold di mesin tsb (+ jumlah item)
   GET  /api/mold?mold=ID         -> isi template: spare part (stok, bin, rak) + alat
   GET  /api/mold?foto=ID         -> gambar mold (untuk <img src>)
   POST /api/mold { aksi, ... }   -> mold_simpan, mold_foto, mold_nonaktif, mold_hapus,
                                     item_tambah, item_ubah, item_hapus
   ===================================================================== */

const MAX_FOTO = 3_000_000;
const str = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const ok = (message: string, extra: any = {}) => NextResponse.json({ success: true, message, ...extra });
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });
const fotoUrl = (m: any) => !m.foto ? null : `/api/mold?foto=${m.id}&v=${new Date(m.updated_at || m.created_at).getTime()}`;

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const semua = q.get('semua') === '1';
    const kat = q.get('kategori') === 'mesin' ? 'mesin' : 'mold';
    const pool = await sql.connect(getDbConfig());

    const fotoId = Number(q.get('foto'));
    if (fotoId) {
      const r = await pool.request().input('id', sql.Int, fotoId).query(`SELECT foto FROM Mold WHERE id=@id`);
      const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(r.recordset[0]?.foto || '');
      if (!m) return new NextResponse('Not found', { status: 404 });
      return new NextResponse(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }

    const moldId = Number(q.get('mold'));
    if (moldId) {
      const m = await pool.request().input('id', sql.Int, moldId).query(`
        SELECT mo.*, j.nama AS mesin_nama FROM Mold mo JOIN MesinJenis j ON j.id = mo.mesin_jenis_id WHERE mo.id=@id`);
      if (!m.recordset.length) return bad('Mold tidak ditemukan');
      const items = await pool.request().input('id', sql.Int, moldId).query(`
        SELECT i.id, i.tipe, i.spare_part_id, i.nama_item, i.qty, i.catatan, i.urutan,
               sp.nama_part, sp.kode_12nc, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin, sp.kategori, sp.foto_url,
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point,
               ISNULL(sp.is_critical,0) AS is_critical, rk.kode AS rak_kode, bl.tingkat AS rak_tingkat
        FROM MoldItem i
        LEFT JOIN SpareParts sp ON sp.id = i.spare_part_id
        LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin))
        LEFT JOIN Rak rk ON rk.id = bl.rak_id
        WHERE i.mold_id=@id
        ORDER BY CASE i.tipe WHEN 'part' THEN 0 ELSE 1 END, i.urutan, i.id`);
      const { foto, ...mold } = m.recordset[0];
      return NextResponse.json({ success: true, mold: { ...mold, foto_url: fotoUrl(m.recordset[0]) }, items: items.recordset });
    }

    const mesinId = Number(q.get('mesin'));
    if (mesinId) {
      const r = await pool.request().input('jid', sql.Int, mesinId).input('kat', sql.VarChar(10), kat).query(`
        SELECT mo.id, mo.mesin_jenis_id, mo.kode_mold, mo.nama_mold, mo.foto, mo.keterangan, mo.urutan, mo.is_active, mo.created_at, mo.updated_at,
               (SELECT COUNT(*) FROM MoldItem i WHERE i.mold_id = mo.id AND i.tipe='part') AS jumlah_part,
               (SELECT COUNT(*) FROM MoldItem i WHERE i.mold_id = mo.id AND i.tipe='alat') AS jumlah_alat,
               (SELECT COUNT(*) FROM MoldItem i JOIN SpareParts sp ON sp.id=i.spare_part_id
                 WHERE i.mold_id = mo.id AND ISNULL(sp.stok_saat_ini,0) < i.qty) AS jumlah_kurang
        FROM Mold mo WHERE mo.mesin_jenis_id=@jid AND mo.kategori=@kat ${semua ? '' : 'AND mo.is_active=1'}
        ORDER BY mo.urutan, mo.nama_mold`);
      return NextResponse.json({ success: true, data: r.recordset.map((m: any) => { const { foto, ...rest } = m; return { ...rest, foto_url: fotoUrl(m) }; }) });
    }

    const r = await pool.request().input('kat', sql.VarChar(10), kat).query(`
      SELECT j.id, j.nama, j.emoji, j.warna, j.foto, j.created_at, j.updated_at, j.is_active,
             (SELECT COUNT(*) FROM Mold mo WHERE mo.mesin_jenis_id = j.id AND mo.is_active=1 AND mo.kategori=@kat) AS jumlah_mold
      FROM MesinJenis j WHERE j.area = N'Molding' ${semua ? '' : 'AND j.is_active=1'}
        AND j.nama NOT IN (N'Maintenance Mold', N'Maintenance Machine')   -- itu nama tim/bagian, bukan mesin
      ORDER BY j.urutan, j.nama`);
    return NextResponse.json({ success: true, data: r.recordset.map((j: any) => {
      const { foto, ...rest } = j;
      const url = !foto ? null : String(foto).startsWith('/') ? foto : `/api/mesin?foto=${j.id}&v=${new Date(j.updated_at || j.created_at).getTime()}`;
      return { ...rest, foto_url: url };
    }) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());

    switch (b.aksi) {
      case 'mold_simpan': {
        const nama = str(b.nama_mold, 150);
        if (!nama) return bad('Nama mold wajib diisi');
        const rq = pool.request().input('nama', sql.NVarChar(150), nama).input('kode', sql.NVarChar(50), str(b.kode_mold, 50))
          .input('ket', sql.NVarChar(255), str(b.keterangan, 255));
        if (b.id) {
          await rq.input('id', sql.Int, Number(b.id)).query(`UPDATE Mold SET nama_mold=@nama, kode_mold=@kode, keterangan=@ket, updated_at=GETDATE() WHERE id=@id`);
          return ok('Mold diperbarui');
        }
        const jid = Number(b.mesin_jenis_id);
        const kat = b.kategori === 'mesin' ? 'mesin' : 'mold';
        const j = await pool.request().input('jid', sql.Int, jid).query(`SELECT id FROM MesinJenis WHERE id=@jid AND area=N'Molding'`);
        if (!j.recordset.length) return bad('Mesin Molding tidak ditemukan');
        const r = await rq.input('jid', sql.Int, jid).input('kat', sql.VarChar(10), kat).query(`
          INSERT INTO Mold (mesin_jenis_id, kategori, nama_mold, kode_mold, keterangan, urutan) OUTPUT INSERTED.id
          VALUES (@jid, @kat, @nama, @kode, @ket, (SELECT ISNULL(MAX(urutan),0)+10 FROM Mold WHERE mesin_jenis_id=@jid AND kategori=@kat))`);
        return ok(kat === 'mesin' ? 'Jenis pekerjaan ditambahkan' : 'Mold ditambahkan', { id: r.recordset[0].id });
      }
      case 'mold_foto': {
        const foto = b.foto == null ? null : String(b.foto);
        if (foto && !/^data:image\/[a-z+.-]+;base64,/i.test(foto)) return bad('Format foto tidak dikenal');
        if (foto && foto.length > MAX_FOTO) return bad('Ukuran foto terlalu besar');
        await pool.request().input('id', sql.Int, Number(b.id)).input('foto', sql.VarChar(sql.MAX), foto)
          .query(`UPDATE Mold SET foto=@foto, updated_at=GETDATE() WHERE id=@id`);
        return ok(foto ? 'Foto mold disimpan' : 'Foto mold dihapus');
      }
      case 'mold_nonaktif': {
        await pool.request().input('id', sql.Int, Number(b.id)).input('aktif', sql.Bit, b.aktif ? 1 : 0)
          .query(`UPDATE Mold SET is_active=@aktif, updated_at=GETDATE() WHERE id=@id`);
        return ok(b.aktif ? 'Mold ditampilkan lagi' : 'Mold disembunyikan');
      }
      case 'mold_hapus': {
        const id = Number(b.id);
        const ref = await pool.request().input('id', sql.Int, id).query(`SELECT COUNT(*) AS n FROM PartOutRequests WHERE mold_id=@id`);
        if (ref.recordset[0].n > 0) return bad(`Sudah tercatat di ${ref.recordset[0].n} permintaan, jadi tidak bisa dihapus. Pakai "Sembunyikan".`);
        const trx = new sql.Transaction(pool);
        await trx.begin();
        try {
          await new sql.Request(trx).input('id', sql.Int, id).query(`DELETE FROM MoldItem WHERE mold_id=@id; DELETE FROM Mold WHERE id=@id;`);
          await trx.commit();
        } catch (e) { await trx.rollback(); throw e; }
        return ok('Dihapus');
      }
      case 'item_tambah': {
        const moldId = Number(b.mold_id);
        const tipe = b.tipe === 'alat' ? 'alat' : 'part';
        const qty = Math.max(1, parseInt(b.qty) || 1);
        if (tipe === 'part') {
          const pid = Number(b.spare_part_id);
          if (!pid) return bad('Pilih spare part dari daftar');
          const dup = await pool.request().input('m', sql.Int, moldId).input('p', sql.Int, pid).query(`SELECT id FROM MoldItem WHERE mold_id=@m AND spare_part_id=@p`);
          if (dup.recordset.length) return bad('Part ini sudah ada di template');
          await pool.request().input('m', sql.Int, moldId).input('p', sql.Int, pid).input('q', sql.Int, qty).input('c', sql.NVarChar(200), str(b.catatan, 200))
            .query(`INSERT INTO MoldItem (mold_id, tipe, spare_part_id, qty, catatan, urutan)
                    VALUES (@m, 'part', @p, @q, @c, (SELECT ISNULL(MAX(urutan),0)+10 FROM MoldItem WHERE mold_id=@m))`);
        } else {
          const nama = str(b.nama_item, 150);
          if (!nama) return bad('Nama alat wajib diisi');
          await pool.request().input('m', sql.Int, moldId).input('n', sql.NVarChar(150), nama).input('q', sql.Int, qty).input('c', sql.NVarChar(200), str(b.catatan, 200))
            .query(`INSERT INTO MoldItem (mold_id, tipe, nama_item, qty, catatan, urutan)
                    VALUES (@m, 'alat', @n, @q, @c, (SELECT ISNULL(MAX(urutan),0)+10 FROM MoldItem WHERE mold_id=@m))`);
        }
        await pool.request().input('m', sql.Int, moldId).query(`UPDATE Mold SET updated_at=GETDATE() WHERE id=@m`);
        return ok(tipe === 'part' ? 'Spare part ditambahkan ke template' : 'Alat ditambahkan ke template');
      }
      case 'item_ubah': {
        const qty = Math.max(1, parseInt(b.qty) || 1);
        await pool.request().input('id', sql.Int, Number(b.id)).input('q', sql.Int, qty).input('c', sql.NVarChar(200), str(b.catatan, 200))
          .query(`UPDATE MoldItem SET qty=@q, catatan=@c WHERE id=@id`);
        return ok('Template diperbarui');
      }
      case 'item_hapus': {
        await pool.request().input('id', sql.Int, Number(b.id)).query(`DELETE FROM MoldItem WHERE id=@id`);
        return ok('Item dihapus dari template');
      }
      default:
        return bad('Aksi tidak dikenal');
    }
  } catch (err: any) {
    const pesan = /UX_Mold_mesin/i.test(err.message) ? 'Nama itu sudah ada di mesin yang sama' : err.message;
    return NextResponse.json({ success: false, error: pesan }, { status: 500 });
  }
}
