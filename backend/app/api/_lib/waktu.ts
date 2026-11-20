/* =====================================================================
   Jam dari database.
   Kolom DATETIME diisi GETDATE() = jam lokal Panel PC (WIB). Driver mssql bisa membaca
   nilai itu sebagai UTC, sehingga di layar / laporan jamnya maju 7 jam (mis. Part In jam
   08.00 tampil 15.00). Selisihnya dideteksi otomatis (GETDATE() dibanding jam Node.js):
   - driver membaca sebagai UTC  -> koreksi = +7 jam (dikurangi saat tampil, ditambah saat filter)
   - driver sudah benar          -> koreksi = 0 (tidak ada yang berubah)
   ===================================================================== */
let cache: { ms: number; at: number } | null = null;

export async function koreksiDb(pool: any): Promise<number> {
  if (cache && Date.now() - cache.at < 10 * 60000) return cache.ms;
  const t = (await pool.request().query('SELECT GETDATE() AS t')).recordset[0]?.t;
  const raw = new Date(t).getTime() - Date.now();
  // Hanya selisih >= 1 jam yang dianggap salah baca zona waktu (bukan jam PC yang sedikit beda)
  const ms = isFinite(raw) && Math.abs(raw) >= 3600000 ? Math.round(raw / 900000) * 900000 : 0;
  cache = { ms, at: Date.now() };
  return ms;
}

/** Nilai tanggal dari database -> Date dengan jam yang benar */
export const dariDb = (v: any, ms: number): Date | null => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : new Date(d.getTime() - ms);
};
/** Date (jam lokal) -> nilai parameter filter ke database */
export const keDb = (d: Date, ms: number) => new Date(d.getTime() + ms);

const p2 = (n: number) => String(n).padStart(2, '0');
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const fmtTanggal = (d: Date | null) => (d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : '');
export const fmtJam = (d: Date | null) => (d ? `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` : '');
export const fmtHari = (d: Date | null) => (d ? HARI[d.getDay()] : '');
export const fmtWaktuLengkap = (d: Date | null) => (d ? `${fmtTanggal(d)} ${fmtJam(d)}` : '');
