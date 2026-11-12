import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/* =====================================================================
   Menyajikan pembaca PDF (pdf.js) dari folder public/pdfjs.
   Lewat API supaya tetap jalan walau file di public ditambahkan setelah build,
   dan Content-Type-nya pasti JavaScript (wajib untuk import modul di browser).
   GET /api/pdfjs?f=pdf.min.js | pdf.worker.min.js
   ===================================================================== */

const IZIN = new Set(['pdf.min.js', 'pdf.worker.min.js']);

export async function GET(req: NextRequest) {
  const f = req.nextUrl.searchParams.get('f') || '';
  if (!IZIN.has(f)) return new NextResponse('Not found', { status: 404 });
  try {
    const isi = await fs.readFile(path.join(process.cwd(), 'public', 'pdfjs', f));
    return new NextResponse(isi, {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new NextResponse(`File public/pdfjs/${f} tidak ditemukan di server. Copy folder public dari paket.`, { status: 404 });
  }
}
