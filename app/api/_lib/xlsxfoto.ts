/* =====================================================================
   Excel (.xlsx) dengan foto di dalam sel, tanpa library tambahan.
   SheetJS (xlsx 0.18) membuat isi tabel; foto disisipkan langsung ke paket .xlsx
   (xl/media + xl/drawings) memakai pembaca/penulis zip bawaan SheetJS (XLSX.CFB).
   Foto yang didukung: JPEG dan PNG (data URL base64). Format lain dilewati.
   ===================================================================== */
const XLSX = require('xlsx');

export type FotoSel = { row: number; col: number; dataUrl: string };

/** Ambil bytes + ukuran (px) dari data URL JPEG/PNG. null kalau bukan JPEG/PNG. */
export function bacaGambar(dataUrl: string): { ext: 'jpeg' | 'png'; buf: Buffer; w: number; h: number } | null {
  const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(String(dataUrl || '').trim());
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return { ext: 'png', buf, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const mk = buf[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { ext: 'jpeg', buf, h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { ext: 'jpeg', buf, w: 640, h: 480 };
  }
  return null;
}

/**
 * Buat .xlsx: baris 1 judul, baris 2 info, baris 4 header, data mulai baris 5.
 * fotos: posisi (row = indeks baris data mulai 0, col = indeks kolom mulai 0) + data URL.
 * Baris yang punya foto dibuat tinggi supaya foto terlihat.
 */
export function xlsxDenganFoto(judul: string, info: string, header: string[], baris: any[][], fotos: FotoSel[], lebarFotoPx = 170, tinggiBarisPt = 96): Buffer {
  const aoa = [[judul], [info], [], header, ...baris.map(r => r.map(v => (v == null ? '' : v)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const kolomFoto = new Set(fotos.map(f => f.col));
  ws['!cols'] = header.map((h, i) => kolomFoto.has(i) ? { wpx: lebarFotoPx + 10 }
    : { wch: Math.min(50, Math.max(String(h).length, ...baris.slice(0, 500).map(r => String(r[i] ?? '').length)) + 2) });
  const barisFoto = new Set(fotos.filter(f => bacaGambar(f.dataUrl)).map(f => f.row)); // hanya baris yang fotonya bisa ditampilkan
  ws['!rows'] = aoa.map((_, i) => (i >= 4 && barisFoto.has(i - 4) ? { hpt: tinggiBarisPt } : {}));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + baris.length, c: header.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, judul.slice(0, 31).replace(/[\\/?*:\[\]]/g, ' '));
  const dasar: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const gambar = fotos.map(f => ({ f, g: bacaGambar(f.dataUrl) })).filter(x => x.g) as { f: FotoSel; g: NonNullable<ReturnType<typeof bacaGambar>> }[];
  if (!gambar.length) return dasar;

  const CFB = XLSX.CFB;
  const zip = CFB.read(dasar, { type: 'buffer' });
  // Path CFB diawali "/" (tanpa itu, find/del tidak menemukan file)
  const ambil = (p: string) => { const e = CFB.find(zip, '/' + p); return e ? Buffer.from(e.content).toString('utf8') : null; };
  const taruh = (p: string, isi: string | Buffer) => {
    const data = typeof isi === 'string' ? Buffer.from(isi, 'utf8') : isi;
    if (CFB.find(zip, '/' + p)) CFB.utils.cfb_del(zip, '/' + p);
    CFB.utils.cfb_add(zip, '/' + p, data);
  };

  const EMU = 9525, tinggiPx = Math.round(tinggiBarisPt * 96 / 72) - 8;
  const anchors: string[] = [], rels: string[] = [];
  gambar.forEach(({ f, g }, i) => {
    const n = i + 1;
    taruh(`xl/media/foto${n}.${g.ext}`, g.buf);
    rels.push(`<Relationship Id="rIdF${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/foto${n}.${g.ext}"/>`);
    let h = tinggiPx, w = Math.round(h * (g.w || 4) / (g.h || 3));
    if (w > lebarFotoPx) { w = lebarFotoPx; h = Math.round(w * (g.h || 3) / (g.w || 4)); }
    anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>${f.col}</xdr:col><xdr:colOff>${4 * EMU}</xdr:colOff><xdr:row>${f.row + 4}</xdr:row><xdr:rowOff>${4 * EMU}</xdr:rowOff></xdr:from>`
      + `<xdr:ext cx="${w * EMU}" cy="${h * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${n + 1}" name="Foto ${n}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
      + `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdF${n}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
      + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w * EMU}" cy="${h * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
  });
  taruh('xl/drawings/drawing1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`);
  taruh('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);

  // Sheet -> drawing
  const relSheet = ambil('xl/worksheets/_rels/sheet1.xml.rels');
  const relBaru = `<Relationship Id="rIdDrw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;
  taruh('xl/worksheets/_rels/sheet1.xml.rels', relSheet ? relSheet.replace('</Relationships>', relBaru + '</Relationships>')
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relBaru}</Relationships>`);
  let sheet = ambil('xl/worksheets/sheet1.xml') || '';
  if (!/xmlns:r=/.test(sheet)) sheet = sheet.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  sheet = sheet.replace('</worksheet>', '<drawing r:id="rIdDrw1"/></worksheet>');
  taruh('xl/worksheets/sheet1.xml', sheet);

  let ct = ambil('[Content_Types].xml') || '';
  if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
  if (!/Extension="png"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default ');
  ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  taruh('[Content_Types].xml', ct);

  return Buffer.from(CFB.write(zip, { type: 'buffer', fileType: 'zip', compression: true }));
}
