import fs from 'fs/promises';
import mysql from 'mysql2/promise';

// Config
import { dbConfig } from '@/config';

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

async function executeBatchStatements(
  connection: mysql.PoolConnection,
  statements: string[],
  startIndex: number,
) {
  let executed = startIndex;
  let lastStmtSnippet = '';

  for (let i = startIndex; i < statements.length; i += BATCH_SIZE) {
    const batch = statements
      .slice(i, i + BATCH_SIZE)
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    if (batch.length === 0) continue;

    console.log(
      `⚙️ 執行批次 (${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        statements.length / BATCH_SIZE,
      )}), 共 ${batch.length} 筆語句`,
    );

    lastStmtSnippet =
      batch[batch.length - 1].substring(0, 50) + '... (批次最後一句)';
    executed = i + batch.length;

    await Promise.all(batch.map((stmt) => connection.execute(stmt)));
  }

  return { executed, lastStmtSnippet };
}

async function restoreDatabase(filePath: string) {
  const pool = mysql.createPool(dbConfig);
  const connection = await pool.getConnection();
  await connection.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
  await connection.query(`USE ${dbConfig.database}`);

  let retryCount = 0;
  let lastError: any = null;
  let statements: string[] = [];
  let executedStatements = 0;

  try {
    const sqlContent = await fs.readFile(filePath, 'utf8');
    statements = sqlContent
      .split(/;\s*\n/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith('--'));

    console.log(`✅ 讀取備份檔案成功，共 ${statements.length} 筆語句`);
  } catch (err) {
    console.error('❌ 無法讀取 SQL 檔案:', err);
  }

  while (retryCount < MAX_RETRIES) {
    try {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
      console.log('⚙️ 已停用外鍵檢查');

      await executeBatchStatements(connection, statements, executedStatements);

      await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('✅ 還原成功，已重新啟用外鍵檢查');
      return;
    } catch (err: any) {
      lastError = err;
      console.error('執行語句時出錯:', err.code, err.message);
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
        console.error('❌ 無法處理的錯誤，停止還原');
        break;
      }
    }
  }

  if (retryCount >= MAX_RETRIES) {
    console.error('🚫 超過最大重試次數，還原失敗');
    if (lastError) console.error('最後錯誤:', lastError);
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.log('請提供備份檔案路徑：yarn restore ./backups/xxx.sql');
} else {
  restoreDatabase(filePath);
}
