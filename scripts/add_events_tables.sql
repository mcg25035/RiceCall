-- 创建活动表
CREATE TABLE IF NOT EXISTS `events` (
  `event_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `description` text NOT NULL,
  `start_time` bigint(20) NOT NULL DEFAULT 0,
  `end_time` bigint(20) NOT NULL DEFAULT 0,
  `xp_boost` float NOT NULL DEFAULT 0, -- 经验值加成百分比，如0.2表示20%
  `badge_id` char(36) DEFAULT NULL, -- 完成活动可获得的徽章
  `badge_hours` int(10) UNSIGNED DEFAULT NULL, -- 获得徽章所需要停留的小时数
  `server_id` char(36) DEFAULT NULL, -- 如果是特定服务器的活动，否则为NULL（全局活动）
  `channel_id` char(36) DEFAULT NULL, -- 如果是特定频道的活动，否则为NULL
  `is_active` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `created_at` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建用户参与活动记录表
CREATE TABLE IF NOT EXISTS `event_participants` (
  `user_id` char(36) NOT NULL,
  `event_id` char(36) NOT NULL,
  `joined_at` bigint(20) NOT NULL DEFAULT 0,
  `total_time` bigint(20) NOT NULL DEFAULT 0, -- 用户在活动中累计停留的时间（毫秒）
  `badge_earned` tinyint(3) UNSIGNED NOT NULL DEFAULT 0, -- 是否已获得徽章
  PRIMARY KEY (`user_id`, `event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 暂时注释掉外键约束
-- 添加外键
ALTER TABLE `events`
  ADD CONSTRAINT `fk_events_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`badge_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_events_server` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_events_channel` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `event_participants`
  ADD CONSTRAINT `fk_event_participants_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_event_participants_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE ON UPDATE CASCADE;
*/ 