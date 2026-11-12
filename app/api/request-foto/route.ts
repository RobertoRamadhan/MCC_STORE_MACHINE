import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');

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

const getDbConfig = () => ({ ...DEFAULT_DB_CONFIG });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('request_id');
    const requestIdNumber = Number(requestId);

    if (!requestId || !Number.isFinite(requestIdNumber) || requestIdNumber <= 0) {
      return NextResponse.json({ success: false, error: 'request_id wajib dan harus valid' }, { status: 400 });
    }

    const pool = await sql.connect(getDbConfig());
    const result = await pool.request()
      .input('request_id', sql.Int, requestIdNumber)
      .query(`
        SELECT id, request_id, tipe_foto, foto_base64, catatan, uploaded_by, uploaded_at
        FROM RequestFoto
        WHERE request_id = @request_id
        ORDER BY uploaded_at DESC
      `);

    return NextResponse.json({ success: true, data: result.recordset });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Gagal mengambil foto request' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = Number(body.request_id);
    const tipeFoto = String(body.tipe_foto || '').trim().toLowerCase();
    const fotoBase64 = String(body.foto_base64 || '').trim();
    const catatan = String(body.catatan || '').trim();
    const uploadedBy = String(body.uploaded_by || body.uploadedBy || 'system').trim();

    const allowedTypes = ['pengambilan', 'siapkan', 'verifikasi'];

    if (!Number.isFinite(requestId) || requestId <= 0) {
      return NextResponse.json({ success: false, error: 'request_id wajib valid' }, { status: 400 });
    }

    if (!allowedTypes.includes(tipeFoto)) {
      return NextResponse.json({ success: false, error: 'tipe_foto harus salah satu: pengambilan, siapkan, verifikasi' }, { status: 400 });
    }

    if (!fotoBase64) {
      return NextResponse.json({ success: false, error: 'foto_base64 wajib diisi' }, { status: 400 });
    }

    if (!fotoBase64.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: 'foto_base64 harus berupa data URL image (data:image/...)' }, { status: 400 });
    }

    const pool = await sql.connect(getDbConfig());
    const result = await pool.request()
      .input('request_id', sql.Int, requestId)
      .input('tipe_foto', sql.NVarChar(20), tipeFoto)
      .input('foto_base64', sql.NText, fotoBase64)
      .input('catatan', sql.NText, catatan || null)
      .input('uploaded_by', sql.NVarChar(100), uploadedBy || 'system')
      .query(`
        INSERT INTO RequestFoto (request_id, tipe_foto, foto_base64, catatan, uploaded_by)
        OUTPUT INSERTED.id
        VALUES (@request_id, @tipe_foto, @foto_base64, @catatan, @uploaded_by)
      `);

    const insertedId = result.recordset?.[0]?.id;

    return NextResponse.json({
      success: true,
      message: 'Foto dokumentasi berhasil disimpan',
      data: {
        id: insertedId,
        request_id: requestId,
        tipe_foto: tipeFoto,
        uploaded_by: uploadedBy || 'system',
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Gagal menyimpan foto dokumentasi',
    }, { status: 500 });
  }
}