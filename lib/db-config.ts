// .env.local sudah dibaca otomatis oleh Next.js, jadi library dotenv tidak diperlukan.

export const getDbConfig = () => {
  const dbServer = process.env.DB_SERVER || '169.254.57.26\\SQLEXPRESS';
  const dbPort = Number(process.env.DB_PORT) || 1433;
  const dbName = process.env.DB_NAME || 'MCC_SparePartDB';
  const dbUser = process.env.DB_USER || 'mcc_user';
  const dbPassword = process.env.DB_PASSWORD || 'Mcc@2026!';

  return {
    server: dbServer,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 60000,
    },
  };
};

export default getDbConfig;