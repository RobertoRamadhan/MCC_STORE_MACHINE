const { sql, getDbConfig } = require('../config/db.js');

export type RequestStatus = 'Pending' | 'Prepared' | 'Approved' | 'Rejected';

export type RequestRecord = {
  id?: number;
  teknisi_id?: number | null;
  teknisi_nama?: string;
  part_nama?: string;
  jumlah?: number;
  nomor_wo?: string | null;
  mesin_area?: string | null;
  status?: RequestStatus;
  is_urgent?: boolean;
  catatan_admin?: string | null;
  disiapkan_at?: string | null;
  diverifikasi_at?: string | null;
  created_at?: string;
  // Kolom baru (migrasi 02)
  spare_part_id?: number | null;
  mesin_id?: number | null;
  mold_id?: number | null;
  approved_at?: string | null;
  prepared_at?: string | null;
  alasan_tolak?: string | null;
};

// Kolom mold_id (migrasi 09) dicek sekali; kalau belum ada, tidak diisi.
let adaKolomMold: boolean | null = null;
async function cekKolomMold(pool: any): Promise<boolean> {
  if (adaKolomMold !== null) return adaKolomMold;
  const r = await pool.request().query(`SELECT COL_LENGTH('dbo.PartOutRequests','mold_id') AS len`);
  adaKolomMold = r.recordset[0]?.len != null;
  return adaKolomMold;
}

export class RequestService {
  static async list(): Promise<{ data: RequestRecord[]; pending: number }> {
    const pool = await sql.connect(getDbConfig());
    const result = await pool.request().query(`
      SELECT id, teknisi_id, teknisi_nama, part_nama,
             jumlah, nomor_wo, mesin_area, status,
             ISNULL(is_urgent, 0) AS is_urgent,
             created_at,
             spare_part_id, mesin_id, approved_at, prepared_at, alasan_tolak
      FROM PartOutRequests
      ORDER BY created_at DESC
    `);

    const data = (result.recordset || []).map((row: any) => ({
      ...row,
      catatan_admin: row.alasan_tolak || null,
      disiapkan_at: row.prepared_at || null,
      diverifikasi_at: null,
    }));

    return {
      data,
      pending: data.filter((x: any) => x.status === 'Pending').length,
    };
  }

  static async create(payload: RequestRecord): Promise<{ success: boolean; message: string }> {
    const { teknisi_id, teknisi_nama, part_nama, jumlah, nomor_wo, mesin_area, is_urgent } = payload;

    if (!part_nama || !jumlah) {
      throw new Error('Part dan jumlah wajib diisi');
    }

    const pool = await sql.connect(getDbConfig());

    // Cari ID part (untuk kode 12NC di laporan). Pakai ID dari web Teknisi bila ada,
    // kalau tidak ada, cari berdasarkan nama part. Boleh tetap kosong (NULL).
    let sparePartId: number | null = Number(payload.spare_part_id) || null;
    if (!sparePartId) {
      const found = await pool.request()
        .input('nama', sql.NVarChar, part_nama)
        .query(`SELECT TOP 1 id FROM SpareParts WHERE LOWER(LTRIM(RTRIM(nama_part))) = LOWER(LTRIM(RTRIM(@nama)))`);
      sparePartId = found.recordset[0]?.id ?? null;
    }

    const pakaiMold = await cekKolomMold(pool);
    const moldId = pakaiMold ? (Number(payload.mold_id) || null) : null;

    await pool.request()
      .input('teknisi_id', sql.Int, teknisi_id ? parseInt(String(teknisi_id)) : null)
      .input('teknisi_nama', sql.VarChar, teknisi_nama || 'Teknisi')
      .input('part_nama', sql.VarChar, part_nama)
      .input('jumlah', sql.Int, parseInt(String(jumlah)) || 1)
      .input('nomor_wo', sql.VarChar, nomor_wo || null)
      .input('mesin_area', sql.VarChar, mesin_area || null)
      .input('is_urgent', sql.Bit, is_urgent ? 1 : 0)
      .input('spare_part_id', sql.Int, sparePartId)
      .input('mesin_id', sql.Int, Number(payload.mesin_id) || null)
      .input('mold_id', sql.Int, moldId)
      .query(`
        INSERT INTO PartOutRequests
          (teknisi_id, teknisi_nama, part_nama, jumlah, nomor_wo, mesin_area, status, is_urgent, created_at, spare_part_id, mesin_id${pakaiMold ? ', mold_id' : ''})
        VALUES
          (@teknisi_id, @teknisi_nama, @part_nama, @jumlah, @nomor_wo, @mesin_area, 'Pending', @is_urgent, GETDATE(), @spare_part_id, @mesin_id${pakaiMold ? ', @mold_id' : ''})
      `);

    return {
      success: true,
      message: is_urgent ? '🚨 Request URGENT dikirim!' : 'Request berhasil dikirim',
    };
  }

  static async update(payload: any): Promise<{ success: boolean; message: string }> {
    const { id, status } = payload;
    const allowedStatus = ['Pending', 'Prepared', 'Approved', 'Rejected'];

    if (!allowedStatus.includes(status)) {
      throw new Error('Status tidak valid');
    }

    const alasan = status === 'Rejected'
      ? (String(payload.alasan_tolak ?? '').trim().slice(0, 100) || null)
      : null;

    const pool = await sql.connect(getDbConfig());
    await pool.request()
      .input('status', sql.NVarChar, status)
      .input('id', sql.Int, parseInt(id))
      .input('alasan', sql.NVarChar(100), alasan)
      .query(`
        UPDATE PartOutRequests SET
          status       = @status,
          prepared_at  = CASE WHEN @status = 'Prepared' AND prepared_at IS NULL THEN GETDATE() ELSE prepared_at END,
          approved_at  = CASE WHEN @status = 'Approved' AND approved_at IS NULL THEN GETDATE() ELSE approved_at END,
          alasan_tolak = CASE WHEN @status = 'Rejected' THEN ISNULL(@alasan, alasan_tolak) ELSE alasan_tolak END
        WHERE id = @id
      `);

    return {
      success: true,
      message: `Status updated: ${status}`,
    };
  }
}

export default RequestService;
