import { NextResponse } from 'next/server';
import { koreksiDb } from '../_lib/waktu';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* GET /api/waktu -> koreksi jam database (milidetik) untuk tampilan di browser. Hanya membaca. */
export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const koreksi_ms = await koreksiDb(pool);
    return NextResponse.json({ success: true, koreksi_ms, server_now: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ success: false, koreksi_ms: 0, error: err.message }, { status: 500 });
  }
}
