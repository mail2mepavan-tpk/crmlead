import sql from 'mssql';
import fs from 'fs/promises';
import path from 'path';

const appSettingsPath = path.join(process.cwd(), 'appsettings.json');
const appSettingsData = JSON.parse(await fs.readFile(appSettingsPath, 'utf8'));
const conn = appSettingsData.azure?.database?.connectionString;
if (!conn) {
  throw new Error('No connection string');
}
const pool = await sql.connect(conn);
const tables = ['SalesRegions','LeadSources','EmailGroups','Accounts','Contacts','Deals','SalesLeads','Users','Enquiries'];
for (const table of tables) {
  const result = await pool.request().query(`SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`);
  console.log('TABLE', table);
  for (const row of result.recordset) {
    console.log(`${row.COLUMN_NAME} | ${row.IS_NULLABLE} | ${row.DATA_TYPE} | ${row.COLUMN_DEFAULT}`);
  }
  console.log('---');
}
await pool.close();
