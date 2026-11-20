/* =====================================================================
   Jatah stok per mesin untuk part yang dipakai banyak mesin (migrasi 18).
   Stok fisik tetap satu angka (SpareParts.stok_saat_ini). Jatah hanya catatan
   pembagian: jumlah semua jatah selalu diselaraskan = stok.
   Kebutuhan mesin = qty terpasang per unit x jumlah unit aktif (minimal 1).
   Folder _lib tidak menjadi URL (aturan Next.js untuk folder berawalan _).
   ===================================================================== */
const { sql } = require('@/src/config/db.js');

export type BarisJatah = { mesin_jenis_id: number; nama: string; qty_per_unit: number; unit: number; jatah: number };

export const kebutuhanMesin = (r: { qty_per_unit: number; unit: number }) =>
  Math.max(1, Math.floor(Number(r.qty_per_unit) || 1)) * Math.max(1, Math.floor(Number(r.unit) || 0));

/** Bagi bilangan bulat `total` sesuai bobot (metode sisa terbesar). Jumlah hasil = total. */
export function bagi(total: number, bobot: number[]): number[] {
  const n = bobot.length;
  if (!n || total <= 0) return bobot.map(() => 0);
  let w = bobot.map(b => (b > 0 && isFinite(b) ? b : 0));
  let W = w.reduce((a, b) => a + b, 0);
  if (W <= 0) { w = bobot.map(() => 1); W = n; }
  const mentah = w.map(x => (total * x) / W);
  const hasil = mentah.map(Math.floor);
  let sisa = total - hasil.reduce((a, b) => a + b, 0);
  const urut = mentah.map((v, i) => ({ i, f: v - Math.floor(v), w: w[i] })).sort((a, b) => b.f - a.f || b.w - a.w || a.i - b.i);
  for (let k = 0; sisa > 0; k = (k + 1) % n, sisa--) hasil[urut[k].i]++;
  return hasil;
}

/** Selaraskan jatah supaya jumlahnya = stok. Tambahan diberikan ke mesin yang paling kurang dari porsinya. */
export function selaraskan(rows: BarisJatah[], stok: number): number[] {
  const j = rows.map(r => Math.max(0, Math.floor(Number(r.jatah) || 0)));
  const s = j.reduce((a, b) => a + b, 0);
  const st = Math.max(0, Math.floor(Number(stok) || 0));
  if (s === st) return j;
  if (st === 0) return j.map(() => 0);
  const w = rows.map(kebutuhanMesin);
  const W = w.reduce((a, b) => a + b, 0);
  if (st > s) {
    const kurang = j.map((v, i) => Math.max(0, (st * w[i]) / W - v));
    const tambah = bagi(st - s, kurang.some(x => x > 0) ? kurang : w);
    return j.map((v, i) => v + tambah[i]);
  }
  const ambil = bagi(s - st, j);
  return j.map((v, i) => Math.max(0, v - ambil[i]));
}

/** Potong `qty` dari jatah: mesin pengambil dulu, sisanya dari mesin dengan jatah terbesar (dicatat sebagai pinjam). */
export function potong(rows: BarisJatah[], jatah: number[], pengambil: number | null, qty: number) {
  const j = [...jatah];
  let sisa = Math.max(0, Math.floor(qty));
  const pinjam: { dari: number; qty: number }[] = [];
  const iAmbil = pengambil == null ? -1 : rows.findIndex(r => r.mesin_jenis_id === pengambil);
  if (iAmbil >= 0) { const x = Math.min(j[iAmbil], sisa); j[iAmbil] -= x; sisa -= x; }
  const lain = rows.map((r, i) => i).filter(i => i !== iAmbil).sort((a, b) => j[b] - j[a]);
  for (const i of lain) {
    if (sisa <= 0) break;
    const x = Math.min(j[i], sisa);
    if (x > 0) { j[i] -= x; sisa -= x; pinjam.push({ dari: rows[i].mesin_jenis_id, qty: x }); }
  }
  return { jatah: j, pinjam, tidak_tertutup: sisa };
}

type RqFn = () => any;

export async function adaTabelJatah(rq: RqFn): Promise<boolean> {
  return (await rq().query(`SELECT OBJECT_ID(N'dbo.PartMesin', N'U') AS id`)).recordset[0]?.id != null;
}

export async function muatBaris(rq: RqFn, partId: number): Promise<BarisJatah[]> {
  const r = await rq().input('pid', sql.Int, partId).query(`
    SELECT pm.mesin_jenis_id, j.nama, pm.qty_per_unit, pm.jatah,
           (SELECT COUNT(*) FROM Mesin m WHERE m.jenis_id = pm.mesin_jenis_id AND ISNULL(m.is_active,1) = 1) AS unit
    FROM PartMesin pm JOIN MesinJenis j ON j.id = pm.mesin_jenis_id
    WHERE pm.spare_part_id = @pid ORDER BY j.nama`);
  return r.recordset;
}

export async function tulisJatah(rq: RqFn, partId: number, rows: BarisJatah[], jatah: number[]) {
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].jatah) === jatah[i]) continue;
    await rq().input('pid', sql.Int, partId).input('jid', sql.Int, rows[i].mesin_jenis_id).input('j', sql.Int, jatah[i])
      .query(`UPDATE PartMesin SET jatah=@j, updated_at=GETDATE() WHERE spare_part_id=@pid AND mesin_jenis_id=@jid`);
  }
}

/** Ganti daftar mesin pemakai part. Mesin utama (SpareParts.mesin_jenis_id) selalu ikut. Jatah lama dipertahankan.
 *  tambahSaja = true (dipakai Part In): mesin yang sudah terdaftar tidak dihapus, hanya ditambah / qty diperbarui. */
export async function aturMesin(rq: RqFn, partId: number, mesin: { id: number; qty_per_unit?: number }[], tambahSaja = false) {
  const p = (await rq().input('pid', sql.Int, partId).query(`SELECT mesin_jenis_id FROM SpareParts WHERE id=@pid`)).recordset[0];
  const peta = new Map<number, number>();
  if (p?.mesin_jenis_id) peta.set(Number(p.mesin_jenis_id), 1);
  for (const m of mesin || []) {
    const id = Number(m.id);
    if (id > 0) peta.set(id, Math.max(1, Math.min(999, Math.floor(Number(m.qty_per_unit) || 1))));
  }
  const ids = Array.from(peta.keys());
  // Hapus yang tidak dipilih lagi (jatahnya nanti dibagi ulang oleh selaraskan)
  if (tambahSaja) { /* tidak menghapus mesin lama */ }
  else if (ids.length) await rq().input('pid', sql.Int, partId).query(`DELETE FROM PartMesin WHERE spare_part_id=@pid AND mesin_jenis_id NOT IN (${ids.map(Number).join(',')})`);
  else await rq().input('pid', sql.Int, partId).query(`DELETE FROM PartMesin WHERE spare_part_id=@pid`);
  for (const [id, qpu] of peta) {
    await rq().input('pid', sql.Int, partId).input('jid', sql.Int, id).input('q', sql.Int, qpu).query(`
      IF EXISTS (SELECT 1 FROM PartMesin WHERE spare_part_id=@pid AND mesin_jenis_id=@jid)
        UPDATE PartMesin SET qty_per_unit=@q, updated_at=GETDATE() WHERE spare_part_id=@pid AND mesin_jenis_id=@jid
      ELSE IF EXISTS (SELECT 1 FROM MesinJenis WHERE id=@jid)
        INSERT INTO PartMesin (spare_part_id, mesin_jenis_id, qty_per_unit, jatah) VALUES (@pid, @jid, @q, 0)`);
  }
}

/** Muat, selaraskan dengan stok saat ini, simpan bila berubah. Kosong kalau part tidak dipakai bersama. */
export async function selaraskanPart(rq: RqFn, partId: number, stokOverride?: number) {
  const rows = await muatBaris(rq, partId);
  if (rows.length < 2) return { rows, jatah: rows.map(r => Number(r.jatah) || 0) };
  const stok = stokOverride ?? (Number((await rq().input('pid', sql.Int, partId).query(`SELECT ISNULL(stok_saat_ini,0) AS s FROM SpareParts WHERE id=@pid`)).recordset[0]?.s) || 0);
  const jatah = selaraskan(rows, stok);
  await tulisJatah(rq, partId, rows, jatah);
  return { rows, jatah };
}

/** Cari jenis mesin pengambil dari request: unit mesin (mesin_id) dulu, lalu teks area ("AOKI 3 · PM" -> AOKI). */
export async function cariMesinPengambil(rq: RqFn, mesinId: any, area: any): Promise<number | null> {
  if (Number(mesinId) > 0) {
    const r = (await rq().input('mid', sql.Int, Number(mesinId)).query(`SELECT jenis_id FROM Mesin WHERE id=@mid`)).recordset[0];
    if (r?.jenis_id) return Number(r.jenis_id);
  }
  const teks = String(area || '').split('·')[0].trim().toLowerCase();
  if (!teks) return null;
  const semua = (await rq().query(`SELECT id, nama FROM MesinJenis`)).recordset as { id: number; nama: string }[];
  const cocok = semua
    .filter(j => { const n = String(j.nama || '').trim().toLowerCase(); return n && (teks === n || teks.startsWith(n + ' ')); })
    .sort((a, b) => String(b.nama).length - String(a.nama).length);
  return cocok[0]?.id ?? null;
}
