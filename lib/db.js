import mysql from 'mysql2/promise';

// One pool per server process (survives Next.js dev hot reloads).
const g = globalThis;
export const pool =
  g._ffPool ||
  (g._ffPool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  }));

// Always parameterised: pass user input in `params`, never in `sql`.
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
