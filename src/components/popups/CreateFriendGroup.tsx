import React, { useState } from 'react';

// Types
import { FriendGroup, User } from '@/types';

// Providers
import { useSocket } from '@/providers/Socket';
import { useLanguage } from '@/providers/Language';

// CSS
import popup from '@/styles/popup.module.css';
import setting from '@/styles/popups/setting.module.css';

// Services
import ipcService from '@/services/ipc.service';

// Utils
import { createDefault } from '@/utils/createDefault';

interface CreateFriendGroupPopupProps {
  userId: User['userId'];
}

const CreateFriendGroupPopup: React.FC<CreateFriendGroupPopupProps> =
  React.memo((initialData: CreateFriendGroupPopupProps) => {
    // Hooks
    const socket = useSocket();
    const lang = useLanguage();

    // States
    const [friendGroup, setFriendGroup] = useState<FriendGroup>(
      createDefault.friendGroup(),
    );

    // Variables
    const { userId } = initialData;
    const { name: groupName, order: groupOrder } = friendGroup;

    // Handlers
    const handleCreateFriendGroup = (
      group: Partial<FriendGroup>,
      userId: User['userId'],
    ) => {
      if (!socket) return;
      socket.send.createFriendGroup({ group, userId });
    };

    const handleClose = () => {
      ipcService.window.close();
    };

    return (
      <form className={popup['popupContainer']}>
        <div className={popup['popupBody']}>
          <div className={setting['body']}>
            <div className={popup['inputGroup']}>
              <div className={`${popup['row']}`}>
                <div
                  className={`${popup['inputBox']} ${popup['col']}`}
                  style={{
                    flex: '3',
                  }}
                >
                  <div className={popup['label']}>
                    {lang.tr.pleaseInputFriendGroupName}
                  </div>
                  <input
                    className={popup['input']}
                    type="text"
                    value={groupName}
                    maxLength={20}
                    onChange={(e) =>
                      setFriendGroup((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div
                  className={`${popup['inputBox']} ${popup['col']}`}
                  style={{
                    flex: '1',
                  }}
                >
                  <div className={popup['label']}>
                    {lang.tr.friendGroupOrder}
                  </div>
                  <input
                    className={popup['input']}
                    type="number"
                    placeholder={groupOrder.toString()}
                    value={groupOrder}
                    max={999}
                    min={-999}
                    onChange={(e) =>
                      setFriendGroup((prev) => ({
                        ...prev,
                        order: parseInt(e.target.value) || 0,
                      }))
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={popup['popupFooter']}>
          <button
            className={`${popup['button']} ${
              !groupName.trim() ? popup['disabled'] : ''
            }`}
            disabled={!groupName.trim()}
            onClick={() => {
              handleCreateFriendGroup(
                { name: groupName, order: groupOrder },
                userId,
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
      </form>
    );
  });

CreateFriendGroupPopup.displayName = 'CreateFriendGroupPopup';

export default CreateFriendGroupPopup;
