import fs from 'fs/promises';
import mysql from 'mysql2/promise';
import path from 'path';

// Config
import { dbConfig } from '@/config';

const MAX_RETRIES = 3;

async function getTables(connection: mysql.PoolConnection, database: string) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ?`,
    [database],
  );
  return (rows as mysql.RowDataPacket[]).map((row) => row.TABLE_NAME);
}

async function getCreateStatements(
  connection: mysql.PoolConnection,
  tables: string[],
) {
  const createStatements: Record<string, string> = {};
  const dependencies: Record<string, string[]> = {};

  for (const table of tables) {
    const [rows] = (await connection.execute(
      `SHOW CREATE TABLE \`${table}\``,
    )) as mysql.RowDataPacket[];
    const createSQL = rows[0]['Create Table'];
    createStatements[table] = createSQL;

    const foreignKeys = [
      ...createSQL.matchAll(/FOREIGN KEY \([^)]+\) REFERENCES `([^`]+)`/g),
    ].map((match) => match[1]);
    dependencies[table] = foreignKeys;
  }

  return { createStatements, dependencies };
}

function resolveCreationOrder(
  tables: string[],
  deps: Record<string, string[]>,
) {
  const order: string[] = [];
  const remaining = new Set(tables);

  while (remaining.size > 0) {
    let progress = false;

    for (const table of remaining) {
      const unmet = (deps[table] || []).filter((dep) => remaining.has(dep));
      if (unmet.length === 0) {
        order.push(table);
        remaining.delete(table);
        progress = true;
        break;
      }
    }

    if (!progress) {
      remaining.forEach((table) => order.push(table));
      break;
    }
  }

  return order;
}

async function generateInsertStatements(
  connection: mysql.PoolConnection,
  tables: string[],
) {
  let inserts = '';
  for (const table of tables) {
    console.log(`🔄 備份資料表: ${table}`);
    const [rows] = await connection.execute(`SELECT * FROM \`${table}\``);
    if ((rows as any[]).length === 0) continue;

    inserts += `-- Dumping data for table ${table};\n`;
    for (const row of rows as mysql.RowDataPacket[]) {
      const columns = Object.keys(row)
        .map((col) => `\`${col}\``)
        .join(', ');
      const values = Object.values(row)
        .map((val) => (val === null ? 'NULL' : connection.escape(val)))
        .join(', ');
      inserts += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
    }
    inserts += '\n';
  }
  return inserts;
}

async function backupDatabase() {
  const pool = mysql.createPool(dbConfig);
  const connection = await pool.getConnection();

  const database = dbConfig.database;
  const backupDir = dbConfig.backups.directory;
  const backupFileName = `${database}_backup_${Date.now()}.sql`;
  const backupFilePath = path.join(backupDir, backupFileName);

  let retryCount = 0;
  let lastError: any = null;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`🔄 開始備份資料庫: ${database}`);

      const tables = await getTables(connection, database);
      if (tables.length === 0) {
        console.log('❌ 資料庫中沒有表格。');
        return;
      }

      const { createStatements, dependencies } = await getCreateStatements(
        connection,
        tables,
      );
      const creationOrder = resolveCreationOrder(tables, dependencies);

      let sql = `-- Database: ${database}\n-- Backup generated on: ${new Date().toISOString()}\n\n`;

      // DROP TABLES
      const dropOrder = [
        'accounts',
        'badges',
        'channels',
        'direct_messages',
        'friends',
        'friend_applications',
        'friend_groups',
        'members',
        'member_applications',
        'messages',
        'servers',
        'users',
        'user_badges',
        'user_servers',
      ];
      for (const table of dropOrder) {
        if (tables.includes(table)) {
          sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
        }
      }
      sql += `-- End of DROP TABLE statements;\n\n`;

      // CREATE TABLES
      for (const table of creationOrder) {
        sql += `-- Table structure for ${table};\n`;
        sql += createStatements[table] + ';\n\n';
      }

      // INSERT DATA
      sql += await generateInsertStatements(connection, tables);
      sql += `-- End of data;\n`;

      // SAVE TO FILE
      await fs.mkdir(dbConfig.backups.directory, { recursive: true });
      await fs.writeFile(backupFilePath, sql, 'utf8');
      console.log(`✅ 備份完成: ${backupFilePath}`);
      console.log(`💡 還原方法: yarn restore ${backupFilePath}`);
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
      } else {
        console.error('❌ 無法處理的錯誤，停止備份');
        break;
      }
    }
  }

  if (retryCount >= MAX_RETRIES) {
    console.error('🚫 超過最大重試次數，備份失敗');
    if (lastError) console.error('最後錯誤:', lastError);
  }
}

backupDatabase();
