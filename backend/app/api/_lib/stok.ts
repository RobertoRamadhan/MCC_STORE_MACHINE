/* =====================================================================
   Stok aman dari "dobel".
   Gejala di lapangan: stok awal 5, Part In 2 -> stok jadi 9 (jumlah masuk terhitung 2x),
   padahal riwayat Part In hanya 1 baris. Penyebab yang paling mungkin: ada TRIGGER di database
   yang ikut mengubah stok setiap ada baris baru di PartIn / PartOut, ditambah aplikasi yang juga
   mengubah stok.
   Cara aman (tidak mengubah database): kunci stok -> simpan riwayat -> baca stok lagi ->
   set stok akhir = stok sebelum + perubahan. Jadi hasilnya benar, ada trigger atau tidak.
   ===================================================================== */
const { sql } = require('@/src/config/db.js');
type RqFn = () => any;

/** Baca stok dan kunci baris part sampai transaksi selesai (kalau dipanggil di dalam transaksi). */
export async function kunciStok(rq: RqFn, partId: number): Promise<number> {
  const r = await rq().input('pid', sql.Int, partId)
    .query(`SELECT ISNULL(stok_saat_ini,0) AS s FROM SpareParts WITH (UPDLOCK, ROWLOCK) WHERE id = @pid`);
  return Number(r.recordset[0]?.s) || 0;
}

/** Setelah riwayat disimpan: pastikan stok = sebelum + perubahan (tidak kurang dari 0). */
export async function tetapkanStok(rq: RqFn, partId: number, sebelum: number, perubahan: number): Promise<{ stok: number; olehDatabase: boolean }> {
  const target = Math.max(0, sebelum + perubahan);
  const kini = Number((await rq().input('pid', sql.Int, partId)
    .query(`SELECT ISNULL(stok_saat_ini,0) AS s FROM SpareParts WHERE id = @pid`)).recordset[0]?.s) || 0;
  const olehDatabase = kini !== sebelum; // stok sudah berubah sendiri saat riwayat disimpan = ada trigger
  if (kini !== target) {
    await rq().input('pid', sql.Int, partId).input('s', sql.Int, target)
      .query(`UPDATE SpareParts SET stok_saat_ini = @s, updated_at = GETDATE() WHERE id = @pid`);
  } else {
    await rq().input('pid', sql.Int, partId).query(`UPDATE SpareParts SET updated_at = GETDATE() WHERE id = @pid`);
  }
  if (olehDatabase) console.warn(`[stok] part ${partId}: stok berubah sendiri saat riwayat disimpan (trigger database?). Dikoreksi ke ${target}.`);
  return { stok: target, olehDatabase };
}
