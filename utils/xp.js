/* eslint-disable @typescript-eslint/no-require-imports */
// Constants
const { XP_SYSTEM } = require('../constant');

// Utils
const Logger = require('./logger');

// Database
const DB = require('../db');

// StandardizedError
const StandardizedError = require('../standardizedError');

const xpSystem = {
  timeFlag: new Map(), // socket -> timeFlag
  elapsedTime: new Map(), // userId -> elapsedTime

  create: async (userId) => {
    try {
      // Validate data
      if (!userId) {
        throw new StandardizedError(
          '無效的資料',
          'ValidationError',
          'XP_SYSTEM',
          'DATA_INVALID',
          400,
        );
      }

      xpSystem.timeFlag.set(userId, Date.now());

      new Logger('XPSystem').info(
        `User(${userId}) XP system created with ${xpSystem.elapsedTime.get(
          userId,
        )}ms elapsed time`,
      );
    } catch (error) {
      new Logger('XPSystem').error(
        `Error creating XP system for user(${userId}): ${error.message}`,
      );
    }
  },

  delete: async (userId) => {
    try {
      // Validate data
      if (!userId) {
        throw new StandardizedError(
          '無效的資料',
          'ValidationError',
          'XP_SYSTEM',
          'DATA_INVALID',
          400,
        );
      }

      const timeFlag = xpSystem.timeFlag.get(userId);

      if (timeFlag) {
        const now = Date.now();
        const elapsedTime = xpSystem.elapsedTime.get(userId) || 0;
        let newElapsedTime = elapsedTime + (now - timeFlag);
        while (newElapsedTime >= XP_SYSTEM.INTERVAL_MS) {
          await xpSystem.obtainXp(userId);
          newElapsedTime -= XP_SYSTEM.INTERVAL_MS;
        }
        xpSystem.elapsedTime.set(userId, newElapsedTime);

        // 更新用户在活动中的停留时间
        await xpSystem.updateEventParticipation(userId, now - timeFlag);
      }

      xpSystem.timeFlag.delete(userId);

      new Logger('XPSystem').info(
        `User(${userId}) XP system deleted with ${xpSystem.elapsedTime.get(
          userId,
        )}ms elapsed time`,
      );
    } catch (error) {
      new Logger('XPSystem').error(
        `Error deleting XP system for user(${userId}): ${error.message}`,
      );
    }
  },

  setup: () => {
    try {
      // Set up XP interval
      setInterval(
        () =>
          xpSystem.refreshAllUsers().catch((error) => {
            new Logger('XPSystem').error(
              `Error refreshing XP interval: ${error.message}`,
            );
          }),
        600000,
      );

      new Logger('XPSystem').info(`XP system setup complete`);
    } catch (error) {
      new Logger('XPSystem').error(
        `Error setting up XP system: ${error.message}`,
      );
    }
  },

  refreshAllUsers: async () => {
    const refreshTasks = Array.from(xpSystem.timeFlag.entries()).map(
      async ([userId, timeFlag]) => {
        try {
          const now = Date.now();
          const elapsedTime = xpSystem.elapsedTime.get(userId) || 0;
          let newElapsedTime = elapsedTime + now - timeFlag;
          while (newElapsedTime >= XP_SYSTEM.INTERVAL_MS) {
            const success = await xpSystem.obtainXp(userId);
            if (success) newElapsedTime -= XP_SYSTEM.INTERVAL_MS;
            else break;
          }
          xpSystem.elapsedTime.set(userId, newElapsedTime);
          xpSystem.timeFlag.set(userId, now); // Reset timeFlag

          // 更新用户在活动中的停留时间
          await xpSystem.updateEventParticipation(userId, now - timeFlag);

          new Logger('XPSystem').info(
            `XP interval refreshed for user(${userId})`,
          );
        } catch (error) {
          new Logger('XPSystem').error(
            `Error refreshing XP interval for user(${userId}): ${error.message}`,
          );
        }
      },
    );
    await Promise.all(refreshTasks);
    new Logger('XPSystem').info(
      `XP interval refreshed complete, ${xpSystem.timeFlag.size} users updated`,
    );
  },

  getRequiredXP: (level) => {
    return Math.ceil(
      XP_SYSTEM.BASE_REQUIRE_XP * Math.pow(XP_SYSTEM.GROWTH_RATE, level),
    );
  },

  // 获取用户参与的有效活动列表
  getUserActiveEvents: async (userId, serverId, channelId) => {
    try {
      if (!userId) return [];

      // 获取当前时间
      const now = Date.now();

      // 获取所有活跃的活动
      const activeEvents = await DB.get.events({ active: true });
      if (!activeEvents || activeEvents.length === 0) return [];

      // 过滤出符合条件的活动（全局活动或与用户当前位置匹配的活动）
      const eligibleEvents = activeEvents.filter((event) => {
        // 检查活动是否在有效时间范围内
        if (event.startTime > now || event.endTime < now) return false;

        // 全局活动（没有指定服务器和频道）
        if (!event.serverId && !event.channelId) return true;

        // 服务器活动（只指定了服务器，没有指定频道）
        if (event.serverId && !event.channelId) {
          return event.serverId === serverId;
        }

        // 频道活动（指定了服务器和频道）
        if (event.serverId && event.channelId) {
          return event.serverId === serverId && event.channelId === channelId;
        }

        return false;
      });

      // 如果没有符合条件的活动，直接返回空数组
      if (eligibleEvents.length === 0) return [];

      // 对于每个符合条件的活动，检查用户是否已参与
      const userActiveEvents = [];

      for (const event of eligibleEvents) {
        let participant = await DB.get.eventParticipant(userId, event.eventId);

        // 如果用户未参与该活动，创建参与记录
        if (!participant) {
          await DB.create.eventParticipant(userId, event.eventId);
          participant = {
            userId,
            eventId: event.eventId,
            joinedAt: Date.now(),
            totalTime: 0,
            badgeEarned: 0,
          };
        }

        userActiveEvents.push({
          ...event,
          participant,
        });
      }

      return userActiveEvents;
    } catch (error) {
      new Logger('XPSystem').error(
        `Error getting active events for user(${userId}): ${error.message}`,
      );
      return [];
    }
  },

  // 更新用户在活动中的参与时间
  updateEventParticipation: async (userId, elapsedMs) => {
    try {
      if (!userId || !elapsedMs) return;

      // 获取用户信息
      const user = await DB.get.user(userId);
      if (!user) return;

      // 获取用户当前所在的服务器和频道
      const serverId = user.currentServerId;
      const channelId = user.currentChannelId;

      // 获取用户当前参与的活动
      const userEvents = await xpSystem.getUserActiveEvents(
        userId,
        serverId,
        channelId,
      );
      if (userEvents.length === 0) return;

      // 更新每个活动的参与时间
      for (const event of userEvents) {
        // 更新总停留时间
        const newTotalTime = event.participant.totalTime + elapsedMs;
        await DB.update.eventParticipant(userId, event.eventId, {
          totalTime: newTotalTime,
        });

        // 如果活动有徽章奖励且用户未获得徽章，检查是否达到获取徽章的条件
        if (
          event.badgeId &&
          event.badgeHours &&
          !event.participant.badgeEarned
        ) {
          // 将小时转换为毫秒进行比较
          const requiredTimeMs = event.badgeHours * 60 * 60 * 1000;

          if (newTotalTime >= requiredTimeMs) {
            // 用户达到了获取徽章的条件
            await DB.update.eventParticipant(userId, event.eventId, {
              badgeEarned: 1,
            });

            // 将徽章添加给用户
            try {
              // 检查用户是否已有此徽章
              const userBadges = await DB.get.userBadges(userId);
              const hasBadge =
                userBadges &&
                userBadges.some((badge) => badge.badgeId === event.badgeId);

              if (!hasBadge) {
                // 获取用户徽章的最大排序值
                const maxOrder =
                  userBadges && userBadges.length > 0
                    ? Math.max(...userBadges.map((badge) => badge.order))
                    : -1;

                // 添加徽章给用户
                await DB.create.userBadge({
                  userId,
                  badgeId: event.badgeId,
                  order: maxOrder + 1,
                  createdAt: Date.now(),
                });

                new Logger('XPSystem').info(
                  `User(${userId}) earned badge(${event.badgeId}) from event(${event.eventId})`,
                );
              }
            } catch (badgeError) {
              new Logger('XPSystem').error(
                `Error adding badge to user(${userId}) from event(${event.eventId}): ${badgeError.message}`,
              );
            }
          }
        }
      }
    } catch (error) {
      new Logger('XPSystem').error(
        `Error updating event participation for user(${userId}): ${error.message}`,
      );
    }
  },

  // 计算活动经验值加成
  calculateEventXpBoost: async (userId, serverId, channelId) => {
    try {
      // 获取用户当前参与的活动
      const userEvents = await xpSystem.getUserActiveEvents(
        userId,
        serverId,
        channelId,
      );

      if (userEvents.length === 0) return 1; // 无加成

      // 找出最高的经验值加成
      const maxBoost = userEvents.reduce((max, event) => {
        return Math.max(max, event.xpBoost || 0);
      }, 0);

      // 返回加成系数 (加成百分比 20% 就是 0.2)
      return maxBoost;
    } catch (error) {
      new Logger('XPSystem').error(
        `Error calculating XP boost for user(${userId}): ${error.message}`,
      );
      return 1; // 发生错误时无加成
    }
  },

  obtainXp: async (userId) => {
    try {
      const user = await DB.get.user(userId);
      if (!user) {
        new Logger('XPSystem').warn(
          `User(${userId}) not found, cannot obtain XP`,
        );
        return false;
      }
      const server = await DB.get.server(user.currentServerId);
      if (!server) {
        new Logger('XPSystem').warn(
          `Server(${user.currentServerId}) not found, cannot obtain XP`,
        );
        return false;
      }
      const member = await DB.get.member(user.userId, server.serverId);
      if (!member) {
        new Logger('XPSystem').warn(
          `User(${user.userId}) not found in server(${server.serverId}), cannot update contribution`,
        );
        return false;
      }

      // 计算VIP加成
      const baseXp = XP_SYSTEM.BASE_XP;
      const vipBoost = user.vip ? user.vip * 0.2 : 0;

      // 计算活动加成
      const eventBoost = await xpSystem.calculateEventXpBoost(
        userId,
        user.currentServerId,
        user.currentChannelId,
      );

      // Process XP and level
      user.xp += baseXp * (1 + vipBoost + eventBoost);

      let requiredXp = 0;
      while (true) {
        requiredXp = xpSystem.getRequiredXP(user.level - 1);
        if (user.xp < requiredXp) break;
        user.level += 1;
        user.xp -= requiredXp;
      }

      // Update user
      const updatedUser = {
        level: user.level,
        xp: user.xp,
        requiredXp: requiredXp,
        progress: user.xp / requiredXp,
      };
      await DB.set.user(user.userId, updatedUser);

      // Update member contribution if in a server
      const updatedMember = {
        contribution:
          Math.round(
            (member.contribution + XP_SYSTEM.BASE_XP * totalBoost) * 100,
          ) / 100,
      };
      await DB.set.member(user.userId, server.serverId, updatedMember);

      // Update server we
      const updatedServer = {
        wealth:
          Math.round((server.wealth + XP_SYSTEM.BASE_XP * totalBoost) * 100) /
          100,
      };
      await DB.set.server(server.serverId, updatedServer);

      new Logger('XPSystem').info(
        `User(${userId}) obtained ${
          XP_SYSTEM.BASE_XP * totalBoost
        } XP (VIP: ${vipBoost}x, Event: ${eventBoost}x)`,
      );
      return true;
    } catch (error) {
      new Logger('XPSystem').error(
        `Error obtaining user(${userId}) XP: ${error.message}`,
      );
      return false;
    }
  },
};

module.exports = { ...xpSystem };
