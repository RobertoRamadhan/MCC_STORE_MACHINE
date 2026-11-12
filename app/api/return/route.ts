import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');

const config = {
  server: 'localhost', port: 1433,  database: 'MCC_SparePartDB',
  user: 'mcc_user', password: 'Philips2026!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

// Batas ukuran foto (teks base64). Foto sudah diperkecil di browser,
// biasanya 100-400 KB. 3 MB = pengaman supaya database tidak membengkak.
const MAX_FOTO_CHARS = 3_000_000;

// Apakah kolom foto_alasan sudah ada (migrasi 04)? Dicek sekali saja.
let fotoColumnReady: boolean | null = null;
async function hasFotoColumn(pool: any): Promise<boolean> {
  if (fotoColumnReady !== null) return fotoColumnReady;
  const r = await pool.request().query(`SELECT COL_LENGTH('dbo.ReturnParts','foto_alasan') AS len`);
  fotoColumnReady = r.recordset[0]?.len != null;
  return fotoColumnReady;
}

export async function GET(req: NextRequest) {
  try {
    const pool = await sql.connect(config);
    const adaFoto = await hasFotoColumn(pool);

    // GET /api/return?foto_id=12  -> ambil foto satu return saja
    const fotoId = Number(req.nextUrl.searchParams.get('foto_id'));
    if (fotoId) {
      if (!adaFoto) return NextResponse.json({ success: false, error: 'Kolom foto belum ada (jalankan migrasi 04)' }, { status: 404 });
      const f = await pool.request().input('id', sql.Int, fotoId)
        .query(`SELECT foto_alasan FROM ReturnParts WHERE id = @id`);
      const foto = f.recordset[0]?.foto_alasan;
      if (!foto) return NextResponse.json({ success: false, error: 'Foto tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, foto });
    }

    // Daftar return: foto TIDAK ikut dikirim (hanya tanda ada_foto) supaya ringan.
    const result = await pool.request().query(`
      SELECT rp.id, rp.nomor_do, rp.jumlah_return, rp.alasan_return AS alasan, rp.catatan,
             rp.tanggal_return, rp.spare_part_id, sp.nama_part, sp.kode_12nc,
             s.nama_supplier, u.nama as admin_nama,
             ${adaFoto ? 'CAST(CASE WHEN rp.foto_alasan IS NULL THEN 0 ELSE 1 END AS BIT)' : 'CAST(0 AS BIT)'} AS ada_foto
      FROM ReturnParts rp
      LEFT JOIN SpareParts sp ON rp.spare_part_id = sp.id
      LEFT JOIN Suppliers s ON rp.supplier_id = s.id
      LEFT JOIN Users u ON rp.admin_id = u.id
      ORDER BY rp.tanggal_return DESC
    `);
    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nomor_do, spare_part_id, nama_part, nama_supplier, jumlah, alasan, catatan, foto_alasan } = await req.json();
    if (!nomor_do || !jumlah) return NextResponse.json({ success: false, error: 'Nomor DO dan jumlah wajib diisi' }, { status: 400 });

    const jml = parseInt(jumlah);
    if (!jml || jml < 1) return NextResponse.json({ success: false, error: 'Jumlah return harus lebih dari 0' }, { status: 400 });

    const foto = typeof foto_alasan === 'string' && foto_alasan.startsWith('data:image/') ? foto_alasan : null;
    if (foto && foto.length > MAX_FOTO_CHARS) {
      return NextResponse.json({ success: false, error: 'Ukuran foto terlalu besar' }, { status: 400 });
    }

    const pool = await sql.connect(config);
    const adaFoto = await hasFotoColumn(pool);
    if (foto && !adaFoto) {
      return NextResponse.json({ success: false, error: 'Kolom foto belum ada di database (jalankan migrasi 04 dulu)' }, { status: 500 });
    }

    // Cari part:
    // 1) pakai ID dari pilihan autocomplete (paling tepat)
    // 2) kalau tidak ada, cocokkan NAMA PERSIS (tidak lagi LIKE '%..%',
    //    karena LIKE bisa mengenai part lain dan mengurangi stok part yang salah)
    let partId: number | null = null;
    const idDariForm = Number(spare_part_id) || null;
    if (idDariForm) {
      const cekId = await pool.request().input('id', sql.Int, idDariForm)
        .query(`SELECT id FROM SpareParts WHERE id = @id`);
      if (cekId.recordset.length > 0) partId = cekId.recordset[0].id;
    }
    if (!partId && nama_part) {
      const cekPart = await pool.request().input('nama', sql.NVarChar, String(nama_part))
        .query(`SELECT id FROM SpareParts WHERE LOWER(LTRIM(RTRIM(nama_part))) = LOWER(LTRIM(RTRIM(@nama)))`);
      if (cekPart.recordset.length === 1) partId = cekPart.recordset[0].id;
    }

    // Kolom spare_part_id di tabel ReturnParts wajib diisi, jadi part harus ada di katalog
    if (!partId) {
      return NextResponse.json({ success: false, error: 'Part tidak ditemukan di katalog. Pilih part dari daftar saat mengetik.' }, { status: 400 });
    }

    // Cari supplier
    let supplierId: number | null = null;
    if (nama_supplier) {
      const cekSupp = await pool.request().input('nama', sql.VarChar, nama_supplier)
        .query(`SELECT id FROM Suppliers WHERE nama_supplier LIKE '%' + @nama + '%'`);
      if (cekSupp.recordset.length > 0) supplierId = cekSupp.recordset[0].id;
    }

    // Kurangi stok + simpan return dalam SATU transaksi:
    // kalau simpan return gagal, stok tidak ikut berkurang.
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      if (partId) {
        await new sql.Request(trx).input('id', sql.Int, partId).input('jml', sql.Int, jml)
          .query(`UPDATE SpareParts SET stok_saat_ini = CASE WHEN stok_saat_ini >= @jml THEN stok_saat_ini - @jml ELSE 0 END, updated_at = GETDATE() WHERE id = @id`);
      }

      const ins = new sql.Request(trx)
        .input('spare_part_id', sql.Int, partId)
        .input('supplier_id', sql.Int, supplierId)
        .input('admin_id', sql.Int, 1)
        .input('nomor_do', sql.VarChar, nomor_do)
        .input('jumlah_return', sql.Int, jml)
        .input('alasan', sql.VarChar(50), String(alasan || 'Barang rusak / cacat').slice(0, 50))
        .input('catatan', sql.VarChar, catatan || null);

      if (adaFoto) {
        await ins.input('foto_alasan', sql.VarChar(sql.MAX), foto)
          .query(`INSERT INTO ReturnParts (spare_part_id, supplier_id, admin_id, nomor_do, jumlah_return, alasan_return, catatan, foto_alasan)
                  VALUES (@spare_part_id, @supplier_id, @admin_id, @nomor_do, @jumlah_return, @alasan, @catatan, @foto_alasan)`);
      } else {
        await ins.query(`INSERT INTO ReturnParts (spare_part_id, supplier_id, admin_id, nomor_do, jumlah_return, alasan_return, catatan)
                         VALUES (@spare_part_id, @supplier_id, @admin_id, @nomor_do, @jumlah_return, @alasan, @catatan)`);
      }
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }

    return NextResponse.json({ success: true, message: 'Return berhasil dicatat! Gate Pass siap dibuat.', stok_dikurangi: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
