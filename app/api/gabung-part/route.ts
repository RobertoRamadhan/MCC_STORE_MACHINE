import { NextRequest, NextResponse } from 'next/server';
import { adaTabelJatah, selaraskanPart } from '../_lib/jatah';
import { samakanMinStok } from '../_lib/minunit';
const { sql, getDbConfig } = require('../../../backend/src/config/db.js');

/* =====================================================================
   Gabungkan part kembar (satu barang yang tercatat 2 item).
   POST /api/gabung-part  { dari: id part kembar, ke: id part yang dipakai }
   - Semua data yang menunjuk ke part "dari" (Part In, Part Out, request, return, order,
     mesin pemakai, template PM, dll.) dipindah ke part "ke". Tabel dicari otomatis:
     foreign key ke SpareParts + semua kolom bernama spare_part_id.
   - Kalau tabel punya aturan unik (mis. part + mesin yang sama), baris "dari" yang
     bentrok dibuang karena part "ke" sudah punya baris yang sama.
   - Stok "dari" ditambahkan ke "ke". Part "dari" dinonaktifkan (stok 0, 12NC dikosongkan).
   - Semua langkah dalam satu transaksi: gagal satu, batal semua.
   ===================================================================== */
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function POST(req: NextRequest) {
  let tx: any = null;
  try {
    const b = await req.json();
    const dari = Number(b.dari), ke = Number(b.ke);
    if (!dari || !ke || dari === ke) return bad('Pilih dua part yang berbeda.');

    const pool = await sql.connect(getDbConfig());
    tx = new sql.Transaction(pool);
    await tx.begin();
    const rq = () => new sql.Request(tx);

    const P = (await rq().input('a', sql.Int, dari).input('b', sql.Int, ke).query(`
      SELECT id, nama_part, kode_12nc, nomor_bin, ISNULL(stok_saat_ini,0) AS stok, ISNULL(is_active,1) AS aktif, foto_url
      FROM SpareParts WHERE id IN (@a, @b)`)).recordset;
    const A = P.find((x: any) => x.id === dari), B = P.find((x: any) => x.id === ke);
    if (!A || !B) { await tx.rollback(); tx = null; return bad('Part tidak ditemukan.', 404); }
    if (!A.aktif || !B.aktif) { await tx.rollback(); tx = null; return bad('Salah satu part sudah nonaktif / sudah digabung.'); }

    // 1. Semua tabel yang menunjuk ke SpareParts
    const refs = (await rq().query(`
      SELECT OBJECT_SCHEMA_NAME(fk.parent_object_id) AS sch, OBJECT_NAME(fk.parent_object_id) AS tbl,
             COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS col
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.SpareParts')
      UNION
      SELECT c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE c.COLUMN_NAME = 'spare_part_id' AND t.TABLE_TYPE = 'BASE TABLE' AND c.TABLE_NAME <> 'SpareParts'`)).recordset;

    const hasil: string[] = [];
    const aman = (v: string) => /^[A-Za-z0-9_]+$/.test(v);
    for (const r of refs) {
      if (!aman(r.sch) || !aman(r.tbl) || !aman(r.col)) continue;
      const T = `[${r.sch}].[${r.tbl}]`, C = `[${r.col}]`;
      // Aturan unik yang memuat kolom part ini
      const uq = (await rq().input('t', sql.NVarChar(300), `${r.sch}.${r.tbl}`).input('c', sql.NVarChar(128), r.col).query(`
        SELECT ic.index_id, COL_NAME(ic.object_id, ic.column_id) AS col
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.object_id = OBJECT_ID(@t) AND i.is_unique = 1 AND ic.is_included_column = 0
          AND i.index_id IN (SELECT ic2.index_id FROM sys.index_columns ic2
                             WHERE ic2.object_id = i.object_id AND COL_NAME(ic2.object_id, ic2.column_id) = @c)`)).recordset;
      const per: Record<string, string[]> = {};
      uq.forEach((x: any) => { (per[x.index_id] ??= []).push(x.col); });
      let dibuang = 0;
      for (const cols of Object.values(per)) {
        const lain = cols.filter(c => c !== r.col && aman(c));
        const cond = lain.length ? lain.map(c => `t.[${c}] = s.[${c}]`).join(' AND ') : '1=1';
        const d = await rq().input('a', sql.Int, dari).input('b', sql.Int, ke).query(
          `DELETE s FROM ${T} s WHERE s.${C} = @a AND EXISTS (SELECT 1 FROM ${T} t WHERE t.${C} = @b AND ${cond})`);
        dibuang += d.rowsAffected?.[0] || 0;
      }
      const u = await rq().input('a', sql.Int, dari).input('b', sql.Int, ke).query(`UPDATE ${T} SET ${C} = @b WHERE ${C} = @a`);
      const n = u.rowsAffected?.[0] || 0;
      if (n || dibuang) hasil.push(`${r.tbl} ${n}${dibuang ? ` (+${dibuang} dobel dibuang)` : ''}`);
    }

    // 2. Data part: stok digabung, 12NC / foto / merk dilengkapi dari part kembar bila kosong
    const adaMerk = (await rq().query(`SELECT COL_LENGTH('SpareParts','merk') AS n`)).recordset[0]?.n != null;
    let merkGabung: string | null = null;
    if (adaMerk) {
      const m = (await rq().input('a', sql.Int, dari).input('b', sql.Int, ke)
        .query(`SELECT id, ISNULL(merk,'') AS merk FROM SpareParts WHERE id IN (@a,@b)`)).recordset;
      const daftar: string[] = [];
      [ke, dari].forEach(id => String(m.find((x: any) => x.id === id)?.merk || '').split(',').map(x => x.trim()).filter(Boolean)
        .forEach(x => { if (!daftar.some(y => y.toLowerCase() === x.toLowerCase())) daftar.push(x); }));
      merkGabung = daftar.join(', ').slice(0, 200) || null;
    }
    await rq().input('a', sql.Int, dari).query(`
      UPDATE SpareParts SET stok_saat_ini = 0, is_active = 0, kode_12nc = NULL, updated_at = GETDATE() WHERE id = @a`);
    await rq().input('b', sql.Int, ke).input('tambah', sql.Int, Number(A.stok) || 0)
      .input('kode', sql.VarChar(50), A.kode_12nc ? String(A.kode_12nc).trim() || null : null)
      .input('foto', sql.NVarChar(500), A.foto_url || null)
      .query(`UPDATE SpareParts SET
                stok_saat_ini = ISNULL(stok_saat_ini,0) + @tambah,
                kode_12nc = CASE WHEN kode_12nc IS NULL OR LTRIM(RTRIM(kode_12nc)) = '' THEN @kode ELSE kode_12nc END,
                foto_url  = CASE WHEN foto_url IS NULL OR LTRIM(RTRIM(foto_url)) = '' THEN @foto ELSE foto_url END,
                updated_at = GETDATE()
              WHERE id = @b`);
    if (adaMerk) await rq().input('b', sql.Int, ke).input('m', sql.NVarChar(200), merkGabung).query(`UPDATE SpareParts SET merk = @m WHERE id = @b`);

    // 3. Jatah per mesin dibagi ulang sesuai stok baru
    if (await adaTabelJatah(rq)) await selaraskanPart(rq, ke);
    await samakanMinStok(rq, ke); // min per unit (migrasi 22) ikut digabung

    await tx.commit(); tx = null;
    const stokBaru = (Number(B.stok) || 0) + (Number(A.stok) || 0);
    return NextResponse.json({
      success: true,
      message: `"${A.nama_part}" (rak ${A.nomor_bin || '-'}, stok ${A.stok}) digabung ke "${B.nama_part}" (rak ${B.nomor_bin || '-'}). Stok sekarang ${stokBaru}.${hasil.length ? ` Riwayat dipindah: ${hasil.join(', ')}.` : ''}`,
    });
  } catch (err: any) {
    if (tx) { try { await tx.rollback(); } catch { /* sudah dibatalkan */ } }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
