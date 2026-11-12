import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* =====================================================================
   API Checklist PM (Maintenance Machine). Butuh migrasi 13 (+ 14 untuk checklist per mesin).
   Checklist sebuah mesin = item PM khusus mesin itu (PmItem.mesin_jenis_id = mesin);
   kalau mesin belum punya checklist khusus, dipakai template umum (mesin_jenis_id NULL).
   Spare part per item selalu per mesin (PmItemPart).
   GET  /api/pm                       -> mesin Molding + jumlah item / item yang sudah punya part
   GET  /api/pm?items=1[&mesin=ID]    -> daftar item template (umum, atau khusus mesin ID)
   GET  /api/pm?mesin=ID              -> checklist mesin + spare part milik mesin tsb (stok, bin, rak)
   POST /api/pm { aksi, ... }         -> item_simpan, item_nonaktif, template_salin, template_impor,
                                         part_tambah, part_ubah, part_hapus
   ===================================================================== */

const str = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const ok = (message: string, extra: any = {}) => NextResponse.json({ success: true, message, ...extra });
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });
const FREK = ['W', 'M', '2M', 'Q', '4M', 'SA', 'A'];
const pesanError = (m: string) => /Invalid object name 'PmItem/i.test(m) ? 'Tabel PM belum ada. Jalankan migrasi 13 dulu.' : m;

async function adaKolomMesin(pool: any) {
  const r = await pool.request().query(`SELECT COL_LENGTH('PmItem','mesin_jenis_id') AS ada`);
  return r.recordset[0]?.ada != null;
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const semua = q.get('semua') === '1';
    const pool = await sql.connect(getDbConfig());
    const perMesin = await adaKolomMesin(pool);
    const kolomDok = perMesin ? ', kode_dokumen, mesin_jenis_id' : ', NULL AS kode_dokumen, NULL AS mesin_jenis_id';
    const mesinId = Number(q.get('mesin')) || 0;

    // Item yang berlaku untuk mesin: khusus kalau ada, kalau tidak template umum
    const itemMesin = async (jid: number) => {
      if (perMesin && jid) {
        const ada = await pool.request().input('jid', sql.Int, jid).query(`SELECT COUNT(*) AS n FROM PmItem WHERE mesin_jenis_id=@jid`);
        if (ada.recordset[0].n > 0) {
          const k = await pool.request().input('jid', sql.Int, jid).query(`
            SELECT id, no_urut, nama_bagian, requirement, frekuensi, is_active ${kolomDok}
            FROM PmItem WHERE mesin_jenis_id=@jid ${semua ? '' : 'AND is_active=1'} ORDER BY no_urut, id`);
          return { sumber: 'mesin', items: k.recordset };
        }
      }
      const u = await pool.request().query(`
        SELECT id, no_urut, nama_bagian, requirement, frekuensi, is_active ${kolomDok}
        FROM PmItem WHERE ${perMesin ? 'mesin_jenis_id IS NULL' : '1=1'} ${semua ? '' : 'AND is_active=1'} ORDER BY no_urut, id`);
      return { sumber: 'umum', items: u.recordset };
    };

    if (q.get('items') === '1') {
      const r = mesinId && perMesin
        ? await pool.request().input('jid', sql.Int, mesinId).query(`
            SELECT id, no_urut, nama_bagian, requirement, frekuensi, is_active ${kolomDok}
            FROM PmItem WHERE mesin_jenis_id=@jid ORDER BY no_urut, id`)
        : await pool.request().query(`
            SELECT id, no_urut, nama_bagian, requirement, frekuensi, is_active ${kolomDok}
            FROM PmItem ${perMesin ? 'WHERE mesin_jenis_id IS NULL' : ''} ORDER BY no_urut, id`);
      return NextResponse.json({ success: true, data: r.recordset, per_mesin: perMesin });
    }

    if (mesinId) {
      const m = await pool.request().input('jid', sql.Int, mesinId).query(`SELECT id, nama FROM MesinJenis WHERE id=@jid`);
      if (!m.recordset.length) return bad('Mesin tidak ditemukan');
      const { sumber, items } = await itemMesin(mesinId);
      const parts = await pool.request().input('jid', sql.Int, mesinId).query(`
        SELECT p.id, p.pm_item_id, p.spare_part_id, p.qty,
               sp.nama_part, sp.kode_12nc, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin, sp.kategori, sp.foto_url,
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point,
               ISNULL(sp.is_critical,0) AS is_critical, rk.kode AS rak_kode, bl.tingkat AS rak_tingkat
        FROM PmItemPart p
        JOIN SpareParts sp ON sp.id = p.spare_part_id
        LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin))
        LEFT JOIN Rak rk ON rk.id = bl.rak_id
        WHERE p.mesin_jenis_id=@jid
        ORDER BY sp.nama_part`);
      const data = items.map((it: any) => ({ ...it, parts: parts.recordset.filter((p: any) => p.pm_item_id === it.id) }));
      const dok = items.find((i: any) => i.kode_dokumen)?.kode_dokumen || null;
      return NextResponse.json({ success: true, mesin: m.recordset[0], sumber, kode_dokumen: dok, per_mesin: perMesin, data });
    }

    // Daftar mesin Molding
    const umum = await pool.request().query(`SELECT COUNT(*) AS n FROM PmItem WHERE is_active=1 ${perMesin ? 'AND mesin_jenis_id IS NULL' : ''}`);
    const nUmum = umum.recordset[0].n;
    const r = await pool.request().query(perMesin ? `
      SELECT j.id, j.nama, j.emoji, j.warna, j.foto, j.created_at, j.updated_at, j.is_active,
             (SELECT COUNT(*) FROM PmItem i WHERE i.mesin_jenis_id = j.id) AS item_khusus,
             (SELECT COUNT(*) FROM PmItem i WHERE i.mesin_jenis_id = j.id AND i.is_active=1) AS item_khusus_aktif,
             (SELECT TOP 1 kode_dokumen FROM PmItem i WHERE i.mesin_jenis_id = j.id AND kode_dokumen IS NOT NULL) AS kode_dokumen,
             (SELECT COUNT(DISTINCT p.pm_item_id) FROM PmItemPart p JOIN PmItem i ON i.id=p.pm_item_id
               WHERE p.mesin_jenis_id = j.id AND i.is_active=1
                 AND ( i.mesin_jenis_id = j.id
                    OR (i.mesin_jenis_id IS NULL AND NOT EXISTS (SELECT 1 FROM PmItem k WHERE k.mesin_jenis_id = j.id)) )) AS jumlah_mold,
             (SELECT COUNT(*) FROM PmItemPart p WHERE p.mesin_jenis_id = j.id) AS jumlah_part
      FROM MesinJenis j WHERE j.area = N'Molding' ${semua ? '' : 'AND j.is_active=1'}
        AND j.nama NOT IN (N'Maintenance Mold', N'Maintenance Machine')
      ORDER BY j.urutan, j.nama` : `
      SELECT j.id, j.nama, j.emoji, j.warna, j.foto, j.created_at, j.updated_at, j.is_active,
             0 AS item_khusus, 0 AS item_khusus_aktif, NULL AS kode_dokumen,
             (SELECT COUNT(DISTINCT p.pm_item_id) FROM PmItemPart p JOIN PmItem i ON i.id=p.pm_item_id
               WHERE p.mesin_jenis_id = j.id AND i.is_active=1) AS jumlah_mold,
             (SELECT COUNT(*) FROM PmItemPart p WHERE p.mesin_jenis_id = j.id) AS jumlah_part
      FROM MesinJenis j WHERE j.area = N'Molding' ${semua ? '' : 'AND j.is_active=1'}
        AND j.nama NOT IN (N'Maintenance Mold', N'Maintenance Machine')
      ORDER BY j.urutan, j.nama`);
    return NextResponse.json({ success: true, total_item: nUmum, per_mesin: perMesin, data: r.recordset.map((j: any) => {
      const { foto, ...rest } = j;
      const url = !foto ? null : String(foto).startsWith('/') ? foto : `/api/mesin?foto=${j.id}&v=${new Date(j.updated_at || j.created_at).getTime()}`;
      const khusus = j.item_khusus > 0;
      return { ...rest, foto_url: url, sumber: khusus ? 'mesin' : 'umum', total_item: khusus ? j.item_khusus_aktif : nUmum };
    }) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: pesanError(err.message) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());

    switch (b.aksi) {
      case 'item_simpan': {
        const nama = str(b.nama_bagian, 150);
        if (!nama) return bad('Nama bagian wajib diisi');
        const frek = FREK.includes(String(b.frekuensi)) ? String(b.frekuensi) : '4M';
        const jid = Number(b.mesin_jenis_id) || null;
        const perMesin = await adaKolomMesin(pool);
        if (jid && !perMesin) return bad('Checklist per mesin butuh migrasi 14. Jalankan dulu.');
        const rq = pool.request().input('nama', sql.NVarChar(150), nama).input('req', sql.NVarChar(255), str(b.requirement, 255))
          .input('frek', sql.VarChar(5), frek);
        if (b.id) {
          await rq.input('id', sql.Int, Number(b.id)).input('no', sql.Int, Number(b.no_urut) || 0)
            .query(`UPDATE PmItem SET nama_bagian=@nama, requirement=@req, frekuensi=@frek, no_urut=@no, updated_at=GETDATE() WHERE id=@id`);
          return ok('Item PM diperbarui');
        }
        if (perMesin) {
          await rq.input('jid', sql.Int, jid).query(`
            INSERT INTO PmItem (no_urut, nama_bagian, requirement, frekuensi, mesin_jenis_id)
            VALUES ((SELECT ISNULL(MAX(no_urut),0)+1 FROM PmItem WHERE ${jid ? 'mesin_jenis_id=@jid' : 'mesin_jenis_id IS NULL'}), @nama, @req, @frek, @jid)`);
        } else {
          await rq.query(`INSERT INTO PmItem (no_urut, nama_bagian, requirement, frekuensi)
                          VALUES ((SELECT ISNULL(MAX(no_urut),0)+1 FROM PmItem), @nama, @req, @frek)`);
        }
        return ok('Item PM ditambahkan');
      }
      case 'item_nonaktif': {
        await pool.request().input('id', sql.Int, Number(b.id)).input('a', sql.Bit, b.aktif ? 1 : 0)
          .query(`UPDATE PmItem SET is_active=@a, updated_at=GETDATE() WHERE id=@id`);
        return ok(b.aktif ? 'Item PM ditampilkan lagi' : 'Item PM disembunyikan');
      }
      /* Buat checklist khusus mesin dengan menyalin template umum (part yang sudah dipasang ikut pindah) */
      case 'template_salin': {
        const jid = Number(b.mesin_jenis_id);
        if (!jid) return bad('Mesin wajib dipilih');
        if (!(await adaKolomMesin(pool))) return bad('Checklist per mesin butuh migrasi 14. Jalankan dulu.');
        const ada = await pool.request().input('jid', sql.Int, jid).query(`SELECT COUNT(*) AS n FROM PmItem WHERE mesin_jenis_id=@jid`);
        if (ada.recordset[0].n > 0) return bad('Mesin ini sudah punya checklist khusus');
        const trx = new sql.Transaction(pool);
        await trx.begin();
        try {
          await new sql.Request(trx).input('jid', sql.Int, jid).query(`
            INSERT INTO PmItem (no_urut, nama_bagian, requirement, frekuensi, is_active, mesin_jenis_id)
            SELECT no_urut, nama_bagian, requirement, frekuensi, is_active, @jid FROM PmItem WHERE mesin_jenis_id IS NULL;
            UPDATE p SET p.pm_item_id = n.id
            FROM PmItemPart p
            JOIN PmItem g ON g.id = p.pm_item_id AND g.mesin_jenis_id IS NULL
            JOIN PmItem n ON n.mesin_jenis_id = @jid AND n.no_urut = g.no_urut AND n.nama_bagian = g.nama_bagian
            WHERE p.mesin_jenis_id = @jid;`);
          await trx.commit();
        } catch (e) { await trx.rollback(); throw e; }
        return ok('Checklist khusus mesin dibuat dari template umum');
      }
      /* Impor checklist dari form PM (PDF/Excel dibaca di browser). Item dengan nama sama dipertahankan (part tetap terpasang). */
      case 'template_impor': {
        const jid = Number(b.mesin_jenis_id);
        const masuk: any[] = Array.isArray(b.items) ? b.items : [];
        if (!jid) return bad('Mesin wajib dipilih');
        if (!masuk.length) return bad('Tidak ada item untuk disimpan');
        if (masuk.length > 200) return bad('Item terlalu banyak (maks 200)');
        if (!(await adaKolomMesin(pool))) return bad('Checklist per mesin butuh migrasi 14. Jalankan dulu.');
        const dok = str(b.kode_dokumen, 30);
        const kunci = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
        const trx = new sql.Transaction(pool);
        await trx.begin();
        let baru = 0, diperbarui = 0, disembunyikan = 0, dihapus = 0;
        try {
          const lama = (await new sql.Request(trx).input('jid', sql.Int, jid).query(`
            SELECT i.id, i.nama_bagian, (SELECT COUNT(*) FROM PmItemPart p WHERE p.pm_item_id = i.id) AS n_part
            FROM PmItem i WHERE i.mesin_jenis_id=@jid`)).recordset as any[];
          const pakai = new Set<number>();
          for (const it of masuk) {
            const nama = str(it.nama_bagian, 150);
            if (!nama) continue;
            const frek = FREK.includes(String(it.frekuensi)) ? String(it.frekuensi) : '4M';
            const no = Number(it.no_urut) || 0;
            const cocok = lama.find(l => !pakai.has(l.id) && kunci(l.nama_bagian) === kunci(nama));
            const rq = new sql.Request(trx).input('nama', sql.NVarChar(150), nama).input('req', sql.NVarChar(255), str(it.requirement, 255))
              .input('frek', sql.VarChar(5), frek).input('no', sql.Int, no).input('dok', sql.NVarChar(30), dok).input('jid', sql.Int, jid);
            if (cocok) {
              pakai.add(cocok.id);
              await rq.input('id', sql.Int, cocok.id).query(`UPDATE PmItem SET nama_bagian=@nama, requirement=@req, frekuensi=@frek, no_urut=@no,
                kode_dokumen=COALESCE(@dok, kode_dokumen), is_active=1, updated_at=GETDATE() WHERE id=@id`);
              diperbarui++;
            } else {
              await rq.query(`INSERT INTO PmItem (no_urut, nama_bagian, requirement, frekuensi, mesin_jenis_id, kode_dokumen)
                              VALUES (@no, @nama, @req, @frek, @jid, @dok)`);
              baru++;
            }
          }
          for (const l of lama.filter(l => !pakai.has(l.id))) {
            if (l.n_part > 0) {
              await new sql.Request(trx).input('id', sql.Int, l.id).query(`UPDATE PmItem SET is_active=0, updated_at=GETDATE() WHERE id=@id`);
              disembunyikan++;
            } else {
              await new sql.Request(trx).input('id', sql.Int, l.id).query(`DELETE FROM PmItem WHERE id=@id`);
              dihapus++;
            }
          }
          // Part yang dulu dipasang di template umum untuk mesin ini -> pindah ke item mesin dengan nama sama
          await new sql.Request(trx).input('jid', sql.Int, jid).query(`
            UPDATE p SET p.pm_item_id = n.id
            FROM PmItemPart p
            JOIN PmItem g ON g.id = p.pm_item_id AND g.mesin_jenis_id IS NULL
            JOIN PmItem n ON n.mesin_jenis_id = @jid AND LOWER(LTRIM(RTRIM(n.nama_bagian))) = LOWER(LTRIM(RTRIM(g.nama_bagian)))
            WHERE p.mesin_jenis_id = @jid
              AND NOT EXISTS (SELECT 1 FROM PmItemPart d WHERE d.pm_item_id = n.id AND d.mesin_jenis_id = @jid AND d.spare_part_id = p.spare_part_id)`);
          await trx.commit();
        } catch (e) { await trx.rollback(); throw e; }
        const rinci = [baru && `${baru} baru`, diperbarui && `${diperbarui} diperbarui`, disembunyikan && `${disembunyikan} disembunyikan (masih ada part)`, dihapus && `${dihapus} dihapus`].filter(Boolean).join(', ');
        return ok(`Checklist tersimpan: ${rinci}`);
      }
      case 'part_tambah': {
        const itemId = Number(b.pm_item_id), jid = Number(b.mesin_jenis_id), pid = Number(b.spare_part_id);
        const qty = Math.max(1, parseInt(b.qty) || 1);
        if (!itemId || !jid || !pid) return bad('Item, mesin, dan spare part wajib dipilih');
        const adaPM = (await pool.request().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
        const cek = await pool.request().input('pid', sql.Int, pid).input('jid', sql.Int, jid).input('it', sql.Int, itemId).query(`
          SELECT (SELECT mesin_jenis_id FROM SpareParts WHERE id=@pid) AS jenis_part,
                 ${adaPM ? '(SELECT COUNT(*) FROM PartMesin WHERE spare_part_id=@pid AND mesin_jenis_id=@jid)' : '0'} AS dipakai_bersama,
                 (SELECT COUNT(*) FROM PmItemPart WHERE pm_item_id=@it AND mesin_jenis_id=@jid AND spare_part_id=@pid) AS sudah`);
        const c = cek.recordset[0];
        if (c.jenis_part !== jid && !c.dipakai_bersama) return bad('Spare part ini bukan milik mesin tersebut. Pasang dulu ke mesinnya di Master Data.');
        if (c.sudah > 0) return bad('Spare part ini sudah ada di item tersebut');
        await pool.request().input('it', sql.Int, itemId).input('jid', sql.Int, jid).input('pid', sql.Int, pid).input('qty', sql.Int, qty)
          .query(`INSERT INTO PmItemPart (pm_item_id, mesin_jenis_id, spare_part_id, qty) VALUES (@it, @jid, @pid, @qty)`);
        return ok('Spare part ditambahkan ke item PM');
      }
      case 'part_ubah': {
        const qty = Math.max(1, parseInt(b.qty) || 1);
        await pool.request().input('id', sql.Int, Number(b.id)).input('qty', sql.Int, qty).query(`UPDATE PmItemPart SET qty=@qty WHERE id=@id`);
        return ok('Jumlah diperbarui');
      }
      case 'part_hapus': {
        await pool.request().input('id', sql.Int, Number(b.id)).query(`DELETE FROM PmItemPart WHERE id=@id`);
        return ok('Spare part dilepas dari item PM');
      }
      default:
        return bad('Aksi tidak dikenal');
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: pesanError(err.message) }, { status: 500 });
  }
}
