import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   API Lokasi rak (Opsi A: lokasi disimpan per BIN)
   GET  /api/lokasi-rak             -> daftar rak + daftar bin (beserta lokasi & jumlah warning)
   GET  /api/lokasi-rak?rak_id=3    -> daftar part di rak tsb (untuk detail / dashboard)
   GET  /api/lokasi-rak?permintaan=1 -> permintaan teknisi yang masih Pending + rak tempat part-nya
   POST /api/lokasi-rak             -> { bins: string[], rak_id: number|null, tingkat?: number|null }
                                       rak_id null = hapus lokasi bin tsb
   PUT  /api/lokasi-rak             -> { rak_id, jumlah_tingkat }  (ubah jumlah susun rak)
   Warning = stok_saat_ini <= reorder_point (sama dengan halaman Monitoring).
   ===================================================================== */

const BIN = `LTRIM(RTRIM(sp.nomor_bin))`;

export async function GET(req: NextRequest) {
  try {
    const pool = await sql.connect(getDbConfig());
    const rakId = Number(req.nextUrl.searchParams.get('rak_id'));

    if (req.nextUrl.searchParams.get('permintaan')) {
      // Part dicari pakai spare_part_id; permintaan lama yang belum punya ID dicocokkan nama persis.
      const p = await pool.request().query(`
        SELECT r.id, r.part_nama, r.jumlah, r.teknisi_nama, r.mesin_area, r.nomor_wo,
               ISNULL(r.is_urgent,0) AS is_urgent, r.created_at,
               sp.id AS spare_part_id, sp.kode_12nc, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin,
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini,
               bl.rak_id, rk.kode AS rak_kode, bl.tingkat
        FROM PartOutRequests r
        OUTER APPLY (
          SELECT TOP 1 s.id, s.kode_12nc, s.nomor_bin, s.stok_saat_ini
          FROM SpareParts s
          WHERE (r.spare_part_id IS NOT NULL AND s.id = r.spare_part_id)
             OR (r.spare_part_id IS NULL AND LOWER(LTRIM(RTRIM(s.nama_part))) = LOWER(LTRIM(RTRIM(r.part_nama))))
          ORDER BY s.id
        ) sp
        LEFT JOIN BinLokasi bl ON bl.nomor_bin = LTRIM(RTRIM(sp.nomor_bin))
        LEFT JOIN Rak rk ON rk.id = bl.rak_id
        WHERE r.status = 'Pending'
        ORDER BY ISNULL(r.is_urgent,0) DESC, r.created_at ASC
      `);
      return NextResponse.json({ success: true, data: p.recordset });
    }

    if (rakId) {
      const r = await pool.request().input('rak', sql.Int, rakId).query(`
        SELECT sp.id, sp.kode_12nc, sp.nama_part, ${BIN} AS nomor_bin, bl.tingkat,
               ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point,
               CAST(CASE WHEN ISNULL(sp.stok_saat_ini,0) <= ISNULL(sp.reorder_point,0) THEN 1 ELSE 0 END AS BIT) AS is_warning,
               ISNULL(sp.is_critical,0) AS is_critical, sp.mesin
        FROM SpareParts sp
        JOIN BinLokasi bl ON bl.nomor_bin = ${BIN}
        WHERE bl.rak_id = @rak AND ISNULL(sp.is_active,1) = 1
        ORDER BY is_warning DESC, bl.tingkat, ${BIN}, sp.nama_part
      `);
      return NextResponse.json({ success: true, data: r.recordset });
    }

    const rak = await pool.request().query(`
      SELECT r.id, r.kode, r.warna_peta, r.orientasi, r.pos_x, r.pos_y, r.lebar, r.tinggi, r.jumlah_tingkat,
             COUNT(DISTINCT bl.nomor_bin) AS jumlah_bin,
             COUNT(sp.id) AS jumlah_part,
             SUM(CASE WHEN sp.id IS NOT NULL AND ISNULL(sp.stok_saat_ini,0) <= ISNULL(sp.reorder_point,0) THEN 1 ELSE 0 END) AS jumlah_warning
      FROM Rak r
      LEFT JOIN BinLokasi bl ON bl.rak_id = r.id
      LEFT JOIN SpareParts sp ON ${BIN} = bl.nomor_bin AND ISNULL(sp.is_active,1) = 1
      WHERE r.is_active = 1
      GROUP BY r.id, r.kode, r.warna_peta, r.orientasi, r.pos_x, r.pos_y, r.lebar, r.tinggi, r.jumlah_tingkat
      ORDER BY r.kode
    `);

    const bins = await pool.request().query(`
      SELECT ${BIN} AS nomor_bin,
             COUNT(*) AS jumlah_part,
             SUM(CASE WHEN ISNULL(sp.stok_saat_ini,0) <= ISNULL(sp.reorder_point,0) THEN 1 ELSE 0 END) AS jumlah_warning,
             MIN(sp.nama_part) AS contoh_part,
             MAX(bl.rak_id) AS rak_id, MAX(r.kode) AS rak_kode, MAX(bl.tingkat) AS tingkat
      FROM SpareParts sp
      LEFT JOIN BinLokasi bl ON bl.nomor_bin = ${BIN}
      LEFT JOIN Rak r ON r.id = bl.rak_id
      WHERE sp.nomor_bin IS NOT NULL AND ${BIN} <> '' AND ISNULL(sp.is_active,1) = 1
      GROUP BY ${BIN}
      ORDER BY ${BIN}
    `);

    return NextResponse.json({ success: true, rak: rak.recordset, bins: bins.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bins: string[] = Array.isArray(body.bins)
      ? Array.from(new Set(body.bins.map((b: any) => String(b ?? '').trim()).filter((b: string) => b && b.length <= 30)))
      : [];
    if (!bins.length) return NextResponse.json({ success: false, error: 'Pilih minimal satu bin' }, { status: 400 });
    if (bins.length > 1000) return NextResponse.json({ success: false, error: 'Terlalu banyak bin sekaligus' }, { status: 400 });

    const rakId = body.rak_id == null || body.rak_id === '' ? null : Number(body.rak_id);
    const tingkatRaw = body.tingkat == null || body.tingkat === '' ? null : Number(body.tingkat);
    const tingkat = tingkatRaw != null && Number.isInteger(tingkatRaw) && tingkatRaw >= 1 && tingkatRaw <= 20 ? tingkatRaw : null;
    if (tingkatRaw != null && tingkat == null) {
      return NextResponse.json({ success: false, error: 'Susun harus angka 1-20' }, { status: 400 });
    }

    const pool = await sql.connect(getDbConfig());
    if (rakId != null) {
      const cek = await pool.request().input('id', sql.Int, rakId).query(`SELECT jumlah_tingkat FROM Rak WHERE id = @id AND is_active = 1`);
      if (!cek.recordset.length) return NextResponse.json({ success: false, error: 'Rak tidak ditemukan' }, { status: 400 });
      const maks = cek.recordset[0].jumlah_tingkat;
      if (tingkat != null && maks && tingkat > maks) {
        return NextResponse.json({ success: false, error: `Rak ini hanya punya ${maks} susun` }, { status: 400 });
      }
    }

    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      for (const bin of bins) {
        const rq = new sql.Request(trx).input('bin', sql.VarChar(30), bin);
        if (rakId == null) {
          await rq.query(`DELETE FROM BinLokasi WHERE nomor_bin = @bin`);
        } else {
          await rq.input('rak', sql.Int, rakId).input('tingkat', sql.TinyInt, tingkat).query(`
            MERGE BinLokasi AS t
            USING (SELECT @bin AS nomor_bin) AS s ON t.nomor_bin = s.nomor_bin
            WHEN MATCHED THEN UPDATE SET rak_id = @rak, tingkat = @tingkat, updated_at = GETDATE()
            WHEN NOT MATCHED THEN INSERT (nomor_bin, rak_id, tingkat) VALUES (@bin, @rak, @tingkat);
          `);
        }
      }
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }

    return NextResponse.json({
      success: true,
      message: rakId == null ? `${bins.length} bin dilepas dari rak` : `${bins.length} bin disimpan ke rak`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* Edit tata letak rak: tambah / ubah posisi & ukuran / hapus.
   PUT { aksi:'rak_simpan', id?, kode, warna_peta, orientasi, pos_x, pos_y, lebar, tinggi, jumlah_tingkat? }
   PUT { aksi:'rak_hapus', id }                                                        */
async function aturRak(b: any) {
  const pool = await sql.connect(getDbConfig());
  const bad = (e: string) => NextResponse.json({ success: false, error: e }, { status: 400 });
  if (b.aksi === 'rak_hapus') {
    const id = Number(b.id);
    if (!id) return bad('Rak tidak valid');
    const isi = await pool.request().input('id', sql.Int, id).query(`SELECT COUNT(*) AS n FROM BinLokasi WHERE rak_id = @id`);
    if (isi.recordset[0].n > 0) return bad(`Rak ini masih berisi ${isi.recordset[0].n} bin. Lepas / pindahkan bin-nya dulu.`);
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      await new sql.Request(trx).input('id', sql.Int, id).query(`
        IF COL_LENGTH('SpareParts','rak_id') IS NOT NULL EXEC sp_executesql N'UPDATE SpareParts SET rak_id = NULL WHERE rak_id = @i', N'@i INT', @i = @id;
        DELETE FROM Rak WHERE id = @id;`);
      await trx.commit();
    } catch (e) { await trx.rollback(); throw e; }
    return NextResponse.json({ success: true, message: 'Rak dihapus' });
  }
  if (b.aksi === 'rak_simpan') {
    const id = Number(b.id) || 0;
    const kode = String(b.kode ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const x = Math.trunc(Number(b.pos_x)), y = Math.trunc(Number(b.pos_y)), w = Math.trunc(Number(b.lebar)), h = Math.trunc(Number(b.tinggi));
    const warna = b.warna_peta === 'abu' ? 'abu' : 'biru';
    const ori = b.orientasi === 'vertikal' ? 'vertikal' : 'horizontal';
    const jt = b.jumlah_tingkat == null || b.jumlah_tingkat === '' ? null : Number(b.jumlah_tingkat);
    // Panjang maksimal mengikuti kolom di database (5 sebelum migrasi 21, 30 sesudahnya)
    const maks = Math.floor(Number((await pool.request().query(`SELECT COL_LENGTH('dbo.Rak','kode') AS n`)).recordset[0]?.n || 10) / 2) || 5;
    if (!/^[A-Z0-9 ._\/-]+$/.test(kode)) return bad('Kode rak hanya boleh huruf, angka, spasi, titik, garis miring atau tanda minus, mis. VM2 atau RAK KEPLER');
    if (kode.length > maks) return bad(maks <= 5 ? `Kode rak maksimal ${maks} karakter. Jalankan migrasi 21 di SSMS supaya kode rak boleh sampai 30 karakter.` : `Kode rak maksimal ${maks} karakter`);
    if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v <= 60)) return bad('Posisi rak di luar area peta');
    if (![w, h].every(v => Number.isInteger(v) && v >= 1 && v <= 30)) return bad('Ukuran rak 1-30 kotak');
    if (jt != null && (!Number.isInteger(jt) || jt < 1 || jt > 20)) return bad('Jumlah susun harus angka 1-20');
    const dup = await pool.request().input('k', sql.NVarChar(30), kode).input('id', sql.Int, id).query(`SELECT COUNT(*) AS n FROM Rak WHERE kode = @k AND id <> @id`);
    if (dup.recordset[0].n > 0) return bad(`Kode rak ${kode} sudah dipakai`);
    const tabrak = await pool.request().input('id', sql.Int, id).input('x', sql.Int, x).input('y', sql.Int, y).input('w', sql.Int, w).input('h', sql.Int, h).query(`
      SELECT TOP 1 kode FROM Rak WHERE is_active = 1 AND id <> @id
        AND pos_x < @x + @w AND @x < pos_x + lebar AND pos_y < @y + @h AND @y < pos_y + tinggi`);
    if (tabrak.recordset.length) return bad(`Posisi itu bertabrakan dengan Rak ${tabrak.recordset[0].kode}`);
    if (id && jt != null) {
      const lebih = await pool.request().input('id', sql.Int, id).input('jt', sql.Int, jt).query(`SELECT COUNT(*) AS n FROM BinLokasi WHERE rak_id = @id AND tingkat > @jt`);
      if (lebih.recordset[0].n > 0) return bad(`Ada ${lebih.recordset[0].n} bin di susun lebih tinggi dari ${jt}. Pindahkan dulu.`);
    }
    const rq = pool.request().input('k', sql.NVarChar(30), kode).input('wa', sql.NVarChar(10), warna).input('o', sql.NVarChar(10), ori)
      .input('x', sql.TinyInt, x).input('y', sql.TinyInt, y).input('w', sql.TinyInt, w).input('h', sql.TinyInt, h).input('jt', sql.TinyInt, jt);
    if (id) {
      await rq.input('id', sql.Int, id).query(`UPDATE Rak SET kode=@k, warna_peta=@wa, orientasi=@o, pos_x=@x, pos_y=@y, lebar=@w, tinggi=@h, jumlah_tingkat=@jt WHERE id=@id`);
      return NextResponse.json({ success: true, message: `Rak ${kode} disimpan` });
    }
    const r = await rq.query(`INSERT INTO Rak (kode, warna_peta, orientasi, pos_x, pos_y, lebar, tinggi, jumlah_tingkat) OUTPUT INSERTED.id
                              VALUES (@k, @wa, @o, @x, @y, @w, @h, @jt)`);
    return NextResponse.json({ success: true, message: `Rak ${kode} ditambahkan`, id: r.recordset[0].id });
  }
  return bad('Aksi tidak dikenal');
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && body.aksi) return await aturRak(body);
    const { rak_id, jumlah_tingkat } = body;
    const id = Number(rak_id);
    const jt = jumlah_tingkat == null || jumlah_tingkat === '' ? null : Number(jumlah_tingkat);
    if (!id) return NextResponse.json({ success: false, error: 'Rak tidak valid' }, { status: 400 });
    if (jt != null && (!Number.isInteger(jt) || jt < 1 || jt > 20)) {
      return NextResponse.json({ success: false, error: 'Jumlah susun harus angka 1-20' }, { status: 400 });
    }
    const pool = await sql.connect(getDbConfig());
    if (jt != null) {
      const lebih = await pool.request().input('id', sql.Int, id).input('jt', sql.TinyInt, jt)
        .query(`SELECT COUNT(*) AS n FROM BinLokasi WHERE rak_id = @id AND tingkat > @jt`);
      if (lebih.recordset[0].n > 0) {
        return NextResponse.json({ success: false, error: `Ada ${lebih.recordset[0].n} bin di susun lebih tinggi dari ${jt}. Pindahkan dulu.` }, { status: 400 });
      }
    }
    await pool.request().input('id', sql.Int, id).input('jt', sql.TinyInt, jt)
      .query(`UPDATE Rak SET jumlah_tingkat = @jt WHERE id = @id`);
    return NextResponse.json({ success: true, message: 'Jumlah susun disimpan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
