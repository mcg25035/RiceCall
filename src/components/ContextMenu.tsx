import React, { useEffect, useRef, useState } from 'react';

// CSS
import contextMenu from '@/styles/contextMenu.module.css';

// Types
import { ContextMenuItem } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  target?: HTMLElement;
  onClose: () => void;
  side?: 'left' | 'right';
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  items,
  side = 'right',
  target,
  onClose,
}) => {
  // Ref
  const menuRef = useRef<HTMLDivElement>(null);

  // State
  const [subMenu, setSubMenu] = useState<React.ReactNode>(null);
  const [menuX, setMenuX] = useState(x);
  const [menuY, setMenuY] = useState(y);
  const isSetting = items[0]?.icon;

  // Effect
  useEffect(() => {
    if (!menuRef.current) return;
    const menuWidth = menuRef.current.offsetWidth,
      menuHeight = menuRef.current.offsetHeight,
      windowWidth = window.innerWidth,
      windowHeight = window.innerHeight;
    let newMenuX = x,
      newMenuY = y;
    if (
      target &&
      (target.classList[0].includes('setting') ||
        target.classList[0].includes('menu'))
    ) {
      const rect = target.getBoundingClientRect();
      newMenuX = rect.left;
      newMenuY = rect.bottom;
      if (newMenuY + menuHeight > windowHeight) {
        newMenuY = rect.top - menuHeight;
      }
    } else if (side === 'left') {
      newMenuX = x - menuWidth;
    }
    newMenuX = Math.max(8, Math.min(newMenuX, windowWidth - menuWidth - 8));
    newMenuY = Math.max(8, Math.min(newMenuY, windowHeight - menuHeight - 8));
    setMenuX(newMenuX);
    setMenuY(newMenuY);
  }, [x, y, target, side]);

  return (
    <div
      ref={menuRef}
      className={`context-menu-container ${
        isSetting ? contextMenu[isSetting] : ''
      } ${contextMenu['contextMenu']}`}
      style={{ top: menuY, left: menuX }}
    >
      {items
        .filter((item) => item?.show ?? true)
        .map((item, index) => {
          if (item.id === 'separator') {
            return <div className={contextMenu['separator']} key={index} />;
          }
          return (
            <div
              key={item.id || index}
              className={`
                ${contextMenu['option']} 
                ${item.hasSubmenu ? contextMenu['hasSubmenu'] : ''}
                ${item.disabled ? contextMenu['disabled'] : ''}
              `}
              data-type={item.icon || ''}
              onClick={() => {
                if (item.disabled) return;
                item.onClick?.();
                onClose();
              }}
              onMouseEnter={(e) => {
                if (!item.hasSubmenu) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setSubMenu(
                  <ContextMenu
                    x={rect.left}
                    y={rect.top}
                    items={item.submenuItems || []}
                    onClose={onClose}
                    side={'left'}
                  />,
                );
              }}
              onMouseLeave={() => {
                if (item.hasSubmenu) setSubMenu(null);
              }}
            >
              {item.label}
              {item.hasSubmenu && subMenu}
            </div>
          );
        })}
    </div>
  );
};

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
