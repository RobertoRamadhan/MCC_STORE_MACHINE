import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

/* =====================================================================
   GET /api/versi -> nomor build yang sedang jalan di panel.
   Dipakai halaman Admin & Teknisi untuk tahu kalau ada versi baru
   (setelah rebuild), lalu menawarkan / melakukan muat ulang otomatis.
   ===================================================================== */
export const dynamic = 'force-dynamic';

export async function GET() {
  let versi = 'dev';
  try { versi = readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim(); } catch {}
  return NextResponse.json({ versi }, { headers: { 'Cache-Control': 'no-store' } });
}
