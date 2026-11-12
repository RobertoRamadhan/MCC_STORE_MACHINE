/* Min stok per unit mesin (migrasi 22). Min stok part = jumlah min semua unit aktif yang diisi. */
const { sql } = require('../../../backend/src/config/db.js');
type RqFn = () => any;

export async function adaTabelMinUnit(rq: RqFn): Promise<boolean> {
  return (await rq().query(`SELECT OBJECT_ID(N'dbo.PartMinUnit', N'U') AS id`)).recordset[0]?.id != null;
}

/** Total min semua unit aktif untuk part ini. null = belum ada isian per unit (min stok tetap manual). */
export async function totalMinUnit(rq: RqFn, partId: number): Promise<number | null> {
  if (!(await adaTabelMinUnit(rq))) return null;
  const r = (await rq().input('pid', sql.Int, partId).query(`
    SELECT COUNT(*) AS n, ISNULL(SUM(CASE WHEN ISNULL(m.is_active,1) = 1 THEN pmu.min_qty ELSE 0 END),0) AS total
    FROM PartMinUnit pmu JOIN Mesin m ON m.id = pmu.unit_id
    WHERE pmu.spare_part_id = @pid AND pmu.min_qty > 0`)).recordset[0];
  return Number(r?.n) > 0 ? Number(r.total) || 0 : null;
}

/** Samakan reorder_point part dengan total min per unit (kalau ada isian per unit). */
export async function samakanMinStok(rq: RqFn, partId: number): Promise<number | null> {
  const t = await totalMinUnit(rq, partId);
  if (t != null) await rq().input('pid', sql.Int, partId).input('t', sql.Int, t)
    .query(`UPDATE SpareParts SET reorder_point = @t, updated_at = GETDATE() WHERE id = @pid`);
  return t;
}
