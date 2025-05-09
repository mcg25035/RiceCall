import React, { useEffect, useRef, useState } from 'react';

// Types
import { User, Friend, FriendGroup, SocketServerEvent } from '@/types';

// Providers
import { useSocket } from '@/providers/Socket';
import { useLanguage } from '@/providers/Language';

// CSS
import setting from '@/styles/popups/setting.module.css';
import popup from '@/styles/popup.module.css';

// Services
import refreshService from '@/services/refresh.service';
import ipcService from '@/services/ipc.service';

// Utils
import { createDefault } from '@/utils/createDefault';

interface EditFriendPopupProps {
  userId: User['userId'];
  targetId: User['userId'];
}

const EditFriendPopup: React.FC<EditFriendPopupProps> = React.memo(
  (initialData: EditFriendPopupProps) => {
    // Hooks
    const socket = useSocket();
    const lang = useLanguage();

    // Refs
    const refreshRef = useRef(false);

    // States
    const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
    const [friend, setFriend] = useState<Friend>(createDefault.friend());

    // Variables
    const { userId, targetId } = initialData;
    const { friendGroupId } = friend;

    // Handlers
    const handleClose = () => {
      ipcService.window.close();
    };

    const handleFriendGroupAdd = (data: FriendGroup) => {
      setFriendGroups((prev) => [...prev, data]);
    };

    const handleFriendGroupUpdate = (
      id: FriendGroup['friendGroupId'],
      data: Partial<FriendGroup>,
    ) => {
      setFriendGroups((prev) =>
        prev.map((item) =>
          item.friendGroupId === id ? { ...item, ...data } : item,
        ),
      );
    };

    const handleFriendGroupDelete = (id: FriendGroup['friendGroupId']) => {
      setFriendGroups((prev) =>
        prev.filter((item) => item.friendGroupId !== id),
      );
    };

    const handleUpdateFriend = (
      friend: Partial<Friend>,
      userId: User['userId'],
      targetId: User['userId'],
    ) => {
      if (!socket) return;
      socket.send.updateFriend({ friend, userId, targetId });
    };

    // Effects
    useEffect(() => {
      if (!socket) return;

      const eventHandlers = {
        [SocketServerEvent.FRIEND_GROUP_ADD]: handleFriendGroupAdd,
        [SocketServerEvent.FRIEND_GROUP_UPDATE]: handleFriendGroupUpdate,
        [SocketServerEvent.FRIEND_GROUP_DELETE]: handleFriendGroupDelete,
      };
      const unsubscribe: (() => void)[] = [];

      Object.entries(eventHandlers).map(([event, handler]) => {
        const unsub = socket.on[event as SocketServerEvent](handler);
        unsubscribe.push(unsub);
      });

      return () => {
        unsubscribe.forEach((unsub) => unsub());
      };
    }, [socket]);

    useEffect(() => {
      if (!userId || !targetId || refreshRef.current) return;
      const refresh = async () => {
        refreshRef.current = true;
        Promise.all([
          refreshService.userFriendGroups({
            userId: userId,
          }),
          refreshService.friend({
            userId: userId,
            targetId: targetId,
          }),
        ]).then(([friendGroups, friend]) => {
          if (friendGroups) {
            setFriendGroups(friendGroups);
          }
          if (friend) {
            setFriend(friend);
          }
        });
      };
      refresh();
    }, [userId, targetId]);

    return (
      <div className={popup['popupContainer']}>
        <div className={popup['popupBody']}>
          <div className={setting['body']}>
            <div className={popup['inputGroup']}>
              <div className={`${popup['inputBox']} ${popup['row']}`}>
                <div className={popup['label']}>
                  {lang.tr.friendSelectGroup}
                </div>
                <div className={popup['selectBox']}>
                  <select
                    className={popup['input']}
                    value={friendGroupId || ''}
                    onChange={(e) => {
                      setFriend((prev) => ({
                        ...prev,
                        friendGroupId: e.target.value,
                      }));
                    }}
                  >
                    <option value={''}>{lang.tr.none}</option>
                    {friendGroups.map((group) => (
                      <option
                        key={group.friendGroupId}
                        value={group.friendGroupId}
                      >
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={popup['popupFooter']}>
          <button
            className={`${popup['button']}`}
            onClick={() => {
              handleUpdateFriend(
                { friendGroupId: friendGroupId },
                userId,
                targetId,
              );
              handleClose();
            }}
          >
            {lang.tr.confirm}
          </button>
          <button className={popup['button']} onClick={() => handleClose()}>
            {lang.tr.cancel}
          </button>
        </div>
      </div>
    );
  },
);

EditFriendPopup.displayName = 'EditFriendPopup';

export default EditFriendPopup;
