import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/* Upload foto spare part ke public/parts.
   Catatan: Next.js (mode produksi) hanya menyajikan file public/ yang sudah ada saat build,
   jadi foto baru disajikan lewat /api/foto?f=<nama file> supaya langsung tampil tanpa build ulang. */
const EXT_OK = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const partId = String(formData.get('partId') || '').replace(/[^0-9A-Za-z_-]/g, '');

    if (!file) return NextResponse.json({ success: false, error: 'File tidak ada' }, { status: 400 });
    const ext = String(file.name.split('.').pop() || '').toLowerCase();
    if (!EXT_OK.includes(ext)) return NextResponse.json({ success: false, error: 'Format foto harus JPG, PNG, WEBP, atau GIF' }, { status: 400 });

    const dir = join(process.cwd(), 'public', 'parts');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    const fileName = `part-${partId || Date.now()}.${ext}`;
    await writeFile(join(dir, fileName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ success: true, url: `/api/foto?f=${fileName}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
