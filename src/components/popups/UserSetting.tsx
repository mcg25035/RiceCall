import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

// Types
import { Server, User, UserServer, PopupType, Friend } from '@/types';

// Components
import BadgeListViewer from '@/components/viewers/BadgeList';

// Providers
import { useSocket } from '@/providers/Socket';
import { useLanguage } from '@/providers/Language';

// Services
import ipcService from '@/services/ipc.service';
import refreshService from '@/services/refresh.service';
import apiService from '@/services/api.service';

// CSS
import setting from '@/styles/popups/editProfile.module.css';
import grade from '@/styles/grade.module.css';
import popup from '@/styles/popup.module.css';
import vip from '@/styles/vip.module.css';
import permission from '@/styles/permission.module.css';

// Utils
import { createDefault } from '@/utils/createDefault';

interface UserSettingPopupProps {
  userId: User['userId'];
  targetId: string;
}

const UserSettingPopup: React.FC<UserSettingPopupProps> = React.memo(
  (initialData: UserSettingPopupProps) => {
    // Props
    const socket = useSocket();
    const lang = useLanguage();

    // Refs
    const refreshRef = useRef(false);
    const isSelectingRef = useRef(false);
    const isLoading = useRef(false);

    // Constants
    const TODAY = useMemo(() => new Date(), []);
    const CURRENT_YEAR = TODAY.getFullYear();
    const CURRENT_MONTH = TODAY.getMonth() + 1;
    const CURRENT_DAY = TODAY.getDate();
    const MAIN_TABS = [
      { id: 'about', label: lang.tr.about },
      { id: 'groups', label: lang.tr.servers },
      { id: 'userSetting', label: '' },
    ];

    // User states
    const [user, setUser] = useState<User>(createDefault.user());
    const [friend, setFriend] = useState<Friend>(createDefault.friend());
    const [servers, setServers] = useState<UserServer[]>([]);
    const [serversView, setServersView] = useState('joined');
    const [selectedTabId, setSelectedTabId] = useState<
      'about' | 'groups' | 'userSetting'
    >('about');

    // Variables
    const { userId, targetId } = initialData;
    const {
      name: userName,
      avatar: userAvatar,
      avatarUrl: userAvatarUrl,
      gender: userGender,
      signature: userSignature,
      level: userLevel,
      xp: userXP,
      requiredXp: userRequiredXP,
      vip: userVip,
      birthYear: userBirthYear,
      birthMonth: userBirthMonth,
      birthDay: userBirthDay,
      country: userCountry,
      badges: userBadges,
    } = user;
    const userGrade = Math.min(56, userLevel);
    const isSelf = targetId === userId;
    const isFriend = !!friend.targetId;
    const isEditing = isSelf && selectedTabId === 'userSetting';
    const joinedServers = servers
      .filter((s) => s.permissionLevel > 1 && s.permissionLevel < 7)
      .sort((a, b) => b.permissionLevel - a.permissionLevel);
    const favoriteServers = servers
      .filter((s) => s.favorite)
      .sort((a, b) => b.permissionLevel - a.permissionLevel);
    const recentServers = servers
      .filter((s) => s.recent)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4);

    const isFutureDate = useCallback(
      (year: number, month: number, day: number) => {
        if (year > CURRENT_YEAR) return true;
        if (year === CURRENT_YEAR && month > CURRENT_MONTH) return true;
        if (
          year === CURRENT_YEAR &&
          month === CURRENT_MONTH &&
          day > CURRENT_DAY
        )
          return true;
        return false;
      },
      [CURRENT_YEAR, CURRENT_MONTH, CURRENT_DAY],
    );

    const calculateAge = (
      birthYear: number,
      birthMonth: number,
      birthDay: number,
    ) => {
      const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
      let age = CURRENT_YEAR - birthDate.getFullYear();
      const monthDiff = CURRENT_MONTH - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && CURRENT_DAY < birthDate.getDate())
      ) {
        age--;
      }
      return age;
    };

    const userAge = calculateAge(userBirthYear, userBirthMonth, userBirthDay);

    const yearOptions = useMemo(
      () =>
        Array.from(
          { length: CURRENT_YEAR - 1900 + 1 },
          (_, i) => CURRENT_YEAR - i,
        ),
      [CURRENT_YEAR],
    );

    const monthOptions = useMemo(
      () => Array.from({ length: 12 }, (_, i) => i + 1),
      [],
    );

    const dayOptions = useMemo(
      () =>
        Array.from(
          { length: new Date(userBirthYear, userBirthMonth, 0).getDate() },
          (_, i) => i + 1,
        ),
      [userBirthYear, userBirthMonth],
    );

    // Handlers
    const handleUpdateUser = (user: Partial<User>) => {
      if (!socket) return;
      socket.send.updateUser({ user, userId });
    };

    const handleOpenApplyFriend = (
      userId: User['userId'],
      targetId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.APPLY_FRIEND, 'applyFriend');
      ipcService.initialData.onRequest('applyFriend', {
        userId,
        targetId,
      });
    };

    const handleMinimize = () => {
      ipcService.window.minimize();
    };

    const handleClose = () => {
      ipcService.window.close();
    };

    // FIXME: maybe find a better way to handle this
    const handleServerSelect = (userId: User['userId'], server: Server) => {
      if (isSelectingRef.current || isLoading.current || isSelectingRef.current)
        return;
      isSelectingRef.current = true;
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 3000);
      window.localStorage.setItem(
        'trigger-handle-server-select',
        JSON.stringify({
          serverDisplayId: server.displayId,
          timestamp: Date.now(),
        }),
      );
      setTimeout(() => {
        socket.send.connectServer({ userId, serverId: server.serverId });
      }, 1500);
    };

    // Effects
    useEffect(() => {
      if (!targetId || refreshRef.current) return;
      const refresh = async () => {
        refreshRef.current = true;
        Promise.all([
          refreshService.user({
            userId: targetId,
          }),
          refreshService.userServers({
            userId: targetId,
          }),
          refreshService.friend({
            userId: userId,
            targetId: targetId,
          }),
        ]).then(([user, servers, friend]) => {
          if (user) {
            setUser(user);
          }
          if (servers) {
            setServers(servers);
          }
          if (friend) {
            setFriend(friend);
          }
        });
      };
      refresh();
    }, [userId, targetId]);

    useEffect(() => {
      const daysInMonth = new Date(userBirthYear, userBirthMonth, 0).getDate();

      if (userBirthDay > daysInMonth) {
        setUser((prev) => ({ ...prev, birthDay: daysInMonth }));
      }

      if (isFutureDate(userBirthYear, userBirthMonth, userBirthDay)) {
        setUser((prev) => ({
          ...prev,
          birthYear: CURRENT_YEAR,
          birthMonth: CURRENT_MONTH,
          birthDay: CURRENT_DAY,
        }));
      }
    }, [
      userBirthYear,
      userBirthMonth,
      userBirthDay,
      CURRENT_YEAR,
      CURRENT_MONTH,
      CURRENT_DAY,
      isFutureDate,
    ]);

    const ProfilePrivate = false; // TODO: 隱私設定開關，等設定功能完工
    const PrivateElement = (text: React.ReactNode) => {
      return <div className={setting['userRecentVisitsPrivate']}>{text}</div>;
    };
    const getMainContent = () => {
      switch (selectedTabId) {
        case 'about':
          return (
            <>
              {isSelf && (
                <div className={setting['editTabBar']}>
                  <div
                    className={setting['button']}
                    onClick={() => setSelectedTabId('userSetting')}
                  >
                    {lang.tr.editProfile}
                  </div>
                </div>
              )}
              <div className={setting['userAboutMeShow']}>{userSignature}</div>
              <div className={setting['userProfileContent']}>
                <div className={setting['title']}>
                  {lang.tr.recentlyJoinServer}
                </div>
                {!ProfilePrivate && recentServers.length ? (
                  <div className={setting['serverItems']}>
                    {recentServers.map((server) => (
                      <div
                        key={server.serverId}
                        className={setting['serverItem']}
                        onClick={() => handleServerSelect(userId, server)}
                      >
                        <div
                          className={setting['serverAvatarPicture']}
                          style={{
                            backgroundImage: `url(${server.avatarUrl})`,
                          }}
                        />
                        <div className={setting['serverBox']}>
                          <div className={setting['serverName']}>
                            {server.name}
                          </div>
                          <div className={setting['serverInfo']}>
                            <div
                              className={`${
                                isSelf && server.ownerId === userId
                                  ? setting['isOwner']
                                  : ''
                              }`}
                            />
                            <div className={setting['id']} />
                            <div className={setting['displayId']}>
                              {server.displayId}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ProfilePrivate ? (
                  PrivateElement(
                    <>
                      {lang.tr.notPublicRecentServersTop}
                      <br />
                      {lang.tr.notPublicRecentServersBottom}
                    </>,
                  )
                ) : (
                  PrivateElement(lang.tr.noRecentServers)
                )}
              </div>
              <div className={`${setting['userProfileContent']}`}>
                <div className={setting['title']}>
                  {lang.tr.recentlyEarnedBadges}
                </div>
                <div className={setting['badgeViewer']}>
                  <BadgeListViewer badges={userBadges} maxDisplay={13} />
                </div>
              </div>
            </>
          );
        case 'groups':
          return (
            <div className={setting['joinedServers']}>
              <div className={`${popup['inputBox']}`}>
                <div className={`${popup['selectBox']}`}>
                  <select
                    value={serversView}
                    onChange={(e) => setServersView(e.target.value)}
                  >
                    <option value="joined">{lang.tr.joinedServers}</option>
                    <option value="favorite">{lang.tr.favoriteServers}</option>
                  </select>
                </div>
              </div>
              <div className={setting['serverItems']}>
                {serversView === 'joined'
                  ? ProfilePrivate
                    ? PrivateElement(
                        <>
                          {lang.tr.notPublicJoinedServersTop}
                          <br />
                          {lang.tr.notPublicJoinedServersBottom}
                        </>,
                      )
                    : joinedServers.length === 0
                    ? PrivateElement(lang.tr.noJoinedServers)
                    : joinedServers.map((server) => (
                        <div
                          key={server.serverId}
                          className={setting['serverItem']}
                          onClick={() => handleServerSelect(userId, server)}
                        >
                          <div
                            className={setting['serverAvatarPicture']}
                            style={{
                              backgroundImage: `url(${server.avatarUrl})`,
                            }}
                          />
                          <div className={setting['serverBox']}>
                            <div className={setting['serverName']}>
                              {server.name}
                            </div>
                            <div
                              className={`${setting['serverInfo']} ${setting['around']}`}
                            >
                              <div
                                className={`
                                ${setting['permission']}
                                ${permission[userGender]} 
                                ${
                                  server.ownerId === targetId
                                    ? permission[`lv-6`]
                                    : permission[`lv-${server.permissionLevel}`]
                                }`}
                              />
                              <div className={setting['contributionBox']}>
                                <div
                                  className={setting['contributionIcon']}
                                ></div>
                                <div className={setting['contributionValue']}>
                                  {server.contribution}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  : ProfilePrivate
                  ? PrivateElement(
                      <>
                        {lang.tr.notPublicFavoriteServersTop}
                        <br />
                        {lang.tr.notPublicFavoriteServersBottom}
                      </>,
                    )
                  : favoriteServers.length === 0
                  ? PrivateElement(lang.tr.noFavoriteServers)
                  : favoriteServers.map((server) => (
                      <div
                        key={server.serverId}
                        className={setting['serverItem']}
                        onClick={() => handleServerSelect(userId, server)}
                      >
                        <div
                          className={setting['serverAvatarPicture']}
                          style={{
                            backgroundImage: `url(${server.avatarUrl})`,
                          }}
                        />
                        <div className={setting['serverBox']}>
                          <div className={setting['serverName']}>
                            {server.name}
                          </div>
                          <div
                            className={`${setting['serverInfo']} ${setting['around']}`}
                          >
                            <div
                              className={`
                              ${setting['permission']}
                              ${permission[userGender]} 
                              ${
                                server.ownerId === targetId
                                  ? permission[`lv-6`]
                                  : permission[`lv-${server.permissionLevel}`]
                              }`}
                            />
                            <div className={setting['contributionBox']}>
                              <div>{`${lang.tr.contribution}:`}</div>
                              <div className={setting['contributionValue']}>
                                {server.contribution}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          );
        case 'userSetting':
          return (
            <>
              <div className={setting['editTabBar']}>
                <div
                  className={`${setting['confirmedButton']} ${
                    setting['blueBtn']
                  } ${
                    !userName ||
                    !userGender ||
                    !userCountry ||
                    !userBirthYear ||
                    !userBirthMonth ||
                    !userBirthDay
                      ? setting['disabled']
                      : ''
                  }`}
                  onClick={() => {
                    handleUpdateUser({
                      avatar: userAvatar,
                      avatarUrl: userAvatarUrl,
                      name: userName,
                      gender: userGender,
                      country: userCountry,
                      birthYear: userBirthYear,
                      birthMonth: userBirthMonth,
                      birthDay: userBirthDay,
                      signature: userSignature,
                    });
                    setSelectedTabId('about');
                  }}
                >
                  {lang.tr.confirm}
                </div>
                <div
                  className={setting['button']}
                  onClick={() => setSelectedTabId('about')}
                >
                  {lang.tr.cancel}
                </div>
              </div>
              <div className={setting['userProfileContent']}>
                <div className={popup['col']}>
                  <div className={popup['row']}>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <label
                        className={popup['label']}
                        htmlFor="profile-form-nickname"
                      >
                        {lang.tr.nickname}
                      </label>
                      <input
                        type="text"
                        id="profile-form-nickname"
                        value={userName}
                        maxLength={32}
                        minLength={2}
                        onChange={(e) =>
                          setUser((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>

                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <label
                        className={popup['label']}
                        htmlFor="profile-form-gender"
                      >
                        {lang.tr.gender}
                      </label>
                      <div
                        className={`${popup['selectBox']} ${popup['selectBoxMax']}`}
                      >
                        <select
                          value={userGender}
                          onChange={(e) =>
                            setUser((prev) => ({
                              ...prev,
                              gender: e.target.value as User['gender'],
                            }))
                          }
                        >
                          <option value="Male">{lang.tr.male}</option>
                          <option value="Female">{lang.tr.female}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className={popup['row']}>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <label
                        className={popup['label']}
                        htmlFor="profile-form-country"
                      >
                        {lang.tr.country}
                      </label>
                      <div className={popup['selectBox']}>
                        <select
                          value={userCountry}
                          onChange={(e) =>
                            setUser((prev) => ({
                              ...prev,
                              country: e.target.value,
                            }))
                          }
                        >
                          <option value="taiwan">{lang.tr.taiwan}</option>
                          <option value="china">{lang.tr.china}</option>
                          <option value="japan">{lang.tr.japan}</option>
                          <option value="korea">{lang.tr.korea}</option>
                          <option value="usa">{lang.tr.usa}</option>
                          <option value="uk">{lang.tr.uk}</option>
                          <option value="france">{lang.tr.france}</option>
                          <option value="germany">{lang.tr.germany}</option>
                          <option value="italy">{lang.tr.italy}</option>
                          <option value="spain">{lang.tr.spain}</option>
                          <option value="portugal">{lang.tr.portugal}</option>
                          <option value="brazil">{lang.tr.brazil}</option>
                          <option value="argentina">{lang.tr.argentina}</option>
                          <option value="mexico">{lang.tr.mexico}</option>
                          <option value="colombia">{lang.tr.colombia}</option>
                          <option value="chile">{lang.tr.chile}</option>
                          <option value="peru">{lang.tr.peru}</option>
                          <option value="venezuela">{lang.tr.venezuela}</option>
                          <option value="bolivia">{lang.tr.bolivia}</option>
                          <option value="ecuador">{lang.tr.ecuador}</option>
                          <option value="paraguay">{lang.tr.paraguay}</option>
                          <option value="uruguay">{lang.tr.uruguay}</option>
                          <option value="nigeria">{lang.tr.nigeria}</option>
                          <option value="southAfrica">
                            {lang.tr.southAfrica}
                          </option>
                          <option value="india">{lang.tr.india}</option>
                          <option value="indonesia">{lang.tr.indonesia}</option>
                          <option value="malaysia">{lang.tr.malaysia}</option>
                          <option value="philippines">
                            {lang.tr.philippines}
                          </option>
                          <option value="thailand">{lang.tr.thailand}</option>
                          <option value="vietnam">{lang.tr.vietnam}</option>
                          <option value="turkey">{lang.tr.turkey}</option>
                          <option value="saudiArabia">
                            {lang.tr.saudiArabia}
                          </option>
                          <option value="qatar">{lang.tr.qatar}</option>
                          <option value="kuwait">{lang.tr.kuwait}</option>
                          <option value="oman">{lang.tr.oman}</option>
                          <option value="bahrain">{lang.tr.bahrain}</option>
                          <option value="algeria">{lang.tr.algeria}</option>
                          <option value="morocco">{lang.tr.morocco}</option>
                          <option value="tunisia">{lang.tr.tunisia}</option>
                          <option value="nigeria">{lang.tr.nigeria}</option>
                        </select>
                      </div>
                    </div>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <label
                        className={popup['label']}
                        htmlFor="profile-form-birthdate"
                      >
                        {lang.tr.birthdate}
                      </label>
                      <div className={popup['row']}>
                        <div className={popup['selectBox']}>
                          <select
                            id="birthYear"
                            value={userBirthYear}
                            onChange={(e) =>
                              setUser((prev) => ({
                                ...prev,
                                birthYear: Number(e.target.value),
                              }))
                            }
                          >
                            {yearOptions.map((year) => (
                              <option
                                key={year}
                                value={year}
                                disabled={year > CURRENT_YEAR}
                              >
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={popup['selectBox']}>
                          <select
                            className={popup['input']}
                            id="birthMonth"
                            value={userBirthMonth}
                            onChange={(e) =>
                              setUser((prev) => ({
                                ...prev,
                                birthMonth: Number(e.target.value),
                              }))
                            }
                          >
                            {monthOptions.map((month) => (
                              <option
                                key={month}
                                value={month}
                                disabled={
                                  userBirthYear === CURRENT_YEAR &&
                                  month > CURRENT_MONTH
                                }
                              >
                                {month.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={popup['selectBox']}>
                          <select
                            className={popup['input']}
                            id="birthDay"
                            value={userBirthDay}
                            onChange={(e) =>
                              setUser((prev) => ({
                                ...prev,
                                birthDay: Number(e.target.value),
                              }))
                            }
                          >
                            {dayOptions.map((day) => (
                              <option
                                key={day}
                                value={day}
                                disabled={
                                  userBirthYear === CURRENT_YEAR &&
                                  userBirthMonth === CURRENT_MONTH &&
                                  day > CURRENT_DAY
                                }
                              >
                                {day.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['col']}`}>
                    <label
                      className={popup['label']}
                      htmlFor="profile-form-signature"
                    >
                      {lang.tr.signature}
                    </label>
                    <input
                      type="text"
                      id="profile-form-signature"
                      value={userSignature}
                      maxLength={200}
                      onChange={(e) =>
                        setUser((prev) => ({
                          ...prev,
                          signature: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div
                    className={`${popup['inputBox']} ${popup['col']} ${popup['disabled']}`}
                  >
                    <label
                      className={popup['label']}
                      htmlFor="profile-form-about"
                    >
                      {lang.tr.about}
                    </label>
                    <textarea id="profile-form-about" />
                  </div>
                </div>
              </div>
            </>
          );
      }
    };

    return (
      <div className={`${popup['popupContainer']} ${setting['userProfile']}`}>
        <div
          className={`${popup['col']} ${setting['profileBox']} ${
            !isSelf && setting['hiddenTab']
          }`}
        >
          <div className={setting['header']}>
            <div className={setting['windowActionButtons']}>
              <div
                className={setting['minimizeBtn']}
                onClick={handleMinimize}
              ></div>
              <div className={setting['closeBtn']} onClick={handleClose}></div>
            </div>
            <div
              className={`${setting['avatar']} ${
                isEditing && isSelf ? setting['editable'] : ''
              }`}
              style={{ backgroundImage: `url(${userAvatarUrl})` }}
              onClick={() => {
                if (!isSelf || !isEditing) return;
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const formData = new FormData();
                    formData.append('_type', 'user');
                    formData.append('_fileName', userId);
                    formData.append('_file', reader.result as string);
                    const data = await apiService.post('/upload', formData);
                    if (data) {
                      setUser((prev) => ({
                        ...prev,
                        avatar: data.avatar,
                        avatarUrl: data.avatarUrl,
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                };
                fileInput.click();
              }}
            />
            <div
              className={`${popup['row']} ${setting['noDrag']}`}
              style={{ marginTop: '10px', gap: '2px' }}
            >
              <div className={setting['userName']}>{userName}</div>
              {userVip > 0 && (
                <div
                  className={`${vip['vipIcon']} ${vip[`vip-small-${userVip}`]}`}
                />
              )}
              <div
                className={`${grade['grade']} ${grade[`lv-${userGrade}`]}`}
                title={
                  `${lang.tr.level}：${userLevel}，${lang.tr.xp}：${userXP}，${lang.tr.xpDifference}：${userRequiredXP}` /** LEVEL:{userLevel} EXP:{userXP} LEVEL UP REQUIRED:{userRequiredXP}**/
                }
              />
            </div>
            <div
              className={setting['userAccount']}
              onClick={() => {
                navigator.clipboard.writeText(userId);
              }}
            >
              @{userName}
            </div>
            <div className={setting['userContent']}>
              {lang.tr[userGender === 'Male' ? 'male' : 'female']} . {userAge} .
              {lang.tr[userCountry as keyof typeof lang.tr]}
            </div>
            <div className={setting['userSignature']}>{userSignature}</div>

            <div className={setting['tab']}>
              {MAIN_TABS.map((Tab) => {
                const TabId = Tab.id;
                const TabLabel = Tab.label;
                if (TabId === 'userSetting') return null;
                return (
                  <div
                    key={`Tabs-${TabId}`}
                    className={`${setting['item']} ${setting[TabId]} ${
                      TabId === selectedTabId ||
                      (selectedTabId === 'userSetting' && TabId !== 'groups')
                        ? setting['selected']
                        : ''
                    }`}
                    onClick={() => {
                      if (selectedTabId !== 'userSetting') {
                        setSelectedTabId(TabId as 'about' | 'groups');
                      }
                    }}
                  >
                    {TabLabel}
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={`${setting['body']} ${
              !userSignature && setting['userAboutEmpty']
            }`}
          >
            {getMainContent()}
          </div>
        </div>

        <div className={popup['popupFooter']}>
          {!isFriend && !isSelf && (
            <div
              className={`${setting['confirmedButton']} ${setting['greenBtn']}`}
              onClick={() => handleOpenApplyFriend(userId, targetId)}
            >
              {lang.tr.addFriend}
            </div>
          )}
          <div className={popup['button']} onClick={() => handleClose()}>
            {lang.tr.close /** CLOSE **/}
          </div>
        </div>
      </div>
    );
  },
);

UserSettingPopup.displayName = 'UserSettingPopup';

export default UserSettingPopup;
