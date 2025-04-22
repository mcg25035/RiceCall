import React from 'react';
import { Event } from '@/types';

// CSS
import styles from '@/styles/viewers/eventList.module.css';

// 计算活动剩余时间
const getRemainingTime = (endTime: number): string => {
  const now = Date.now();
  const remaining = endTime - now;

  if (remaining <= 0) {
    return '已結束';
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}天${hours}小時`;
  } else if (hours > 0) {
    return `${hours}小時${minutes}分鐘`;
  } else {
    return `${minutes}分鐘`;
  }
};

type EventItemProps = {
  event: Event;
  onClick?: (event: Event) => void;
};

const EventItem: React.FC<EventItemProps> = ({ event, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  const getEventTypeDescription = () => {
    // 若活動中有 xpBoost 則顯示經驗值加成
    if (event.xpBoost) {
      return `經驗值加成 +${Math.round(event.xpBoost * 100)}%`;
    }
    // 若活動中有 badgeId 則顯示徽章收集
    if (event.badgeId) {
      return '徽章收集';
    }
    // 若活動中有 serverId 則顯示伺服器
    if (event.serverId) {
      return '伺服器活動';
    }
    // 若活動中有 channelId 則顯示頻道
    if (event.channelId) {
      return '頻道活動';
    }
    // 若活動中有 type 則顯示活動類型
    if (event.type) {
      switch (event.type) {
        case 'xp_boost':
          return '經驗加成';
        case 'badge_collection':
          return '徽章收集';
        case 'special':
          return '特別活動';
        default:
          return event.type;
      }
    }
    return '';
  };

  return (
    <div className={styles.eventBanner} onClick={handleClick}>
      <div className={styles.eventBannerContent}>
        <div className={styles.eventBannerName}>{event.name}</div>
        <div className={styles.eventBannerInfo}>
          {getEventTypeDescription()}
          <span className={styles.eventBannerTime}>
            剩餘: {getRemainingTime(event.endTime)}
          </span>
        </div>
      </div>
    </div>
  );
};

export interface EventListViewerProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

const EventListViewer: React.FC<EventListViewerProps> = ({
  events,
  onEventClick,
}) => {
  if (!events || events.length === 0) {
    return null; // 不显示空的活动列表
  }

  // 按结束时间排序，并只显示最多三条
  const sortedEvents = [...events]
    .sort((a, b) => a.endTime - b.endTime)
    .slice(0, 3);

  return (
    <div className={styles.eventBannerList}>
      {sortedEvents.map((event) => (
        <EventItem key={event.eventId} event={event} onClick={onEventClick} />
      ))}
    </div>
  );
};

export default EventListViewer;
