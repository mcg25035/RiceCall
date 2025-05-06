import mysql from 'mysql2/promise';
import fs from 'fs/promises';

// Config
import { dbConfig } from '@/config';

const MAX_RETRIES = 3;

async function setupDatabase() {
  const pool = mysql.createPool(dbConfig);

  const connection = await pool.getConnection();
  await connection.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
  await connection.query(`USE ${dbConfig.database}`);

  let retryCount = 0;
  let lastError: any = null;
  let statements: string[] = [];

  try {
    const schema = await fs.readFile(dbConfig.schema.directory, 'utf8');

    statements = schema.split(';').filter((stmt) => stmt.trim());

    console.log(`✅ 讀取 schema 檔案成功，共 ${statements.length} 筆語句`);
  } catch (err: any) {
    console.error('❌ 無法讀取 schema 檔案:', err);
  }

  while (retryCount < MAX_RETRIES) {
    try {
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

  if (retryCount >= MAX_RETRIES) {
    console.error('🚫 超過最大重試次數，還原失敗');
    if (lastError) console.error('最後錯誤:', lastError);
  }
}

setupDatabase();
