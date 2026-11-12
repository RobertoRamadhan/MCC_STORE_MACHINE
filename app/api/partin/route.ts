import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');
import { adaTabelJatah, selaraskanPart } from '../_lib/jatah';
import { kunciStok, tetapkanStok } from '../_lib/stok';

// Koneksi dibaca dari .env.local (sebelumnya server & password ditulis langsung di sini).
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'MCC_SparePartDB',
  user: process.env.DB_USER || 'mcc_user',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

export async function GET() {
  try {
    const pool = await sql.connect(config);
    // JOIN dengan SpareParts & Suppliers supaya form Edit terisi data asli
    // (nama_supplier, nomor_bin, kategori, mesin), bukan nilai default.
    const result = await pool.request().query(`
      SELECT TOP 100
        pi.id,
        pi.spare_part_id,
        sp.nama_part,
        sp.kode_12nc,
        pi.jumlah_masuk,
        pi.nomor_do,
        pi.kondisi,
        pi.catatan,
        pi.brand,
        pi.tanggal_masuk,
        pi.supplier_id,
        su.nama_supplier,
        sp.nomor_bin,
        sp.kategori,
        sp.mesin AS nama_mesin
      FROM PartIn pi
      LEFT JOIN SpareParts sp ON sp.id = pi.spare_part_id
      LEFT JOIN Suppliers su ON su.id = pi.supplier_id
      ORDER BY pi.tanggal_masuk DESC
    `);
    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Part In HANYA mencatat barang masuk untuk part yang sudah ada di master data (Kelola part).
  // Data part (nama, 12NC, rak, mesin, merk, harga, consumable, foto) tidak diubah dari sini.
  let transaction: any = null;
  try {
    const body = await req.json();
    const { nomor_do, nama_supplier, brand, kondisi, catatan } = body;
    const partId = parseInt(body.spare_part_id);
    if (!partId) {
      return NextResponse.json({ success: false, error: 'Pilih spare part dari master data. Part yang belum ada ditambahkan dulu di Kelola part.' }, { status: 400 });
    }
    const qty = parseInt(body.jumlah) || 0;
    if (qty <= 0) {
      return NextResponse.json({ success: false, error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }

    const pool = await sql.connect(config);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Part harus ada dan aktif di master data
    const pr = await new sql.Request(transaction).input('pid', sql.Int, partId)
      .query(`SELECT id, nama_part, nomor_bin, ISNULL(is_active,1) AS aktif FROM SpareParts WHERE id = @pid`);
    const part = pr.recordset[0];
    if (!part || !part.aktif) {
      await transaction.rollback(); transaction = null;
      return NextResponse.json({ success: false, error: 'Part tidak ditemukan di master data (mungkin sudah dinonaktifkan / digabung). Muat ulang halaman lalu pilih lagi.' }, { status: 404 });
    }

    // 2. Kunci & catat stok sebelum (stok ditetapkan setelah riwayat disimpan, lihat langkah 4b)
    const rqS = () => new sql.Request(transaction);
    const stokSebelum = await kunciStok(rqS, partId);

    // 3. Supplier: cari, atau buat baru (kalau gagal pakai supplier default 1)
    let supplierId: number = 1;
    if (nama_supplier && String(nama_supplier).trim()) {
      const nmSup = String(nama_supplier).trim();
      const supRes = await new sql.Request(transaction).input('nama', sql.VarChar, nmSup)
        .query(`SELECT TOP 1 id FROM Suppliers WHERE nama_supplier = @nama`);
      if (supRes.recordset.length > 0) supplierId = supRes.recordset[0].id;
      else {
        try {
          const insertSup = await new sql.Request(transaction).input('nama', sql.VarChar, nmSup)
            .query(`INSERT INTO Suppliers (nama_supplier) VALUES (@nama); SELECT SCOPE_IDENTITY() AS id;`);
          supplierId = insertSup.recordset[0]?.id || 1;
        } catch { supplierId = 1; }
      }
    }

    // 4. Riwayat Part In (merk = merk barang yang datang di DO ini, hanya dicatat di transaksi)
    await new sql.Request(transaction)
      .input('spare_part_id', sql.Int,     partId)
      .input('supplier_id',   sql.Int,     supplierId)
      .input('admin_id',      sql.Int,     1)
      .input('jumlah_masuk',  sql.Int,     qty)
      .input('nomor_do',      sql.VarChar, nomor_do && String(nomor_do).trim() ? String(nomor_do).trim() : null)
      .input('kondisi',       sql.VarChar, kondisi   || 'Baik')
      .input('catatan',       sql.VarChar, catatan && String(catatan).trim() ? String(catatan).trim() : null)
      .input('brand',         sql.VarChar, brand && String(brand).trim() ? String(brand).trim().slice(0, 60) : null)
      .query(`
        INSERT INTO PartIn (spare_part_id, supplier_id, admin_id, jumlah_masuk, nomor_do, kondisi, catatan, brand, tanggal_masuk)
        VALUES (@spare_part_id, @supplier_id, @admin_id, @jumlah_masuk, @nomor_do, @kondisi, @catatan, @brand, GETDATE())
      `);

    // 4b. Stok akhir = stok sebelum + jumlah masuk (tepat 1x, walaupun database punya trigger stok)
    const { stok: stokBaru } = await tetapkanStok(rqS, partId, stokSebelum, qty);

    // 5. Jatah per mesin: mesin pemakai diatur di Kelola part; di sini hanya dibagi ulang sesuai stok baru
    let infoJatah = '';
    const rqT = () => new sql.Request(transaction);
    if (await adaTabelJatah(rqT)) {
      const { rows, jatah } = await selaraskanPart(rqT, partId);
      if (rows.length >= 2) infoJatah = ` Jatah: ${rows.map((r: any, i: number) => `${r.nama} ${jatah[i]}`).join(', ')}.`;
    }

    await transaction.commit();
    transaction = null;
    return NextResponse.json({
      success: true,
      message: `${part.nama_part}: +${qty} pcs masuk (stok ${stokSebelum} -> ${stokBaru})${part.nomor_bin ? `, rak ${part.nomor_bin}` : ''}.${infoJatah}`,
    });
  } catch (err: any) {
    if (transaction) {
      try { await transaction.rollback(); } catch { /* sudah dibatalkan */ }
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT — Edit riwayat Part IN.
// Aturan: kalau jumlah diubah, stok part ikut dikoreksi sebesar selisihnya
// (misal 5 -> 3 = stok -2), supaya stok selalu cocok dengan riwayat.
export async function PUT(req: NextRequest) {
  let transaction: any = null;
  try {
    const body = await req.json();
    const { id, jumlah_masuk, nomor_do, nama_supplier, kondisi, catatan, brand } = body;

    const partInId = parseInt(id);
    if (!partInId) {
      return NextResponse.json({ success: false, error: 'ID Part IN wajib' }, { status: 400 });
    }
    const newQty = parseInt(jumlah_masuk);
    if (!newQty || newQty <= 0) {
      return NextResponse.json({ success: false, error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }

    const pool = await sql.connect(config);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Ambil data lama
    const oldRes = await new sql.Request(transaction)
      .input('id', sql.Int, partInId)
      .query(`SELECT pi.spare_part_id, pi.jumlah_masuk, sp.stok_saat_ini
              FROM PartIn pi LEFT JOIN SpareParts sp ON sp.id = pi.spare_part_id
              WHERE pi.id = @id`);
    const old = oldRes.recordset[0];
    if (!old) {
      await transaction.rollback(); transaction = null;
      return NextResponse.json({ success: false, error: 'Data Part IN tidak ditemukan' }, { status: 404 });
    }

    // 2. Cek stok cukup untuk koreksi (stok ditetapkan setelah baris PartIn diubah, lihat langkah 4b)
    const diff = newQty - (parseInt(old.jumlah_masuk) || 0);
    const rqS = () => new sql.Request(transaction);
    const stokSebelum = old.spare_part_id ? await kunciStok(rqS, old.spare_part_id) : 0;
    if (old.spare_part_id && diff !== 0 && stokSebelum + diff < 0) {
      await transaction.rollback(); transaction = null;
      return NextResponse.json({
        success: false,
        error: `Stok tidak cukup untuk dikoreksi (stok sekarang ${stokSebelum}, koreksi ${diff}).`,
      }, { status: 400 });
    }

    // 3. Supplier (sama seperti POST: cari, atau buat baru)
    let supplierId: number | null = null;
    if (nama_supplier) {
      const supRes = await new sql.Request(transaction)
        .input('nama', sql.VarChar, nama_supplier)
        .query(`SELECT TOP 1 id FROM Suppliers WHERE nama_supplier = @nama`);
      if (supRes.recordset.length > 0) {
        supplierId = supRes.recordset[0].id;
      } else {
        try {
          const insertSup = await new sql.Request(transaction)
            .input('nama', sql.VarChar, nama_supplier)
            .query(`INSERT INTO Suppliers (nama_supplier) VALUES (@nama); SELECT SCOPE_IDENTITY() AS id;`);
          supplierId = insertSup.recordset[0]?.id || null;
        } catch { supplierId = null; }
      }
    }

    // 4. Update baris PartIn (supplier hanya diganti kalau diisi)
    await new sql.Request(transaction)
      .input('id',       sql.Int,     partInId)
      .input('jumlah',   sql.Int,     newQty)
      .input('nomor_do', sql.VarChar, nomor_do || null)
      .input('kondisi',  sql.VarChar, kondisi  || 'Baik')
      .input('catatan',  sql.VarChar, catatan  || null)
      .input('brand',    sql.VarChar, brand    || null)
      .input('supplier', sql.Int,     supplierId)
      .query(`UPDATE PartIn
              SET jumlah_masuk = @jumlah, nomor_do = @nomor_do, kondisi = @kondisi,
                  catatan = @catatan, brand = @brand,
                  supplier_id = COALESCE(@supplier, supplier_id)
              WHERE id = @id`);

    // 4b. Stok = stok sebelum + selisih (tepat 1x)
    if (old.spare_part_id) await tetapkanStok(rqS, old.spare_part_id, stokSebelum, diff);

    // Data part (nama, rak, kategori, mesin) TIDAK diubah dari sini: master data hanya lewat Kelola part.

    await transaction.commit();
    transaction = null;

    const info = diff === 0 ? '' : ` Stok dikoreksi ${diff > 0 ? '+' : ''}${diff}.`;
    return NextResponse.json({ success: true, message: `Data Part IN berhasil diupdate.${info}` });
  } catch (err: any) {
    if (transaction) {
      try { await transaction.rollback(); } catch { /* sudah dibatalkan */ }
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
