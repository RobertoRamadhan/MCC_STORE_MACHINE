import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   API Kelola pengguna (tabel Users). Kolom "dihapus" butuh migrasi 16.
   GET  /api/pengguna                     -> semua pengguna (kecuali yang sudah dihapus)
   POST /api/pengguna { aksi:'simpan', id?, nama, employee_id, role, rfid_tag, gender,
                        bagian, nomor_mesin, is_active, password? }
   POST /api/pengguna { aksi:'hapus', id }
        - belum pernah transaksi  -> dihapus permanen
        - sudah punya riwayat      -> disembunyikan (dihapus=1, nonaktif, RFID dilepas)
          supaya laporan & riwayat lama tetap utuh
   Mesin tambahan (migrasi 17, tabel UserMesin): kirim mesin_tambahan_ids: number[] saat simpan.
   Nomor RFID dibandingkan tanpa spasi, tanpa beda huruf besar/kecil, dan tanpa nol di depan.
   ===================================================================== */

const ok = (message: string, extra: any = {}) => NextResponse.json({ success: true, message, ...extra });
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });
const ISNUM = (v: any) => Number(v) || 0;
const str = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

/** Bentuk baku nomor kartu: huruf besar, tanpa spasi, angka tanpa nol di depan. */
const bakuRfid = (v: any) => {
  const s = String(v ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d+$/.test(s) ? s.replace(/^0+/, '') : s;
};
/** Ekspresi SQL yang sama untuk kolom rfid_tag. */
const SQL_RFID = `CASE WHEN UPPER(LTRIM(RTRIM(u.rfid_tag))) NOT LIKE '%[^0-9]%'
  THEN SUBSTRING(LTRIM(RTRIM(u.rfid_tag)), PATINDEX('%[^0]%', LTRIM(RTRIM(u.rfid_tag)) + 'x'), 50)
  ELSE UPPER(REPLACE(LTRIM(RTRIM(u.rfid_tag)), ' ', '')) END`;

const adaUserMesin = async (pool: any) =>
  (await pool.request().query(`SELECT OBJECT_ID(N'dbo.UserMesin', N'U') AS id`)).recordset[0]?.id != null;
const adaKolomDihapus = async (pool: any) =>
  (await pool.request().query(`SELECT COL_LENGTH('dbo.Users','dihapus') AS n`)).recordset[0]?.n != null;

export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const dh = await adaKolomDihapus(pool);
    const r = await pool.request().query(`
      SELECT u.id, u.nama, u.employee_id, u.role, u.rfid_tag, u.gender, u.bagian, u.nomor_mesin,
             u.mesin_tanggung_jawab, u.foto_url, CAST(ISNULL(u.is_active,1) AS BIT) AS is_active, u.created_at, u.updated_at
      FROM Users u ${dh ? 'WHERE ISNULL(u.dihapus,0) = 0' : ''}
      ORDER BY u.nama`);
    const um = await adaUserMesin(pool);
    let data = r.recordset;
    if (um) {
      const m = (await pool.request().query(`
        SELECT x.user_id, x.mesin_jenis_id, j.nama FROM UserMesin x JOIN MesinJenis j ON j.id = x.mesin_jenis_id`)).recordset;
      data = data.map((u: any) => ({ ...u, mesin_tambahan: m.filter((x: any) => x.user_id === u.id).map((x: any) => ({ id: x.mesin_jenis_id, nama: x.nama })) }));
    }
    return NextResponse.json({ success: true, data, migrasi16: dh, migrasi17: um });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());
    const dh = await adaKolomDihapus(pool);
    const hidup = dh ? 'ISNULL(u.dihapus,0) = 0' : '1=1';

    if (b.aksi === 'simpan') {
      const id = Number(b.id) || 0;
      const nama = str(b.nama, 100);
      const emp = str(b.employee_id, 20);
      const role = str(b.role, 20) || 'teknisi';
      const rfidMentah = str(b.rfid_tag, 50);
      const rfid = rfidMentah ? bakuRfid(rfidMentah) : '';
      const aktif = b.is_active === undefined ? true : !!b.is_active;
      if (!nama) return bad('Nama wajib diisi');
      if (!id && !emp) return bad('Employee ID wajib diisi');

      // Employee ID & RFID tidak boleh dipakai orang lain
      if (emp) {
        const c = await pool.request().input('emp', sql.VarChar(20), emp).input('id', sql.Int, id)
          .query(`SELECT TOP 1 nama FROM Users u WHERE LTRIM(RTRIM(u.employee_id)) = @emp AND u.id <> @id`);
        if (c.recordset.length) return bad(`Employee ID ${emp} sudah dipakai oleh ${c.recordset[0].nama}`);
      }
      if (rfid) {
        const c = await pool.request().input('r', sql.VarChar(50), rfid).input('id', sql.Int, id)
          .query(`SELECT TOP 1 nama FROM Users u WHERE u.rfid_tag IS NOT NULL AND ${hidup} AND u.id <> @id AND ${SQL_RFID} = @r`);
        if (c.recordset.length) return bad(`Kartu RFID ini sudah terdaftar atas nama ${c.recordset[0].nama}. Satu kartu hanya untuk satu orang.`);
      }

      // Admin aktif terakhir tidak boleh diturunkan / dinonaktifkan
      if (id && (role !== 'admin' || !aktif)) {
        const c = await pool.request().input('id', sql.Int, id).query(`
          SELECT (SELECT role FROM Users WHERE id=@id) AS role_lama,
                 (SELECT COUNT(*) FROM Users u WHERE u.role='admin' AND ISNULL(u.is_active,1)=1 AND ${hidup} AND u.id <> @id) AS admin_lain`);
        const x = c.recordset[0];
        if (x?.role_lama === 'admin' && x.admin_lain === 0) return bad('Ini satu-satunya admin aktif. Buat admin lain dulu sebelum mengubah role atau menonaktifkan akun ini.');
      }

      const rq = pool.request()
        .input('nama', sql.VarChar(100), nama).input('role', sql.VarChar(20), role)
        .input('rfid', sql.VarChar(50), rfidMentah ? rfidMentah.replace(/\s+/g, '') : null)
        .input('gender', sql.VarChar(10), b.gender === 'female' ? 'female' : 'male')
        .input('bagian', sql.VarChar(100), str(b.bagian, 100)).input('nomor', sql.VarChar(50), str(b.nomor_mesin, 50))
        .input('aktif', sql.Bit, aktif ? 1 : 0);
      const pw = str(b.password, 255);
      if (id) {
        if (emp) rq.input('emp', sql.VarChar(20), emp);
        if (pw) rq.input('pw', sql.VarChar(255), pw);
        await rq.input('id', sql.Int, id).query(`
          UPDATE Users SET nama=@nama, role=@role, rfid_tag=@rfid, gender=@gender, bagian=@bagian, nomor_mesin=@nomor,
                 is_active=@aktif${emp ? ', employee_id=@emp' : ''}${pw ? ', password_hash=@pw' : ''}, updated_at=GETDATE()
          WHERE id=@id`);
        const catatan = await simpanMesinTambahan(pool, id, b.mesin_tambahan_ids);
        return ok(`${nama} diperbarui${catatan}`);
      }
      const ins = await rq.input('emp', sql.VarChar(20), emp).input('pw', sql.VarChar(255), pw || 'default123').query(`
        INSERT INTO Users (nama, employee_id, role, rfid_tag, password_hash, is_active, gender, bagian, nomor_mesin, created_at, updated_at)
        OUTPUT INSERTED.id
        VALUES (@nama, @emp, @role, @rfid, @pw, @aktif, @gender, @bagian, @nomor, GETDATE(), GETDATE())`);
      const catatan = await simpanMesinTambahan(pool, ins.recordset[0]?.id, b.mesin_tambahan_ids);
      return ok(`${nama} ditambahkan${catatan}`);
    }

    if (b.aksi === 'hapus') {
      const id = Number(b.id);
      if (!id) return bad('Pengguna tidak valid');
      const u = (await pool.request().input('id', sql.Int, id).query(`
        SELECT u.nama, u.role,
               (SELECT COUNT(*) FROM Users x WHERE x.role='admin' AND ISNULL(x.is_active,1)=1 AND x.id <> u.id ${dh ? 'AND ISNULL(x.dihapus,0)=0' : ''}) AS admin_lain,
               (SELECT COUNT(*) FROM PartOut WHERE teknisi_id = u.id OR admin_id = u.id)
             + (SELECT COUNT(*) FROM PartIn WHERE admin_id = u.id)
             + (SELECT COUNT(*) FROM ReturnParts WHERE admin_id = u.id) AS riwayat_fk,
               (SELECT COUNT(*) FROM PartOutRequests WHERE teknisi_id = u.id) AS riwayat_req
        FROM Users u WHERE u.id = @id`)).recordset[0];
      if (!u) return bad('Pengguna tidak ditemukan');
      if (u.role === 'admin' && ISNUM(u.admin_lain) === 0) return bad('Ini satu-satunya admin aktif, tidak bisa dihapus. Buat admin lain dulu.');

      if (ISNUM(u.riwayat_fk) === 0 && ISNUM(u.riwayat_req) === 0) {
        try {
          await pool.request().input('id', sql.Int, id).query(`DELETE FROM Users WHERE id=@id`);
          return ok(`${u.nama} dihapus permanen`, { mode: 'permanen' });
        } catch (e: any) {
          // Masih direferensikan tabel lain (foreign key) -> lanjut ke cara sembunyikan di bawah
          if (!/REFERENCE|FOREIGN KEY|547/i.test(String(e.message) + String(e.number))) throw e;
        }
      }
      if (!dh) return bad(`${u.nama} punya riwayat transaksi, jadi tidak bisa dihapus permanen. Jalankan migrasi 16 dulu supaya bisa disembunyikan, atau nonaktifkan lewat Edit.`);
      // Punya riwayat: sembunyikan. Employee ID diberi awalan supaya bisa dipakai lagi untuk akun baru.
      await pool.request().input('id', sql.Int, id).query(`
        UPDATE Users SET dihapus=1, is_active=0, rfid_tag=NULL,
               employee_id = LEFT(CONCAT('X', id, '-', employee_id), 20), updated_at=GETDATE()
        WHERE id=@id`);
      return ok(`${u.nama} dihapus dari daftar. Riwayat transaksinya tetap tersimpan di laporan.`, { mode: 'sembunyi' });
    }

    return bad('Aksi tidak dikenal');
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** Ganti daftar mesin tambahan pengguna. Tidak dikirim (undefined) = tidak diubah. */
async function simpanMesinTambahan(pool: any, userId: number, ids: any): Promise<string> {
  if (!userId || !Array.isArray(ids)) return '';
  if (!(await adaUserMesin(pool))) return ids.length ? ' (mesin tambahan belum tersimpan: jalankan migrasi 17)' : '';
  const bersih: number[] = Array.from(new Set(ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))).slice(0, 50) as number[];
  const trx = new sql.Transaction(pool);
  await trx.begin();
  try {
    await new sql.Request(trx).input('u', sql.Int, userId).query(`DELETE FROM UserMesin WHERE user_id=@u`);
    for (const jid of bersih) {
      await new sql.Request(trx).input('u', sql.Int, userId).input('j', sql.Int, jid)
        .query(`IF EXISTS (SELECT 1 FROM MesinJenis WHERE id=@j) INSERT INTO UserMesin (user_id, mesin_jenis_id) VALUES (@u, @j)`);
    }
    await trx.commit();
  } catch (e) { await trx.rollback(); throw e; }
  return '';
}
