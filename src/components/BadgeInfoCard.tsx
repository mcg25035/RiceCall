import React, { useState, useEffect, useRef } from 'react';

// CSS
import badgeInfoCardStyles from '@/styles/badgeInfoCard.module.css';

// Types
import type { Badge } from '@/types';

// Providers
// import { useLanguage } from '@/providers/Language';

interface BadgeInfoCardProps {
  rect: DOMRect;
  badge: Badge;
  preferBelow: boolean;
}

const BadgeInfoCard: React.FC<BadgeInfoCardProps> = React.memo(
  ({ rect, badge, preferBelow }) => {
    // Refs
    const cardRef = useRef<HTMLDivElement>(null);

    // const lang = useLanguage();

    // State
    const [cardX, setCardX] = useState(0);
    const [cardY, setCardY] = useState(0);
    const [ready, setReady] = useState(false);

    // Variables
    const badgeUrl = `/badge/${badge.badgeId.trim()}.png`;

    // Effect
    useEffect(() => {
      const positionCard = () => {
        if (!cardRef.current) return;
        const cardWidth = cardRef.current.offsetWidth;
        const cardHeight = cardRef.current.offsetHeight;
        if (!cardWidth || !cardHeight) {
          requestAnimationFrame(positionCard);
          return;
        }
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        let x = rect.left;
        let y: number;
        if (!preferBelow) {
          y = rect.bottom;
          if (y + cardHeight > windowHeight) {
            y = rect.top - cardHeight;
          }
        } else {
          y = rect.top - cardHeight;
          if (y < 0) {
            y = rect.bottom;
          }
        }
        if (x + cardWidth > windowWidth) {
          x = windowWidth - cardWidth - 8;
        }
        if (x < 8) x = 8;
        if (y + cardHeight > windowHeight) {
          y = windowHeight - cardHeight - 8;
        }
        if (y < 8) y = 8;
        setCardX(x);
        setCardY(y);
        setReady(true);
      };
      requestAnimationFrame(positionCard);
    }, [rect, preferBelow]);

    return (
      <div
        ref={cardRef}
        className={`context-menu-container ${badgeInfoCardStyles.badgeInfoCard}`}
        style={{
          top: cardY,
          left: cardX,
          visibility: ready ? 'visible' : 'hidden',
        }}
      >
        <div className={badgeInfoCardStyles.badgeInfoWrapper}>
          <div className={badgeInfoCardStyles.badgeAvatarBox}>
            <div
              className={badgeInfoCardStyles.badgeImage}
              style={{ backgroundImage: `url(${badgeUrl})` }}
            />
            <div className={badgeInfoCardStyles.badgeRarityText}>
              {`[${badge.rare}]`}
            </div>
          </div>
          <div className={badgeInfoCardStyles.badgeDescriptionBox}>
            <div className={badgeInfoCardStyles.badgeName}>{badge.name}</div>
            <div className={badgeInfoCardStyles.badgeDescription}>
              {badge.description}
            </div>
          </div>
        </div>
        <div className={badgeInfoCardStyles.badgeShowTimeBox}>
          <div>展示至:</div>
          <div>1970-01-01</div>
        </div>
      </div>
    );
  },
);

BadgeInfoCard.displayName = 'BadgeInfoCard';

export default BadgeInfoCard;
