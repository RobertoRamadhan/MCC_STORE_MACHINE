const sql = require('mssql');
const config = {
  server: process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DB || 'MCC_SparePartDB',
  user: process.env.MSSQL_USER || 'mcc_user',
  password: process.env.MSSQL_PASSWORD || 'Philips2026!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};
(async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT TOP 20 id, nama, employee_id, rfid_tag, role, gender, bagian, nomor_mesin FROM Users ORDER BY id DESC");
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
