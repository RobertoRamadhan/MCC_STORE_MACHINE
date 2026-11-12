import { NextRequest, NextResponse } from 'next/server';
import { RequestService } from '../../../backend/src/services/request.service';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* =====================================================================
   /api/requests
   GET  : daftar request (RequestService) + kolom tambahan kalau ada di database:
          alasan_ambil (migrasi 23, alasan pengambilan dari teknisi) dan alasan_tolak.
   POST : buat request lewat RequestService (tidak diubah), lalu alasan pengambilan
          disimpan ke request yang baru dibuat (migrasi 23).
   PUT  : ubah status lewat RequestService (tidak diubah).
   ===================================================================== */
async function kolomAda(pool: any, kolom: string) {
  return (await pool.request().query(`SELECT COL_LENGTH('PartOutRequests','${kolom}') AS n`)).recordset[0]?.n != null;
}

export async function GET() {
  try {
    const result = await RequestService.list();
    let data: any[] = result.data || [];
    try {
      const pool = await sql.connect(getDbConfig());
      const kol = [(await kolomAda(pool, 'alasan_ambil')) ? 'alasan_ambil' : '', (await kolomAda(pool, 'alasan_tolak')) ? 'alasan_tolak' : ''].filter(Boolean);
      if (kol.length && data.length) {
        const r = await pool.request().query(`SELECT id, ${kol.join(', ')} FROM PartOutRequests`);
        const peta: Record<number, any> = {};
        r.recordset.forEach((x: any) => { peta[x.id] = x; });
        data = data.map((d: any) => ({ ...d, ...(peta[d.id] ? Object.fromEntries(kol.map(k => [k, peta[d.id][k]])) : {}) }));
      }
    } catch { /* kolom tambahan opsional */ }
    return NextResponse.json({ success: true, data, pending: result.pending });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, data: [], pending: 0 }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result: any = await RequestService.create(body);
    const alasan = body?.alasan_ambil ? String(body.alasan_ambil).trim().slice(0, 300) : '';
    if (result?.success && alasan) {
      try {
        const pool = await sql.connect(getDbConfig());
        if (await kolomAda(pool, 'alasan_ambil')) {
          // Request yang barusan dibuat oleh teknisi ini untuk part ini (dikirim satu per satu dari web Teknisi)
          await pool.request()
            .input('a', sql.NVarChar(300), alasan)
            .input('tn', sql.VarChar(100), String(body.teknisi_nama || 'Teknisi').slice(0, 100))
            .input('pn', sql.VarChar(200), String(body.part_nama || '').slice(0, 200))
            .query(`UPDATE PartOutRequests SET alasan_ambil = @a
                    WHERE id = (SELECT MAX(id) FROM PartOutRequests
                                WHERE teknisi_nama = @tn AND part_nama = @pn AND status = 'Pending'
                                  AND alasan_ambil IS NULL AND created_at >= DATEADD(minute, -5, GETDATE()))`);
        }
      } catch { /* alasan opsional, request tetap terkirim */ }
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await RequestService.update(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
