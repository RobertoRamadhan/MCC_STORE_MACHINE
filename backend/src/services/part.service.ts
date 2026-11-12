const { sql, getDbConfig } = require('../config/db.js');

export type PartRecord = {
  id?: number;
  kode_12nc?: string;
  nama_part: string;
  kategori?: string;
  mesin?: string;
  nomor_bin?: string;
  stok_saat_ini?: number;
  reorder_point?: number;
  nama?: string;                   // alternatif nama_part yang dikirim sebagian form
  is_critical?: boolean | number;  // kolom is_critical di SpareParts
};

export class PartService {
  static async list(): Promise<PartRecord[]> {
    const pool = await sql.connect(getDbConfig());
    const result = await pool.request().query(`
      SELECT id, kode_12nc, nama_part, kategori, mesin, lokasi_simpan, nomor_bin,
             stok_saat_ini, reorder_point, is_active,
             ISNULL(foto_url, '') as foto_url,
             ISNULL(is_critical, 0) as is_critical
      FROM SpareParts
      WHERE is_active = 1
      ORDER BY kategori, nama_part
    `);

    return result.recordset;
  }

  static async create(part: PartRecord): Promise<{ success: boolean; message: string }> {
    const nama = part.nama_part || part.nama;
    const { kode_12nc, kategori, mesin, nomor_bin, stok_saat_ini, reorder_point, is_critical } = part;

    if (!nama || !nomor_bin) {
      throw new Error('Nama dan Bin wajib diisi');
    }

    const pool = await sql.connect(getDbConfig());
    await pool.request()
      .input('kode_12nc', sql.VarChar, kode_12nc || null)
      .input('nama_part', sql.VarChar, nama)
      .input('kategori', sql.VarChar, kategori || 'Machine')
      .input('mesin', sql.VarChar, mesin || null)
      .input('lokasi_simpan', sql.VarChar, 'Spare Part Rack')
      .input('nomor_bin', sql.VarChar, nomor_bin)
      .input('stok', sql.Int, parseInt(String(stok_saat_ini)) || 0)
      .input('reorder', sql.Int, parseInt(String(reorder_point)) || 0)
      .input('is_critical', sql.Bit, is_critical ? 1 : 0)
      .query(`
        INSERT INTO SpareParts (kode_12nc, nama_part, kategori, mesin, lokasi_simpan, nomor_bin, stok_saat_ini, reorder_point, is_critical)
        VALUES (@kode_12nc, @nama_part, @kategori, @mesin, @lokasi_simpan, @nomor_bin, @stok, @reorder, @is_critical)
      `);

    return { success: true, message: 'Part berhasil ditambahkan' };
  }

  static async update(id: number, part: any): Promise<{ success: boolean; message: string }> {
    const pool = await sql.connect(getDbConfig());

    if (part.update_foto_only) {
      await pool.request()
        .input('id', sql.Int, id)
        .input('foto_url', sql.VarChar, part.foto_url)
        .query('UPDATE SpareParts SET foto_url=@foto_url, updated_at=GETDATE() WHERE id=@id');
      return { success: true, message: 'Foto berhasil diupdate' };
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('nama_part', sql.VarChar, part.nama_part)
      .input('kode_12nc', sql.VarChar, part.kode_12nc || null)
      .input('kategori', sql.VarChar, part.kategori)
      .input('mesin', sql.VarChar, part.mesin || null)
      .input('nomor_bin', sql.VarChar, part.nomor_bin)
      .input('stok', sql.Int, parseInt(part.stok_saat_ini) || 0)
      .input('reorder', sql.Int, parseInt(part.reorder_point) || 0)
      .input('is_critical', sql.Bit, part.is_critical ? 1 : 0)
      .query(`
        UPDATE SpareParts
        SET nama_part=@nama_part, kode_12nc=@kode_12nc, kategori=@kategori, mesin=@mesin,
            nomor_bin=@nomor_bin, stok_saat_ini=@stok, reorder_point=@reorder,
            is_critical=@is_critical, updated_at=GETDATE()
        WHERE id=@id
      `);

    return { success: true, message: 'Part berhasil diupdate' };
  }

  static async remove(id: number): Promise<{ success: boolean; message: string }> {
    const pool = await sql.connect(getDbConfig());
    await pool.request().input('id', sql.Int, id).query('UPDATE SpareParts SET is_active=0 WHERE id=@id');
    return { success: true, message: 'Part berhasil dihapus' };
  }
}

export default PartService;