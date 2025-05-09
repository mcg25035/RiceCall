import React, { useEffect, useRef, useState } from 'react';

// Types
import { Member, User, Server } from '@/types';

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

interface EditNicknamePopupProps {
  userId: User['userId'];
  serverId: Server['serverId'];
}

const EditNicknamePopup: React.FC<EditNicknamePopupProps> = React.memo(
  (initialData: EditNicknamePopupProps) => {
    // Hooks
    const socket = useSocket();
    const lang = useLanguage();

    // Refs
    const refreshRef = useRef(false);

    // States
    const [member, setMember] = useState<Member>(createDefault.member());
    const [user, setUser] = useState<User>(createDefault.user());

    // Variables
    const { userId, serverId } = initialData;
    const { nickname: memberNickname } = member;
    const { name: userName } = user;

    // Handlers
    const handleUpdateMember = (
      member: Partial<Member>,
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.updateMember({ member, userId, serverId });
    };

    const handleClose = () => {
      ipcService.window.close();
    };

    // Effects
    useEffect(() => {
      if (!userId || !serverId || refreshRef.current) return;
      const refresh = async () => {
        refreshRef.current = true;
        Promise.all([
          refreshService.user({
            userId: userId,
          }),
          refreshService.member({
            userId: userId,
            serverId: serverId,
          }),
        ]).then(([user, member]) => {
          if (user) {
            setUser(user);
          }
          if (member) {
            setMember(member);
          }
        });
      };
      refresh();
    }, [userId, serverId]);

    return (
      <form className={popup['popupContainer']}>
        <div className={popup['popupBody']}>
          <div className={setting['body']}>
            <div className={popup['inputGroup']}>
              <div className={popup['inputBox']}>
                <label>{lang.tr.nickname}</label>
                <label className={popup['value']}>{userName}</label>
              </div>
              <div className={`${popup['inputBox']} ${popup['col']}`}>
                <div className={popup['label']}>
                  {lang.tr.pleaseEnterTheMemberNickname}
                </div>
                <input
                  className={popup['input']}
                  type="text"
                  value={memberNickname || ''}
                  onChange={(e) => {
                    setMember((prev) => ({
                      ...prev,
                      nickname: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={popup['popupFooter']}>
          <button
            className={`${popup['button']}`}
            onClick={() => {
              handleUpdateMember(
                { nickname: memberNickname },
                userId,
                serverId,
              );
              handleClose();
            }}
          >
            {lang.tr.confirm}
          </button>
          <button
            type="button"
            className={popup['button']}
            onClick={() => handleClose()}
          >
            {lang.tr.cancel}
          </button>
          <button
            type="button"
            className={`${popup['button']}`}
            onClick={() => {
              handleUpdateMember(
                { nickname: memberNickname },
                userId,
                serverId,
              );
            }}
          >
            {lang.tr.set}
          </button>
        </div>
      </form>
    );
  },
);

EditNicknamePopup.displayName = 'EditNicknamePopup';

export default EditNicknamePopup;
