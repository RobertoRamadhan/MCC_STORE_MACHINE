const { sql, getDbConfig } = require('../config/db.js');

export type TeknisiRecord = {
  id?: number;
  nama: string;
  employee_id: string;
  role?: string;
  rfid_tag?: string | null;
  is_active?: boolean;
  gender?: string;
  password?: string;
};

export class TeknisiService {
  static async list(): Promise<TeknisiRecord[]> {
    const pool = await sql.connect(getDbConfig());
    const result = await pool.request().query(`
      SELECT id, nama, employee_id, role, rfid_tag, is_active, gender,
             ISNULL(bagian, '-') as bagian,
             ISNULL(nomor_mesin, '-') as nomor_mesin
      FROM Users ORDER BY nama ASC
    `);

    return result.recordset;
  }

  static async create(payload: TeknisiRecord): Promise<{ success: boolean; message: string }> {
    const { nama, employee_id, role, rfid_tag, password, gender } = payload;

    if (!nama || !employee_id) {
      throw new Error('Data tidak lengkap');
    }

    const pool = await sql.connect(getDbConfig());

    const cekId = await pool.request()
      .input('e', sql.VarChar, employee_id)
      .query('SELECT id FROM Users WHERE employee_id = @e');

    if (cekId.recordset.length > 0) {
      throw new Error('Employee ID sudah terdaftar');
    }

    if (rfid_tag) {
      const cekRfid = await pool.request()
        .input('r', sql.VarChar, rfid_tag)
        .query('SELECT id FROM Users WHERE rfid_tag = @r');

      if (cekRfid.recordset.length > 0) {
        throw new Error('RFID tag sudah dipakai');
      }
    }

    await pool.request()
      .input('nama', sql.VarChar, nama)
      .input('employee_id', sql.VarChar, employee_id)
      .input('role', sql.VarChar, role || 'teknisi')
      .input('rfid_tag', sql.VarChar, rfid_tag || null)
      .input('password_hash', sql.VarChar, password || 'default123')
      .input('gender', sql.VarChar, gender || 'male')
      .query(`INSERT INTO Users (nama, employee_id, role, rfid_tag, password_hash, gender) VALUES (@nama, @employee_id, @role, @rfid_tag, @password_hash, @gender)`);

    return { success: true, message: 'Pengguna berhasil ditambahkan' };
  }

  static async update(payload: any): Promise<{ success: boolean; message: string }> {
    const { id, nama, rfid_tag, is_active, gender, bagian, nomor_mesin } = payload;
    const pool = await sql.connect(getDbConfig());

    if (rfid_tag) {
      const cek = await pool.request()
        .input('r', sql.VarChar, rfid_tag)
        .input('id', sql.Int, id)
        .query('SELECT id FROM Users WHERE rfid_tag = @r AND id != @id');

      if (cek.recordset.length > 0) {
        throw new Error('RFID sudah dipakai user lain');
      }
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('nama', sql.VarChar, nama)
      .input('rfid_tag', sql.VarChar, rfid_tag || null)
      .input('is_active', sql.Bit, is_active ? 1 : 0)
      .input('gender', sql.VarChar, gender || 'male')
      .input('bagian', sql.VarChar, bagian || null)
      .input('nomor_mesin', sql.VarChar, nomor_mesin || null)
      .query(`UPDATE Users SET nama=@nama, rfid_tag=@rfid_tag, is_active=@is_active, gender=@gender, bagian=@bagian, nomor_mesin=@nomor_mesin WHERE id=@id`);

    return { success: true, message: 'Data berhasil diupdate' };
  }

  static async remove(payload: any): Promise<{ success: boolean; message: string }> {
    const { id, permanent } = payload;
    const pool = await sql.connect(getDbConfig());

    if (permanent) {
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Users WHERE id = @id AND role != \'admin\'');

      return { success: true, message: 'Pengguna berhasil dihapus permanen' };
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE Users SET is_active=0 WHERE id=@id');

    return { success: true, message: 'Pengguna dinonaktifkan' };
  }
}

export default TeknisiService;
