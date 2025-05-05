import React, { useEffect, useRef, useState } from 'react';

// CSS
import popup from '@/styles/popup.module.css';
import setting from '@/styles/popups/setting.module.css';

// Types
import { Channel, Server } from '@/types';

// Providers
import { useLanguage } from '@/providers/Language';
import { useSocket } from '@/providers/Socket';

// Services
import ipcService from '@/services/ipc.service';
import refreshService from '@/services/refresh.service';

// Utils
import { createDefault } from '@/utils/createDefault';

interface ChannelSettingPopupProps {
  serverId: Server['serverId'];
  channelId: Channel['channelId'];
}

const ChannelSettingPopup: React.FC<ChannelSettingPopupProps> = React.memo(
  (initialData: ChannelSettingPopupProps) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();

    // Refs
    const refreshRef = useRef(false);

    // States
    const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
    const [channel, setChannel] = useState<Channel>(createDefault.channel());

    // Variables
    const { channelId, serverId } = initialData;
    const {
      name: channelName,
      visibility: channelVisibility,
      password: channelPassword,
      userLimit: channelUserLimit,
      voiceMode: channelVoiceMode,
      order: channelOrder,
      forbidText: channelForbidText,
      forbidGuestText: channelGuestTextForbid,
      forbidGuestUrl: channelGuestTextForbidUrl,
      guestTextMaxLength: channelGuestTextMaxLength,
      guestTextWaitTime: channelGuestTextWaitTime,
      guestTextGapTime: channelGuestTextGapTime,
      isLobby: channelIsLobby,
    } = channel;

    // Handlers
    const handleUpdateChannel = (
      channel: Partial<Channel>,
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.updateChannel({ channel, channelId, serverId });
    };

    const handleClose = () => {
      ipcService.window.close();
    };

    // Effects
    useEffect(() => {
      if (!channelId || refreshRef.current) return;
      const refresh = async () => {
        refreshRef.current = true;
        Promise.all([
          refreshService.channel({
            channelId: channelId,
          }),
        ]).then(([channel]) => {
          if (channel) {
            setChannel(channel);
          }
        });
      };
      refresh();
    }, [channelId]);

    return (
      <div className={popup['popupContainer']}>
        <div className={popup['popupBody']}>
          {/* Left Sidebar */}
          <div className={setting['left']}>
            <div className={setting['tabs']}>
              {[
                lang.tr.basicInfo,
                lang.tr.channelAnnouncement,
                lang.tr.accessPermissions,
                lang.tr.speakingPermissions,
                lang.tr.textPermissions,
                lang.tr.channelManagement,
              ].map((title, index) => (
                <div
                  className={`${setting['item']} ${
                    activeTabIndex === index ? setting['active'] : ''
                  }`}
                  onClick={() => setActiveTabIndex(index)}
                  key={index}
                >
                  {title}
                </div>
              ))}
            </div>
          </div>
          {/* Right Content */}
          <div className={setting['right']}>
            {activeTabIndex === 0 ? (
              <>
                <div className={popup['col']}>
                  <div className={popup['row']}>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>
                        {lang.tr.channelNameLabel}
                      </div>
                      <input
                        type="text"
                        value={channelName || ''}
                        onChange={(e) =>
                          setChannel((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>{lang.tr.userLimit}</div>
                      <input
                        type="number"
                        value={channelUserLimit || 0}
                        disabled={
                          channelVisibility === 'readonly' || channelIsLobby
                        }
                        onChange={(e) =>
                          setChannel((prev) => ({
                            ...prev,
                            userLimit: Math.max(
                              0,
                              Math.min(999, parseInt(e.target.value) || 0),
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className={`${popup['inputBox']} ${popup['col']}`}>
                    <div className={popup['label']}>{lang.tr.channelMode}</div>
                    <div className={popup['selectBox']}>
                      <select
                        value={channelVoiceMode}
                        onChange={(e) =>
                          setChannel((prev) => ({
                            ...prev,
                            voiceMode: e.target.value as Channel['voiceMode'],
                          }))
                        }
                      >
                        <option value="free">{lang.tr.freeSpeech}</option>
                        <option value="forbidden">
                          {lang.tr.forbiddenSpeech}
                        </option>
                        <option value="queue">{lang.tr.queueSpeech}</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className={setting['saperator']} />
                <div className={popup['col']}>
                  <div className={popup['label']}>
                    {lang.tr.channelAudioQuality}
                  </div>
                  <div className={popup['inputGroup']}>
                    <div
                      className={`${popup['inputBox']} ${popup['row']} ${popup['disabled']}`}
                    >
                      <input type="radio" name="voiceQuality" defaultChecked />
                      <div>
                        <label className={popup['label']}>
                          {lang.tr.chatMode}
                        </label>
                        <div className={popup['hint']}>
                          {lang.tr.chatModeDescription}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`${popup['inputBox']} ${popup['row']} ${popup['disabled']}`}
                    >
                      <input type="radio" name="voiceQuality" />
                      <div>
                        <label className={popup['label']}>
                          {lang.tr.entertainmentMode}
                        </label>
                        <div className={popup['hint']}>
                          {lang.tr.entertainmentModeDescription}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : activeTabIndex === 1 ? (
              <div className={popup['col']}>
                <div className={popup['label']}>
                  {lang.tr.inputAnnouncement}
                </div>
                <div
                  className={`${popup['inputBox']} ${popup['col']} ${popup['disabled']}`}
                >
                  <textarea
                    style={{ minHeight: '200px' }}
                    // value={channelAnnouncement}
                    placeholder={'目前不可用'}
                    value={''}
                    // onChange={(e) => setChannelAnnouncement(e.target.value)}
                    onChange={() => {}}
                  />
                  <div className={popup['label']}>
                    {lang.tr.markdownSupport}
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 2 ? (
              <div className={popup['col']}>
                <label>{lang.tr.accessPermissions}</label>
                <div className={popup['inputGroup']}>
                  <div
                    className={`${popup['inputBox']} ${
                      channelIsLobby ? popup['disabled'] : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="voiceQuality"
                      checked={channelVisibility === 'public'}
                      onChange={() => {
                        setChannel((prev) => ({
                          ...prev,
                          visibility: 'public',
                        }));
                      }}
                    />
                    <div>
                      <label className={popup['label']}>
                        {lang.tr.channelPublic}
                      </label>
                    </div>
                  </div>

                  <div
                    className={`${popup['inputBox']} ${
                      channelIsLobby ? popup['disabled'] : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="voiceQuality"
                      checked={channelVisibility === 'member'}
                      onChange={() => {
                        setChannel((prev) => ({
                          ...prev,
                          visibility: 'member',
                        }));
                      }}
                    />
                    <div>
                      <label className={popup['label']}>
                        {lang.tr.channelMember}
                      </label>
                    </div>
                  </div>

                  <div
                    className={`${popup['inputBox']} ${
                      channelIsLobby ? popup['disabled'] : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="voiceQuality"
                      checked={channelVisibility === 'readonly'}
                      onChange={() => {
                        setChannel((prev) => ({
                          ...prev,
                          visibility: 'readonly',
                        }));
                      }}
                    />
                    <div>
                      <label className={popup['label']}>
                        {lang.tr.channelReadonly}
                      </label>
                    </div>
                  </div>

                  <div
                    className={`${popup['inputBox']} ${
                      channelIsLobby ? popup['disabled'] : ''
                    } ${popup['row']}`}
                  >
                    <input
                      type="radio"
                      name="voiceQuality"
                      checked={channelVisibility === 'private'}
                      onChange={() => {
                        setChannel((prev) => ({
                          ...prev,
                          visibility: 'private',
                        }));
                      }}
                    />
                    <label className={popup['label']}>
                      {lang.tr.channelPrivate}
                    </label>
                  </div>

                  {channelVisibility === 'private' && (
                    <div className={popup['inputBox']}>
                      <input
                        className={popup['input']}
                        type="text"
                        value={channelPassword || ''}
                        maxLength={4}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (isNaN(parseInt(value)))
                            setChannel((prev) => ({
                              ...prev,
                              password: null,
                            }));
                          else
                            setChannel((prev) => ({
                              ...prev,
                              password: value,
                            }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : activeTabIndex === 3 ? (
              <div className={popup['col']}>
                <label>{lang.tr.speakingPermissions}</label>
                <div className={popup['inputGroup']}>
                  <div className={`${popup['inputBox']} ${popup['disabled']}`}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <div>
                      <label className={popup['label']}>
                        {lang.tr.forbidGuestQueue}
                      </label>
                    </div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['disabled']}`}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}}
                    />
                    <div>
                      <label className={popup['label']}>
                        {lang.tr.forbidGuestVoice}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 4 ? (
              <div className={popup['col']}>
                <label>{lang.tr.textPermissions}</label>
                <div className={popup['inputGroup']}>
                  <div className={popup['inputBox']}>
                    <input
                      type="checkbox"
                      checked={channelForbidText}
                      onChange={(e) => {
                        setChannel((prev) => ({
                          ...prev,
                          forbidText: e.target.checked,
                        }));
                      }}
                    />
                    <label className={popup['label']}>
                      {lang.tr.forbidOnlyAdminText}
                    </label>
                  </div>

                  <div className={popup['inputBox']}>
                    <input
                      type="checkbox"
                      checked={channelGuestTextForbid}
                      onChange={(e) =>
                        setChannel((prev) => ({
                          ...prev,
                          forbidGuestText: e.target.checked,
                        }))
                      }
                    />
                    <label className={popup['label']}>
                      {lang.tr.forbidGuestText}
                    </label>
                  </div>

                  <div className={popup['inputBox']}>
                    <input
                      type="checkbox"
                      checked={channelGuestTextForbidUrl}
                      onChange={(e) =>
                        setChannel((prev) => ({
                          ...prev,
                          forbidGuestTextForbidUrl: e.target.checked,
                        }))
                      }
                    />
                    <label className={popup['label']}>
                      {lang.tr.forbidGuestUrl}
                    </label>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <div className={popup['label']}>
                      {lang.tr.guestTextMaxLength}
                    </div>
                    <input
                      type="number"
                      value={channelGuestTextMaxLength}
                      onChange={(e) =>
                        setChannel((prev) => ({
                          ...prev,
                          guestTextMaxLength: Math.max(
                            0,
                            parseInt(e.target.value) || 0,
                          ),
                        }))
                      }
                      style={{ width: '60px' }}
                    />
                    <div className={popup['label']}>{lang.tr.characters}</div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <div className={popup['label']}>
                      {lang.tr.guestTextWaitTime}
                    </div>
                    <input
                      type="number"
                      value={channelGuestTextWaitTime}
                      onChange={(e) =>
                        setChannel((prev) => ({
                          ...prev,
                          guestTextWaitTime: Math.max(
                            0,
                            parseInt(e.target.value) || 0,
                          ),
                        }))
                      }
                      style={{ width: '60px' }}
                    />
                    <div className={popup['label']}>{lang.tr.seconds}</div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <div className={popup['label']}>
                      {lang.tr.guestTextGapTime}
                    </div>
                    <input
                      type="number"
                      value={channelGuestTextGapTime}
                      onChange={(e) =>
                        setChannel((prev) => ({
                          ...prev,
                          guestTextGapTime: Math.max(
                            0,
                            parseInt(e.target.value) || 0,
                          ),
                        }))
                      }
                      style={{ width: '60px' }}
                    />
                    <div className={popup['label']}>{lang.tr.seconds}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={popup['popupFooter']}>
          <button
            className={popup['button']}
            onClick={() => {
              handleUpdateChannel(
                {
                  name: channelName,
                  visibility: channelVisibility,
                  password: channelPassword,
                  userLimit: channelUserLimit,
                  voiceMode: channelVoiceMode,
                  order: channelOrder,
                  forbidText: channelForbidText,
                  forbidGuestText: channelGuestTextForbid,
                  forbidGuestUrl: channelGuestTextForbidUrl,
                  guestTextMaxLength: channelGuestTextMaxLength,
                  guestTextWaitTime: channelGuestTextWaitTime,
                  guestTextGapTime: channelGuestTextGapTime,
                },
                channelId,
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
        </div>
      </div>
    );
  },
);

ChannelSettingPopup.displayName = 'ChannelSettingPopup';

export default ChannelSettingPopup;
