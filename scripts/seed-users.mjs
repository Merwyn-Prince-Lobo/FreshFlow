// Run: npm run seed:users   (loads .env.local first via --env-file)
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

const users = [
  ['admin@freshflow.local', 'Admin@123'],
  ['staff@freshflow.local', 'Staff@123'],
];
for (const [email, pw] of users) {
  await conn.execute('UPDATE APP_USER SET Password_Hash = ? WHERE Email = ?',
    [await bcrypt.hash(pw, 10), email]);
}
console.log('Passwords set. Change them after first login.');
await conn.end();
