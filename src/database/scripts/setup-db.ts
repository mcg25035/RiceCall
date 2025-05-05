import mysql from 'mysql2/promise';
import fs from 'fs/promises';

// Config
import { dbConfig } from '@/config';

const MAX_RETRIES = 3;

async function setupDatabase(filePath: string) {
  const pool = mysql.createPool(dbConfig);

  let retryCount = 0;
  let lastError: any = null;

  try {
    const connection = await pool.getConnection();
    await connection.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`,
    );
    await connection.query(`USE ${dbConfig.database}`);

    const schema = await fs.readFile(filePath, 'utf8');
    const statements = schema.split(';').filter((stmt) => stmt.trim());

    console.log(`✅ 讀取 schema 檔案成功，共 ${statements.length} 筆語句`);

    while (retryCount < MAX_RETRIES) {
      try {
        const connection = await pool.getConnection();
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        console.log('⚙️ 已停用外鍵檢查');

        for (const statement of statements) {
          if (statement.trim()) {
            await connection.query(statement);
          }
        }

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('✅ 初始化成功，已重新啟用外鍵檢查');
        return;
      } catch (err: any) {
        lastError = err;
        console.error('❌ 執行語句時出錯:', err.code, err.message);

        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.warn(
            `🔄 連線斷開，正在重新連接...（第 ${retryCount + 1} 次重試）`,
          );
          retryCount++;
          await new Promise((res) => setTimeout(res, 2000));
        } else if (err.code === 'ER_DUP_ENTRY') {
          console.warn('⚠️  重複主鍵，語句略過');
          break;
        } else {
          console.error('❌ 無法處理的錯誤，停止初始化');
          break;
        }
      }
    }
  } catch (err: any) {
    console.error('❌ 無法讀取 schema 檔案:', err);
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.log('請提供 schema.sql 路徑：node setup-db.js ./schema.sql');
} else {
  setupDatabase(filePath);
}
