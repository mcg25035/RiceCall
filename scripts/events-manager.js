/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const database = require('../database');
const Logger = require('../utils/logger');

// 創建日誌記錄器
const logger = new Logger('EventsManager');

// 創建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 提問函數
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// 將駝峰命名轉換為下劃線命名
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// 將下劃線命名轉換為駝峰命名
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// 將對象鍵轉換為駝峰命名
function convertToCamelCase(obj) {
  if (!obj) return null;
  const result = {};
  for (const key in obj) {
    result[snakeToCamel(key)] = obj[key];
  }
  return result;
}

// 檢查依賴關係
async function checkDependencies(autoMode = false) {
  logger.info('開始檢查活動功能依賴的數據庫表');

  try {
    // 使用 database.js
    logger.info('數據庫連接成功');

    // 需要檢查的表和列
    const requiredTables = [
      { table: 'badges', primaryKey: 'badge_id' },
      { table: 'servers', primaryKey: 'server_id' },
      { table: 'channels', primaryKey: 'channel_id' },
      { table: 'users', primaryKey: 'user_id' },
    ];

    // 檢查每個表是否存在
    for (const { table, primaryKey } of requiredTables) {
      logger.info(`檢查表 ${table} 是否存在...`);

      // 檢查表是否存在
      const tables = await database.query(`SHOW TABLES LIKE '${table}'`);

      if (tables.length === 0) {
        logger.error(`錯誤: 表 ${table} 不存在!`);
        logger.info(`請先創建 ${table} 表，或者暫時註釋掉外鍵約束`);
        continue;
      }

      // 檢查表結構
      logger.info(`檢查表 ${table} 的主鍵...`);
      const columns = await database.query(`SHOW COLUMNS FROM ${table}`);

      // 找到主鍵列
      const primaryKeyColumn = columns.find((col) => col.Key === 'PRI');

      if (!primaryKeyColumn) {
        logger.error(`錯誤: 表 ${table} 沒有主鍵!`);
        continue;
      }

      // 檢查主鍵列名是否匹配預期
      if (primaryKeyColumn.Field !== primaryKey) {
        logger.error(
          `錯誤: 表 ${table} 的主鍵是 ${primaryKeyColumn.Field}，而不是預期的 ${primaryKey}!`,
        );
        logger.info(
          `可能需要修改 add_events_tables.sql 中的外鍵約束，使用 ${primaryKeyColumn.Field} 而不是 ${primaryKey}`,
        );
      } else {
        logger.info(`表 ${table} 存在且主鍵 ${primaryKey} 正確`);
      }
    }

    logger.info('依賴檢查完成');

    // 提供解決方案建議
    logger.info('\n推薦解決方案:');
    logger.info('1. 確保所有依賴表都存在並有正確的主鍵');
    logger.info('2. 修改外鍵約束中的列名與現有表匹配');
    logger.info(
      '3. 或者暫時註釋掉外鍵約束（已在修改後的 add_events_tables.sql 中完成）',
    );

    if (!autoMode) {
      const choice = await question('\n是否要繼續創建/更新活動表? (y/n): ');
      if (choice.toLowerCase() === 'y') {
        await updateEventsStructure();
      }
    }
  } catch (error) {
    logger.error(`檢查失敗: ${error.message}`);
  }
}

// 更新活動表結構
async function updateEventsStructure() {
  logger.info('開始更新活動表結構');

  try {
    // 檢查 events 表是否存在
    const eventsTables = await database.query("SHOW TABLES LIKE 'events'");

    if (eventsTables.length === 0) {
      // 如果表不存在，創建基本表結構
      await createBaseTables();
    } else {
      // 如果表存在，添加缺少的欄位
      await addMissingColumns();
    }

    logger.info('活動表結構更新成功！');

    // 檢查更新後的表結構
    await verifyEventsSetup();
  } catch (error) {
    logger.error(`更新失敗: ${error.message}`);
    console.error('詳細錯誤:', error);
  }
}

// 創建基本表結構
async function createBaseTables() {
  logger.info('創建基本活動表結構...');

  const createTablesSql = `
  -- 創建活動表
  CREATE TABLE IF NOT EXISTS \`events\` (
    \`event_id\` char(36) NOT NULL,
    \`name\` varchar(255) NOT NULL DEFAULT '',
    \`description\` text NOT NULL,
    \`type\` enum('xp_boost','badge_collection','special') NOT NULL DEFAULT 'xp_boost',
    \`xp_boost\` float NOT NULL DEFAULT 0,
    \`start_time\` bigint(20) NOT NULL DEFAULT 0,
    \`end_time\` bigint(20) NOT NULL DEFAULT 0,
    \`badge_id\` char(36) DEFAULT NULL,
    \`badge_required_time\` bigint(20) DEFAULT NULL,
    \`server_id\` char(36) DEFAULT NULL,
    \`channel_id\` char(36) DEFAULT NULL,
    \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
    \`created_at\` bigint(20) NOT NULL DEFAULT 0,
    PRIMARY KEY (\`event_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  -- 創建用戶參與活動記錄表
  CREATE TABLE IF NOT EXISTS \`event_participants\` (
    \`user_id\` char(36) NOT NULL,
    \`event_id\` char(36) NOT NULL,
    \`joined_at\` bigint(20) NOT NULL DEFAULT 0,
    \`total_time\` bigint(20) NOT NULL DEFAULT 0,
    \`badge_earned\` tinyint(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (\`user_id\`, \`event_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  
  -- 添加外鍵約束 (如果需要，取消註釋)
  /*
  ALTER TABLE \`events\`
    ADD CONSTRAINT \`fk_events_badge\` FOREIGN KEY (\`badge_id\`) REFERENCES \`badges\` (\`badge_id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT \`fk_events_server\` FOREIGN KEY (\`server_id\`) REFERENCES \`servers\` (\`server_id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT \`fk_events_channel\` FOREIGN KEY (\`channel_id\`) REFERENCES \`channels\` (\`channel_id\`) ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE \`event_participants\`
    ADD CONSTRAINT \`fk_event_participants_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT \`fk_event_participants_event\` FOREIGN KEY (\`event_id\`) REFERENCES \`events\` (\`event_id\`) ON DELETE CASCADE ON UPDATE CASCADE;
  */
  `;

  // 執行 SQL 語句
  await database.query(createTablesSql);
  logger.info('基本活動表結構創建成功！');

  // 創建示例徽章（如果不存在）
  await createExampleBadges();
}

// 添加缺少的欄位
async function addMissingColumns() {
  logger.info('檢查並添加缺少的欄位...');

  // 獲取當前表結構
  const columns = await database.query('DESCRIBE events');
  const columnNames = columns.map((col) => col.Field);

  // 需要檢查的欄位
  const requiredColumns = [
    {
      name: 'type',
      sql: "ADD COLUMN `type` enum('xp_boost','badge_collection','special') NOT NULL DEFAULT 'xp_boost' AFTER `description`",
    },
    {
      name: 'xp_boost',
      sql: 'ADD COLUMN `xp_boost` FLOAT NOT NULL DEFAULT 0 AFTER `type`',
    },
    {
      name: 'server_id',
      sql: 'ADD COLUMN `server_id` CHAR(36) NULL AFTER `badge_required_time`',
    },
    {
      name: 'channel_id',
      sql: 'ADD COLUMN `channel_id` CHAR(36) NULL AFTER `server_id`',
    },
    {
      name: 'is_active',
      sql: 'ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `channel_id`',
    },
  ];

  for (const col of requiredColumns) {
    if (!columnNames.includes(col.name)) {
      logger.info(`添加缺少的欄位: ${col.name}`);
      await database.query(`ALTER TABLE events ${col.sql}`);
    }
  }

  logger.info('所有必要欄位已添加');
}

// 創建示例徽章
async function createExampleBadges() {
  logger.info('檢查是否有示例徽章...');
  const badges = await database.query('SELECT * FROM badges LIMIT 1');

  if (badges.length === 0) {
    logger.info('創建示例徽章...');

    // 檢查badges表是否存在
    const badgesTables = await database.query("SHOW TABLES LIKE 'badges'");

    if (badgesTables.length === 0) {
      // 創建badges表
      logger.info('badges表不存在，創建badges表...');
      await database.query(`
        CREATE TABLE IF NOT EXISTS \`badges\` (
          \`badge_id\` char(36) NOT NULL,
          \`name\` varchar(255) NOT NULL DEFAULT 'Unknown',
          \`description\` varchar(255) NOT NULL DEFAULT '',
          \`rare\` varchar(20) NOT NULL DEFAULT 'common',
          \`order\` int(11) NOT NULL DEFAULT 0,
          \`created_at\` bigint(20) NOT NULL DEFAULT 0,
          PRIMARY KEY (\`badge_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }

    const exampleBadges = [
      {
        badgeId: uuidv4(),
        name: '活動參與者',
        description: '參與過特別活動的用戶',
        rare: 'common',
        order: 1,
        createdAt: Date.now(),
      },
      {
        badgeId: uuidv4(),
        name: '活動達人',
        description: '在活動中停留超過20小時的用戶',
        rare: 'common',
        order: 2,
        createdAt: Date.now(),
      },
      {
        badgeId: uuidv4(),
        name: '超級粉絲',
        description: '在特定頻道停留超過50小時的專屬徽章',
        rare: 'common',
        order: 3,
        createdAt: Date.now(),
      },
    ];

    for (const badge of exampleBadges) {
      await database.query(
        'INSERT INTO badges (badge_id, name, description, rare, `order`, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          badge.badgeId,
          badge.name,
          badge.description,
          badge.rare,
          badge.order,
          badge.createdAt,
        ],
      );
    }

    logger.info(`創建了 ${exampleBadges.length} 個示例徽章`);
  }
}

// 驗證活動表設置
async function verifyEventsSetup() {
  logger.info('開始驗證活動表');

  try {
    // 檢查表是否存在
    logger.info('檢查活動表是否存在...');
    const eventsTables = await database.query("SHOW TABLES LIKE 'events'");

    if (eventsTables.length === 0) {
      logger.error('活動表不存在!');
    } else {
      logger.info('活動表已存在');

      // 檢查表結構
      logger.info('檢查活動表結構...');
      const eventsColumns = await database.query('DESCRIBE events');

      logger.info(`活動表有 ${eventsColumns.length} 個欄位:`);
      eventsColumns.forEach((column) => {
        logger.info(`- ${column.Field} (${column.Type})`);
      });
    }

    // 檢查participants表
    logger.info('檢查活動參與者表是否存在...');
    const participantsTables = await database.query(
      "SHOW TABLES LIKE 'event_participants'",
    );

    if (participantsTables.length === 0) {
      logger.error('活動參與者表不存在!');
    } else {
      logger.info('活動參與者表已存在');

      // 檢查表結構
      logger.info('檢查活動參與者表結構...');
      const participantsColumns = await database.query(
        'DESCRIBE event_participants',
      );

      logger.info(`活動參與者表有 ${participantsColumns.length} 個欄位:`);
      participantsColumns.forEach((column) => {
        logger.info(`- ${column.Field} (${column.Type})`);
      });
    }

    // 檢查外鍵約束
    logger.info('檢查外鍵約束...');
    const constraints = await database.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_NAME IN ('events', 'badges', 'servers', 'channels', 'users')
        AND TABLE_NAME IN ('events', 'event_participants')
        AND CONSTRAINT_SCHEMA = '${database.database}'
    `);

    if (constraints.length === 0) {
      logger.error('沒有找到外鍵約束!');
      logger.info('這可能是正常的，如果您選擇不添加外鍵約束');
    } else {
      logger.info(`找到 ${constraints.length} 個外鍵約束:`);
      constraints.forEach((constraint) => {
        logger.info(
          `- ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME} (${constraint.CONSTRAINT_NAME})`,
        );
      });
    }

    // 檢查徽章表
    logger.info('檢查徽章表...');
    const badges = await database.query('SELECT * FROM badges');
    logger.info(`數據庫中共有 ${badges.length} 個徽章`);

    logger.info('驗證完成');
  } catch (error) {
    logger.error(`驗證失敗: ${error.message}`);
  }
}

// 獲取用戶信息
async function getUser(userId) {
  const users = await database.query('SELECT * FROM users WHERE user_id = ?', [
    userId,
  ]);
  if (users.length === 0) return null;
  return convertToCamelCase(users[0]);
}

// 獲取服務器信息
async function getServer(serverId) {
  const servers = await database.query(
    'SELECT * FROM servers WHERE server_id = ?',
    [serverId],
  );
  if (servers.length === 0) return null;
  return convertToCamelCase(servers[0]);
}

// 獲取頻道信息
async function getChannel(channelId) {
  const channels = await database.query(
    'SELECT * FROM channels WHERE channel_id = ?',
    [channelId],
  );
  if (channels.length === 0) return null;
  return convertToCamelCase(channels[0]);
}

// 獲取徽章列表
async function getBadges() {
  const badges = await database.query('SELECT * FROM badges');
  return badges.map((badge) => convertToCamelCase(badge));
}

// 驗證日期時間格式 (YYYY-MM-DD HH:MM)
function isValidDateTime(dateTimeStr) {
  const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  return regex.test(dateTimeStr);
}

// 將日期時間字符串轉換為時間戳
function dateTimeToTimestamp(dateTimeStr) {
  const [dateStr, timeStr] = dateTimeStr.split(' ');
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // 驗證日期是否有效
  const date = new Date(year, month - 1, day, hour, minute);
  if (isNaN(date.getTime())) {
    throw new Error('無效的日期時間');
  }

  return date.getTime();
}

// 創建活動
async function createEvent() {
  try {
    logger.info('=== 創建新活動 ===');

    // 檢查表是否存在
    const eventsTable = await database.query("SHOW TABLES LIKE 'events'");
    if (eventsTable.length === 0) {
      logger.error('活動表不存在，需要先創建表結構');
      const choice = await question('是否立即創建活動表結構? (y/n): ');
      if (choice.toLowerCase() === 'y') {
        await updateEventsStructure();
      } else {
        return;
      }
    }

    // 輸入活動信息
    const name = await question('活動名稱: ');
    if (!name.trim()) {
      logger.error('錯誤: 活動名稱不能為空');
      return;
    }

    const description = await question('活動描述: ');

    // 輸入活動時間範圍
    let startTimeStr, endTimeStr, startTime, endTime;
    do {
      startTimeStr = await question('開始時間 (YYYY-MM-DD HH:MM): ');
      if (!isValidDateTime(startTimeStr)) {
        logger.error('錯誤: 無效的日期時間格式，請使用 YYYY-MM-DD HH:MM');
        continue;
      }

      try {
        startTime = dateTimeToTimestamp(startTimeStr);
        break;
      } catch (error) {
        logger.error(`錯誤: ${error.message}`);
      }
    } while (true);

    do {
      endTimeStr = await question('結束時間 (YYYY-MM-DD HH:MM): ');
      if (!isValidDateTime(endTimeStr)) {
        logger.error('錯誤: 無效的日期時間格式，請使用 YYYY-MM-DD HH:MM');
        continue;
      }

      try {
        endTime = dateTimeToTimestamp(endTimeStr);

        if (endTime <= startTime) {
          logger.error('錯誤: 結束時間必須晚於開始時間');
          continue;
        }
        break;
      } catch (error) {
        logger.error(`錯誤: ${error.message}`);
      }
    } while (true);

    // 選擇活動類型
    console.log('\n活動類型:');
    console.log('1. 經驗值加成 (xp_boost)');
    console.log('2. 徽章收集 (badge_collection)');
    console.log('3. 特殊活動 (special)');

    let activityType;
    do {
      const typeChoice = await question('請選擇活動類型 (1-3): ');
      switch (typeChoice) {
        case '1':
          activityType = 'xp_boost';
          break;
        case '2':
          activityType = 'badge_collection';
          break;
        case '3':
          activityType = 'special';
          break;
        default:
          logger.error('錯誤: 無效的選擇');
          continue;
      }
      break;
    } while (true);

    // 輸入經驗值加成
    let xpBoost = 0;
    if (activityType === 'xp_boost') {
      do {
        const xpBoostStr = await question(
          '經驗值加成百分比 (例如: 20 表示增加20%): ',
        );
        xpBoost = parseFloat(xpBoostStr);

        if (isNaN(xpBoost) || xpBoost < 0) {
          logger.error('錯誤: 經驗值加成必須是非負數');
          continue;
        }

        xpBoost = xpBoost / 100; // 轉換為小數
        break;
      } while (true);
    }

    // 是否添加徽章
    const addBadgeStr = await question('是否添加徽章獎勵? (y/n): ');
    let badgeId = null;
    let badgeHours = null;

    if (addBadgeStr.toLowerCase() === 'y') {
      // 獲取可用徽章列表
      const badges = await getBadges();

      if (!badges || badges.length === 0) {
        logger.warn('數據庫中沒有徽章，請先創建徽章');
        const createBadge = await question('是否創建示例徽章? (y/n): ');
        if (createBadge.toLowerCase() === 'y') {
          await createExampleBadges();
          logger.info('已創建示例徽章，請重新開始創建活動');
          return;
        } else {
          logger.info('繼續創建活動但不添加徽章獎勵');
        }
      } else {
        logger.info('\n可用徽章列表:');
        badges.forEach((badge, index) => {
          console.log(
            `${index + 1}. ${badge.name} (${badge.badgeId}) - ${
              badge.description
            }`,
          );
        });

        let badgeIndex;
        do {
          const badgeIndexStr = await question('選擇徽章 (輸入序號): ');
          badgeIndex = parseInt(badgeIndexStr, 10) - 1;

          if (
            isNaN(badgeIndex) ||
            badgeIndex < 0 ||
            badgeIndex >= badges.length
          ) {
            logger.error('錯誤: 無效的徽章序號');
            continue;
          }
          break;
        } while (true);

        badgeId = badges[badgeIndex].badgeId;
        logger.info(`已選擇徽章: ${badges[badgeIndex].name}`);

        let hours;
        do {
          const badgeHoursStr = await question('獲得徽章所需停留時間 (小時): ');
          hours = parseInt(badgeHoursStr, 10);

          if (isNaN(hours) || hours <= 0) {
            logger.error('錯誤: 時間必須是正整數');
            continue;
          }

          badgeHours = hours;
          break;
        } while (true);
      }
    }

    // 活動範圍
    let scope,
      serverId = null,
      channelId = null;
    do {
      const scopeStr = await question(
        '活動範圍 (1: 全局, 2: 特定服務器, 3: 特定頻道): ',
      );
      scope = parseInt(scopeStr, 10);

      if (isNaN(scope) || scope < 1 || scope > 3) {
        logger.error('錯誤: 無效的範圍選擇');
        continue;
      }
      break;
    } while (true);

    if (scope === 2 || scope === 3) {
      serverId = await question('服務器ID: ');

      // 驗證服務器存在
      const server = await getServer(serverId);
      if (!server) {
        logger.error('錯誤: 服務器不存在');
        return;
      }
      logger.info(`已驗證服務器: ${server.name}`);

      if (scope === 3) {
        channelId = await question('頻道ID: ');

        // 驗證頻道存在
        const channel = await getChannel(channelId);
        if (!channel) {
          logger.error('錯誤: 頻道不存在');
          return;
        }
        logger.info(`已驗證頻道: ${channel.name}`);

        // 驗證頻道屬於該服務器
        if (channel.serverId !== serverId) {
          logger.error('錯誤: 頻道不屬於該服務器');
          return;
        }
      }
    }

    // 創建事件ID
    const eventId = uuidv4();

    // 確認創建
    console.log('\n即將創建以下活動:');
    console.log('-------------------------');
    console.log(`活動名稱: ${name}`);
    console.log(`活動描述: ${description}`);
    console.log(`活動類型: ${activityType}`);
    console.log(`開始時間: ${new Date(startTime).toLocaleString()}`);
    console.log(`結束時間: ${new Date(endTime).toLocaleString()}`);

    if (activityType === 'xp_boost') {
      console.log(`經驗值加成: ${xpBoost * 100}%`);
    }

    if (badgeId) {
      console.log(`徽章獎勵: 是 (${badgeId})`);
      console.log(`獲得徽章所需時間: ${badgeHours}小時`);
    } else {
      console.log(`徽章獎勵: 否`);
    }

    if (scope === 1) {
      console.log('活動範圍: 全局');
    } else if (scope === 2) {
      console.log(`活動範圍: 服務器 (${serverId})`);
    } else {
      console.log(`活動範圍: 頻道 (${channelId})`);
    }

    console.log('-------------------------');

    const confirmCreate = await question('確認創建此活動? (y/n): ');
    if (confirmCreate.toLowerCase() !== 'y') {
      logger.info('已取消活動創建');
      return;
    }

    // 構建活動對象
    const dbEvent = {
      event_id: eventId,
      name,
      description: description || '',
      type: activityType,
      xp_boost: xpBoost,
      start_time: startTime,
      end_time: endTime,
      badge_id: badgeId || null,
      badge_required_time: badgeHours ? badgeHours * 60 * 60 * 1000 : null,
      server_id: serverId || null,
      channel_id: channelId || null,
      is_active: 1,
      created_at: Date.now(),
    };

    // 移除所有undefined值
    Object.keys(dbEvent).forEach((key) => {
      if (dbEvent[key] === undefined) {
        dbEvent[key] = null;
      }
    });

    const columns = Object.keys(dbEvent).join(', ');
    const placeholders = Object.keys(dbEvent)
      .map(() => '?')
      .join(', ');
    const values = Object.values(dbEvent);

    // 保存到數據庫
    await database.query(
      `INSERT INTO events (${columns}) VALUES (${placeholders})`,
      values,
    );

    logger.info(`\n活動創建成功! 活動ID: ${eventId}`);
    logger.info('活動詳情:');
    console.log(JSON.stringify(dbEvent, null, 2));

    // 提示下一步操作
    console.log('\n您可以使用以下API接口查看此活動:');
    console.log(`GET /api/events/${eventId}`);
  } catch (error) {
    logger.error(`創建活動時發生錯誤: ${error.message}`);
    console.error('詳細錯誤:', error);
  }
}

// 主函數
async function main() {
  try {
    // 驗證數據庫連接
    logger.info('正在連接數據庫...');
    await database.query('SELECT 1');
    logger.info('數據庫連接成功');

    // 自動檢查依賴
    logger.info('\n步驟1: 檢查系統依賴');
    await checkDependencies(true); // true 表示自動模式，不詢問用戶

    // 自動創建/更新表結構
    logger.info('\n步驟2: 創建/更新活動表結構');
    await updateEventsStructure();

    // 自動創建示例徽章（如果需要）
    await createExampleBadges();

    // 驗證表結構
    logger.info('\n步驟3: 驗證活動表結構');
    await verifyEventsSetup();

    // 創建新活動
    logger.info('\n步驟4: 創建新活動');
    await createEvent();

    logger.info('\n全部操作已完成！');
  } catch (error) {
    logger.error(`發生錯誤: ${error.message}`);
    console.error('詳細錯誤:', error);
  } finally {
    rl.close();
  }
}

// 運行主函數
main();
