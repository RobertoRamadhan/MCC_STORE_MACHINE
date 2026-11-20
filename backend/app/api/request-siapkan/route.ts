import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');

// Koneksi dibaca dari .env.local (DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).
// Sebelumnya server '192.168.100.1' dan password ditulis langsung di sini, sehingga gagal di laptop lain.
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'MCC_SparePartDB',
  user: process.env.DB_USER || 'mcc_user',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function getPartOutRequestColumns(pool: any) {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'PartOutRequests'
  `);
  return new Set((result.recordset || []).map((row: any) => String(row.COLUMN_NAME || '').toLowerCase()));
}

async function buildPrepareUpdateSql(pool: any) {
  const columns = await getPartOutRequestColumns(pool);
  const updates = ['status = @status'];

  if (columns.has('disiapkan_at')) updates.push('disiapkan_at = GETDATE()');
  else if (columns.has('prepared_at')) updates.push('prepared_at = GETDATE()');
  else if (columns.has('siapkan_at')) updates.push('siapkan_at = GETDATE()');
  else if (columns.has('updated_at')) updates.push('updated_at = GETDATE()');

  return `UPDATE PartOutRequests SET ${updates.join(', ')} WHERE id = @id`;
}

// PUT — Admin siapkan request + upload foto siapan
export async function PUT(req: NextRequest) {
  try {
    const { id, foto_base64 } = await req.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID request wajib' }, { status: 400 });
    }

    const pool = await sql.connect(config);

    const prepareUpdateSql = await buildPrepareUpdateSql(pool);

    // 1. Update status → Prepared
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .input('status', sql.NVarChar, 'Prepared')
      .query(prepareUpdateSql);

    // 2. Simpan foto siapan (kalau ada)
    if (foto_base64) {
      await pool.request()
        .input('request_id', sql.Int, parseInt(id))
        .input('tipe_foto', sql.NVarChar, 'Siapan')
        .input('foto_base64', sql.NVarChar(sql.MAX), foto_base64)
        .input('uploaded_by', sql.NVarChar, 'admin')
        .query(`
          INSERT INTO RequestFoto (request_id, tipe_foto, foto_base64, uploaded_by)
          VALUES (@request_id, @tipe_foto, @foto_base64, @uploaded_by)
        `);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Spare part siap! Foto tersimpan.' 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}