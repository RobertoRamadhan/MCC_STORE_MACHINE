/**
 * POST /api/auth/login  —  login admin / supervisor / TL.
 *
 * Menangani login admin, supervisor, dan team leader.
 *   1. Cek daftar ACCOUNTS
 *   2. Cek tabel Users: username = employee_id, password = password_hash,
 *      is_active = 1, role 'admin' / 'supervisor' / 'TL'
 * Format jawaban sama: 200 { success, token, user } · 400/401/500 { success:false, message }
 *
 * Karena berada di dalam website, halaman admin cukup memanggil '/api/auth/login'
 * dan login jalan dari laptop mana pun di jaringan.
 */
import { NextRequest, NextResponse } from 'next/server';
const sql = require('mssql');

// Disalin apa adanya dari tmp-auth-server.js (asalnya const ACCOUNTS di app/page.tsx)
const ACCOUNTS = [
  { username: 'admin',      password: 'philips2026', nama: 'Admin Store MCC',     role: 'admin',      permissions: ['all'] },
  { username: 'supervisor', password: 'super2026',   nama: 'Supervisor MCC',      role: 'supervisor', permissions: ['dashboard','catalog','partin','partout','monitoring','order','laporan','return','parts'] },
  { username: 'tl_soother', password: 'tl2026',      nama: 'TL Soother B2',       role: 'TL',         permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'Soother B2' },
  { username: 'tl_aoki',    password: 'tl2026',      nama: 'TL AOKI',             role: 'TL',         permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'AOKI' },
  { username: 'tl_mold',    password: 'tl2026',      nama: 'TL Maintenance Mold', role: 'TL',         permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'Mold' },
];

const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'MCC_SparePartDB',
  user: process.env.DB_USER || 'mcc_user',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

// Pool sendiri (tidak memakai pool global mssql) supaya tidak bentrok dengan API lain.
let poolPromise: Promise<any> | null = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect().catch((e: any) => {
      poolPromise = null;
      throw e;
    });
  }
  return poolPromise as Promise<any>;
}

async function findUser(username: string, password: string) {
  const acc = ACCOUNTS.find((a) => a.username === username && a.password === password);
  if (acc) {
    const { password: _pw, ...user } = acc;
    return { id: 0, ...user, source: 'ACCOUNTS' };
  }
  const pool = await getPool();
  const r = await pool.request()
    .input('u', username)
    .input('p', password)
    .query(`SELECT TOP 1 id, nama, employee_id, role FROM Users
            WHERE employee_id = @u AND password_hash = @p AND is_active = 1
              AND role IN ('admin','supervisor','TL')`);
  const row = r.recordset[0];
  if (!row) return null;
  return {
    id: row.id, username: row.employee_id, nama: row.nama, role: row.role,
    permissions: row.role === 'admin' ? ['all'] : [], mesin: '', source: 'DATABASE',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body || {};
    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username dan password wajib diisi!' }, { status: 400 });
    }

    const user = await findUser(String(username).trim(), String(password));
    if (!user) {
      return NextResponse.json({ success: false, message: 'Username atau password salah!' }, { status: 401 });
    }

    const { source: _source, ...publicUser } = user;
    const token = Buffer.from(JSON.stringify(publicUser)).toString('base64');
    return NextResponse.json({ success: true, token, user: publicUser });
  } catch (e: any) {
    console.error('[AUTH] ERROR', e?.message);
    return NextResponse.json({ success: false, message: 'Login error: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}