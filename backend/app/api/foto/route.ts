import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/* Menyajikan foto spare part dari public/parts (termasuk yang diupload setelah build).
   GET /api/foto?f=part-123.jpg  — hanya nama file sederhana, tidak bisa keluar dari folder parts. */
const TIPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export async function GET(req: NextRequest) {
  const f = req.nextUrl.searchParams.get('f') || '';
  const m = /^[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp|gif)$/i.exec(f);
  if (!m || f.includes('..')) return new NextResponse('Nama file tidak valid', { status: 400 });
  try {
    const isi = await readFile(join(process.cwd(), '..', 'frontend', 'public', 'parts', f));
    return new NextResponse(isi, { headers: { 'Content-Type': TIPE[m[1].toLowerCase()], 'Cache-Control': 'public, max-age=86400' } });
  } catch {
    return new NextResponse('Foto tidak ditemukan', { status: 404 });
  }
}
