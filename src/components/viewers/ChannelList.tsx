import React, { useState, useEffect, useRef } from 'react';

// CSS
import styles from '@/styles/pages/server.module.css';
import grade from '@/styles/grade.module.css';
import vip from '@/styles/vip.module.css';
import permission from '@/styles/permission.module.css';

// Types
import {
  PopupType,
  ServerMember,
  Channel,
  Server,
  User,
  Member,
  Category,
  UserFriend,
} from '@/types';

// Providers
import { useLanguage } from '@/providers/Language';
import { useSocket } from '@/providers/Socket';
import { useContextMenu } from '@/providers/ContextMenu';
import { useExpandedContext } from '@/providers/Expanded';
import { useWebRTC } from '@/providers/WebRTC';

// Components
import BadgeListViewer from '@/components/viewers/BadgeList';

// Services
import ipcService from '@/services/ipc.service';
import refreshService from '@/services/refresh.service';

interface CategoryTabProps {
  member: Member;
  category: Category;
  currentChannel: Channel;
  userFriends: UserFriend[];
  serverMembers: ServerMember[];
  serverChannels: (Channel | Category)[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const CategoryTab: React.FC<CategoryTabProps> = React.memo(
  ({
    member,
    category,
    currentChannel,
    userFriends,
    serverMembers,
    serverChannels,
    expanded,
    setExpanded,
  }) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();
    const contextMenu = useContextMenu();
    const { setCategoryExpanded } = useExpandedContext();

    // Variables
    const {
      channelId: categoryId,
      name: categoryName,
      visibility: categoryVisibility,
    } = category;
    const { permissionLevel, userId, serverId } = member;
    const categoryChannels = serverChannels
      .filter((ch) => ch.type === 'channel')
      .filter((ch) => ch.categoryId === categoryId);
    const userInCategory = categoryChannels.some(
      (ch) => ch.channelId === currentChannel.channelId,
    );
    const canManageChannel = permissionLevel > 4;

    // Handlers
    const handleDeleteChannel = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      handleOpenWarning(
        lang.tr.warningDeleteChannel.replace('{0}', categoryName),
        () => socket.send.deleteChannel({ channelId, serverId }),
      );
    };

    const handleOpenWarning = (message: string, callback: () => void) => {
      ipcService.popup.open(PopupType.DIALOG_WARNING);
      ipcService.initialData.onRequest(PopupType.DIALOG_WARNING, {
        iconType: 'warning',
        title: message,
        submitTo: PopupType.DIALOG_WARNING,
      });
      ipcService.popup.onSubmit(PopupType.DIALOG_WARNING, callback);
    };

    const handleOpenChannelSetting = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_SETTING);
      ipcService.initialData.onRequest(PopupType.CHANNEL_SETTING, {
        channelId,
        serverId,
      });
    };

    const handleOpenCreateChannel = (
      serverId: Server['serverId'],
      categoryId: Category['categoryId'],
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.CREATE_CHANNEL);
      ipcService.initialData.onRequest(PopupType.CREATE_CHANNEL, {
        serverId,
        categoryId,
        userId,
      });
    };

    const handleOpenChangeChannelOrder = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_CHANNEL_ORDER);
      ipcService.initialData.onRequest(PopupType.EDIT_CHANNEL_ORDER, {
        serverId,
        userId,
      });
    };

    // Effect
    useEffect(() => {
      if (setCategoryExpanded && userInCategory)
        setCategoryExpanded.current = () =>
          setExpanded((prev) => ({
            ...prev,
            [categoryId]: true,
          }));
    }, [categoryId, setCategoryExpanded, setExpanded, userInCategory]);

    return (
      <>
        {/* Category View */}
        <div
          key={categoryId}
          className={`${styles['channelTab']} `}
          onContextMenu={(e) => {
            contextMenu.showContextMenu(e.pageX, e.pageY, [
              {
                id: 'edit',
                label: lang.tr.editChannel,
                show: canManageChannel,
                onClick: () => handleOpenChannelSetting(categoryId, serverId),
              },
              {
                id: 'add',
                label: lang.tr.addChannel,
                show: canManageChannel,
                onClick: () =>
                  handleOpenCreateChannel(serverId, categoryId, userId),
              },
              {
                id: 'delete',
                label: lang.tr.deleteChannel,
                show: canManageChannel,
                onClick: () => {
                  if (!categoryName) return;
                  handleDeleteChannel(categoryId, serverId);
                },
              },
              {
                id: 'changeChannelOrder',
                label: lang.tr.editChannelOrder,
                show: canManageChannel,
                onClick: () => handleOpenChangeChannelOrder(userId, serverId),
              },
            ]);
          }}
        >
          <div
            className={`
              ${styles['tabIcon']} 
              ${expanded[categoryId] ? styles['expanded'] : ''}
              ${styles[categoryVisibility]}
            `}
            onClick={() =>
              setExpanded((prev) => ({
                ...prev,
                [categoryId]: !prev[categoryId],
              }))
            }
          />
          <div className={styles['channelTabLable']}>{categoryName}</div>
          {!expanded[categoryId] && userInCategory && (
            <div className={styles['myLocationIcon']} />
          )}
        </div>

        {/* Expanded Sections */}
        <div
          className={styles['channelList']}
          style={{
            display: expanded[categoryId] ? 'block' : 'none',
          }}
        >
          {categoryChannels
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((channel) => (
              <ChannelTab
                key={channel.channelId}
                member={member}
                channel={channel}
                currentChannel={currentChannel}
                userFriends={userFriends}
                serverMembers={serverMembers}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            ))}
        </div>
      </>
    );
  },
);

CategoryTab.displayName = 'CategoryTab';

interface ChannelTabProps {
  member: Member;
  channel: Channel;
  currentChannel: Channel;
  userFriends: UserFriend[];
  serverMembers: ServerMember[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const ChannelTab: React.FC<ChannelTabProps> = React.memo(
  ({
    member,
    channel,
    currentChannel,
    userFriends,
    serverMembers,
    expanded,
    setExpanded,
  }) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();
    const contextMenu = useContextMenu();
    const { setChannelExpanded } = useExpandedContext();

    // Variables
    const {
      channelId,
      name: channelName,
      isLobby: channelIsLobby,
      visibility: channelVisibility,
      userLimit: channelUserLimit,
      categoryId: channelCategoryId,
    } = channel;
    const { permissionLevel, userId, serverId } = member;
    const channelMembers = serverMembers.filter(
      (mb) => mb.currentChannelId === channelId,
    );
    const userInChannel = currentChannel.channelId === channelId;
    const canJoin =
      !userInChannel &&
      channelVisibility !== 'readonly' &&
      !(channelVisibility === 'private' && permissionLevel < 3) &&
      !(channelVisibility === 'member' && permissionLevel < 2) &&
      (channelUserLimit === 0 ||
        channelUserLimit > channelMembers.length ||
        permissionLevel > 4);
    const canManageChannel = permissionLevel > 4;
    const canCreate = canManageChannel && !channelIsLobby && !channelCategoryId;
    const canDelete = canManageChannel && !channelIsLobby;

    // Handlers
    const handleJoinChannel = (
      userId: User['userId'],
      serverId: Server['serverId'],
      channelId: Channel['channelId'],
    ) => {
      if (!socket) return;
      socket.send.connectChannel({ userId, channelId, serverId });
    };

    const handleDeleteChannel = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      handleOpenWarning(
        lang.tr.warningDeleteChannel.replace('{0}', channelName),
        () => socket.send.deleteChannel({ channelId, serverId }),
      );
    };

    const handleOpenWarning = (message: string, callback: () => void) => {
      ipcService.popup.open(PopupType.DIALOG_WARNING);
      ipcService.initialData.onRequest(PopupType.DIALOG_WARNING, {
        iconType: 'warning',
        title: message,
        submitTo: PopupType.DIALOG_WARNING,
      });
      ipcService.popup.onSubmit(PopupType.DIALOG_WARNING, callback);
    };

    const handleOpenChannelSetting = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_SETTING);
      ipcService.initialData.onRequest(PopupType.CHANNEL_SETTING, {
        channelId,
        serverId,
      });
    };

    const handleOpenCreateChannel = (
      serverId: Server['serverId'],
      channelId: Channel['channelId'] | null,
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.CREATE_CHANNEL);
      ipcService.initialData.onRequest(PopupType.CREATE_CHANNEL, {
        serverId,
        channelId,
        userId,
      });
    };

    const handleOpenEditChannelOrder = (
      serverId: Server['serverId'],
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_CHANNEL_ORDER);
      ipcService.initialData.onRequest(PopupType.EDIT_CHANNEL_ORDER, {
        serverId,
        userId,
      });
    };

    const handleOpenChannelPassword = (
      userId: User['userId'],
      serverId: Server['serverId'],
      channelId: Channel['channelId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_PASSWORD);
      ipcService.initialData.onRequest(PopupType.CHANNEL_PASSWORD, {
        userId,
        serverId,
        channelId,
      });
    };

    // Effect
    useEffect(() => {
      if (setChannelExpanded && userInChannel)
        setChannelExpanded.current = () =>
          setExpanded((prev) => ({
            ...prev,
            [channelId]: true,
          }));
    }, [channelId, setChannelExpanded, setExpanded, userInChannel]);

    return (
      <>
        {/* Channel View */}
        <div
          key={channelId}
          className={`${styles['channelTab']} `}
          onDoubleClick={() => {
            if (!userInChannel && channel.password && permissionLevel < 3) {
              handleOpenChannelPassword(userId, serverId, channelId);
            } else if (canJoin) {
              handleJoinChannel(userId, serverId, channelId);
            }
          }}
          onContextMenu={(e) => {
            contextMenu.showContextMenu(e.pageX, e.pageY, [
              {
                id: 'edit',
                label: lang.tr.editChannel,
                show: canManageChannel,
                onClick: () => handleOpenChannelSetting(channelId, serverId),
              },
              {
                id: 'add',
                label: lang.tr.addChannel,
                show: canCreate,
                onClick: () =>
                  handleOpenCreateChannel(serverId, channelId, userId),
              },
              {
                id: 'delete',
                label: lang.tr.deleteChannel,
                show: canDelete,
                onClick: () => {
                  if (!channelName) return;
                  handleDeleteChannel(channelId, serverId);
                },
              },
              {
                id: 'editChannelOrder',
                label: lang.tr.editChannelOrder,
                show: canManageChannel,
                onClick: () => handleOpenEditChannelOrder(serverId, userId),
              },
            ]);
          }}
        >
          <div
            className={`
              ${styles['tabIcon']} 
              ${expanded[channelId] ? styles['expanded'] : ''} 
              ${channelIsLobby ? styles['lobby'] : styles[channelVisibility]} 
            `}
            onClick={() =>
              setExpanded((prev) => ({
                ...prev,
                [channelId]: !prev[channelId],
              }))
            }
          />
          <div
            className={`${channelIsLobby ? styles['isLobby'] : ''} ${
              styles['channelTabLable']
            }`}
          >
            {channelName}
          </div>
          {channelVisibility !== 'readonly' && (
            <div className={styles['channelTabCount']}>
              {`(${channelMembers.length}${
                channelUserLimit > 0 ? `/${channelUserLimit}` : ''
              })`}
            </div>
          )}
          {userInChannel && !expanded[channelId] && (
            <div className={styles['myLocationIcon']} />
          )}
        </div>

        {/* Expanded Sections */}
        <div
          className={styles['userList']}
          style={{
            display: expanded[channelId] ? 'block' : 'none',
          }}
        >
          {channelMembers
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((channelMember) => (
              <UserTab
                key={channelMember.userId}
                userId={userId}
                serverId={serverId}
                member={channelMember}
                permissionLevel={permissionLevel}
                userFriends={userFriends}
              />
            ))}
        </div>
      </>
    );
  },
);

ChannelTab.displayName = 'ChannelTab';

interface UserTabProps {
  userId: User['userId'];
  serverId: Server['serverId'];
  member: ServerMember;
  permissionLevel: number;
  userFriends: UserFriend[];
}

const UserTab: React.FC<UserTabProps> = React.memo(
  ({ userId, serverId, member, permissionLevel, userFriends }) => {
    // Hooks
    const lang = useLanguage();
    const contextMenu = useContextMenu();
    const socket = useSocket();
    const webRTC = useWebRTC();

    // Variables
    const {
      userId: memberUserId,
      serverId: memberServerId,
      name: memberName,
      permissionLevel: memberPermission,
      nickname: memberNickname,
      level: memberLevel,
      gender: memberGender,
      badges: memberBadges,
      vip: memberVip,
    } = member;
    const memberGrade = Math.min(56, memberLevel); // 56 is max leve
    const isCurrentUser = memberUserId === userId;
    const speakingStatus =
      webRTC.speakStatus?.[memberUserId] ||
      (isCurrentUser && webRTC.volumePercent) ||
      0;
    const isSpeaking = speakingStatus !== 0;
    const isMuted = speakingStatus === -1;
    const isMutedByUser = webRTC.muteList.includes(memberUserId);
    const isFriend = userFriends.some((fd) => fd.targetId === memberUserId);
    const canManageMember =
      !isCurrentUser &&
      permissionLevel > 4 &&
      permissionLevel > memberPermission &&
      memberPermission > 1;
    const canEditNickname =
      canManageMember || (isCurrentUser && permissionLevel > 1);
    const canChangeToGuest = canManageMember && memberPermission !== 1;
    const canChangeToMember = canManageMember && memberPermission !== 2;
    const canChangeToChannelAdmin = canManageMember && memberPermission !== 3;
    const canChangeToCategoryAdmin = canManageMember && memberPermission !== 4;
    const canChangeToAdmin = canManageMember && memberPermission !== 5;
    const canKick =
      !isCurrentUser &&
      permissionLevel > 4 &&
      permissionLevel > memberPermission &&
      memberServerId === serverId;

    // Handlers
    const handleKickUser = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.disconnectServer({ userId, serverId });
    };

    const handleOpenEditNickname = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_NICKNAME);
      ipcService.initialData.onRequest(PopupType.EDIT_NICKNAME, {
        serverId,
        userId,
      });
    };

    const handleOpenApplyFriend = (
      userId: User['userId'],
      targetId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.APPLY_FRIEND);
      ipcService.initialData.onRequest(PopupType.APPLY_FRIEND, {
        userId,
        targetId,
      });
    };

    const handleOpenDirectMessage = (
      userId: User['userId'],
      targetId: User['userId'],
      targetName: User['name'],
    ) => {
      ipcService.popup.open(PopupType.DIRECT_MESSAGE);
      ipcService.initialData.onRequest(PopupType.DIRECT_MESSAGE, {
        userId,
        targetId,
        targetName,
      });
    };

    const handleOpenUserInfo = (
      userId: User['userId'],
      targetId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.USER_INFO);
      ipcService.initialData.onRequest(PopupType.USER_INFO, {
        userId,
        targetId,
      });
    };

    const handleUpdateMember = (
      member: Partial<Member>,
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.updateMember({
        member,
        userId,
        serverId,
      });
    };
    return (
      <div
        key={memberUserId}
        className={`${styles['userTab']}`}
        onClick={(e) => {
          contextMenu.showUserInfoBlock(e.pageX, e.pageY, member);
        }}
        onContextMenu={(e) => {
          contextMenu.showContextMenu(
            e.pageX,
            e.pageY,
            [
              {
                id: 'direct-message',
                label: lang.tr.directMessage,
                show: !isCurrentUser,
                onClick: () =>
                  handleOpenDirectMessage(userId, memberUserId, memberName),
              },
              {
                id: 'view-profile',
                label: lang.tr.viewProfile,
                show: !isCurrentUser,
                onClick: () => handleOpenUserInfo(userId, memberUserId),
              },
              {
                id: 'apply-friend',
                label: lang.tr.addFriend,
                show: !isCurrentUser,
                onClick: () => handleOpenApplyFriend(userId, memberUserId),
              },
              {
                id: 'edit-nickname',
                label: lang.tr.editNickname,
                show: canEditNickname,
                onClick: () =>
                  handleOpenEditNickname(memberUserId, memberServerId),
              },
              {
                id: 'separator',
                label: '',
                show: canManageMember || canKick,
              },
              {
                id: 'kick',
                label: lang.tr.kick,
                show: canKick,
                onClick: () => handleKickUser(memberUserId, memberServerId),
              },
              {
                id: 'member-management',
                label: lang.tr.memberManagement,
                show: canManageMember,
                icon: 'submenu',
                hasSubmenu: true,
                submenuItems: [
                  {
                    id: 'set-guest',
                    label: lang.tr.setGuest,
                    show: canChangeToGuest,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 1 },
                        memberUserId,
                        memberServerId,
                      ),
                  },
                  {
                    id: 'set-member',
                    label: lang.tr.setMember,
                    show: canChangeToMember,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 1 },
                        memberUserId,
                        memberServerId,
                      ),
                  },
                  {
                    id: 'set-channel-admin',
                    label: lang.tr.setChannelAdmin,
                    show: canChangeToChannelAdmin,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 3 },
                        memberUserId,
                        memberServerId,
                      ),
                  },
                  {
                    id: 'set-category-admin',
                    label: lang.tr.setCategoryAdmin,
                    show: canChangeToCategoryAdmin,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 4 },
                        memberUserId,
                        memberServerId,
                      ),
                  },
                  {
                    id: 'set-admin',
                    label: lang.tr.setAdmin,
                    show: canChangeToAdmin,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 5 },
                        memberUserId,
                        memberServerId,
                      ),
                  },
                ],
              },
            ],
            e.currentTarget as HTMLElement,
          );
        }}
      >
        <div
          className={`
            ${styles['userState']} 
            ${isSpeaking && !isMuted ? styles['play'] : ''} 
            ${!isSpeaking && isMuted ? styles['muted'] : ''} 
            ${isMutedByUser ? styles['muted'] : ''}
          `}
        />
        <div
          className={`
            ${permission[memberGender]} 
            ${permission[`lv-${memberPermission}`]}
          `}
        />
        {memberVip > 0 && (
          <div
            className={`
              ${vip['vipIcon']} 
              ${vip[`vip-small-${memberVip}`]}
            `}
          />
        )}
        <div
          className={`
            ${styles['userTabName']} 
            ${memberNickname ? styles['member'] : ''}
            ${memberVip > 0 ? styles['isVIP'] : ''}
          `}
        >
          {memberNickname || memberName}
        </div>
        <div
          className={`
            ${grade['grade']} 
            ${grade[`lv-${memberGrade}`]}
          `}
        />
        <BadgeListViewer badges={memberBadges} maxDisplay={5} />
        {isCurrentUser && <div className={styles['myLocationIcon']} />}
      </div>
    );
  },
);

UserTab.displayName = 'UserTab';

interface ChannelListViewerProps {
  member: Member;
  server: Server;
  currentChannel: Channel;
  serverMembers: ServerMember[];
  serverChannels: (Channel | Category)[];
}

const ChannelListViewer: React.FC<ChannelListViewerProps> = React.memo(
  ({ member, server, currentChannel, serverMembers, serverChannels }) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();
    const contextMenu = useContextMenu();
    const { handleSetCategoryExpanded, handleSetChannelExpanded } =
      useExpandedContext();

    // Ref
    const refreshed = useRef(false);

    // States
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [view, setView] = useState<'all' | 'current'>('all');
    const [latency, setLatency] = useState<string>('0');
    const [userFriends, setUserFriends] = useState<UserFriend[]>([]);

    // Variables
    const connectStatus = 4 - Math.floor(Number(latency) / 50);
    const {
      name: serverName,
      avatarUrl: serverAvatarUrl,
      displayId: serverDisplayId,
      receiveApply: serverReceiveApply,
    } = server;
    const { permissionLevel, userId, serverId } = member;
    const {
      channelId: currentChannelId,
      name: currentChannelName,
      voiceMode: currentChannelVoiceMode,
    } = currentChannel;
    const canEditNickname = permissionLevel > 1;
    const canApplyMember = permissionLevel < 2;
    const canOpenSettings = permissionLevel > 4;

    // Handlers
    const handleOpenAlert = (message: string) => {
      ipcService.popup.open(PopupType.DIALOG_ALERT);
      ipcService.initialData.onRequest(PopupType.DIALOG_ALERT, {
        title: message,
      });
    };

    const handleOpenServerSetting = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.SERVER_SETTING);
      ipcService.initialData.onRequest(PopupType.SERVER_SETTING, {
        serverId,
        userId,
      });
    };

    const handleOpenApplyMember = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!serverReceiveApply) {
        handleOpenAlert(lang.tr.cannotApply);
        return;
      }
      ipcService.popup.open(PopupType.APPLY_MEMBER);
      ipcService.initialData.onRequest(PopupType.APPLY_MEMBER, {
        userId,
        serverId,
      });
    };

    const handleOpenEditNickname = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_NICKNAME);
      ipcService.initialData.onRequest(PopupType.EDIT_NICKNAME, {
        serverId,
        userId,
      });
    };

    const handleLocateUser = () => {
      if (!handleSetCategoryExpanded || !handleSetChannelExpanded) return;
      handleSetCategoryExpanded();
      handleSetChannelExpanded();
    };

    // Effects
    useEffect(() => {
      for (const channel of serverChannels) {
        setExpanded((prev) => ({
          ...prev,
          [channel.channelId]:
            prev[channel.channelId] != undefined
              ? prev[channel.channelId]
              : true,
        }));
      }
    }, [serverChannels]);

    useEffect(() => {
      if (!socket) return;
      let start = Date.now();
      let end = Date.now();
      socket.send.ping(null);
      const measure = setInterval(() => {
        start = Date.now();
        socket.send.ping(null);
      }, 10000);
      const clearPong = socket.on.pong(() => {
        end = Date.now();
        setLatency((end - start).toFixed(0));
      });
      return () => {
        clearInterval(measure);
        clearPong();
      };
    }, [socket]);

    useEffect(() => {
      if (!userId || refreshed.current) return;
      const refresh = async () => {
        refreshed.current = true;
        Promise.all([
          refreshService.userFriends({
            userId: userId,
          }),
        ]).then(([userFriends]) => {
          if (!userFriends?.length) return;
          setUserFriends(userFriends);
        });
      };
      refresh();
    }, [userId, currentChannel.channelId]);

    return (
      <>
        {/* Header */}
        <div className={styles['sidebarHeader']}>
          <div
            className={styles['avatarBox']}
            onClick={() => {
              if (!canOpenSettings) return;
              handleOpenServerSetting(userId, serverId);
            }}
          >
            <div
              className={styles['avatarPicture']}
              style={{ backgroundImage: `url(${serverAvatarUrl})` }}
            />
          </div>
          <div className={styles['baseInfoBox']}>
            <div className={styles['container']}>
              <div className={styles['verifyIcon']}></div>
              <div className={styles['name']}>{serverName} </div>
            </div>
            <div className={styles['container']}>
              <div className={styles['idText']}>{serverDisplayId}</div>
              <div className={styles['memberText']}>{serverMembers.length}</div>
            </div>
          </div>
          <div className={styles['optionBox']}>
            <div
              className={styles['invitation']}
              onClick={() => {
                // Handle invite friends
              }}
            />
            <div className={styles['saperator']} />
            <div
              className={styles['setting']}
              onClick={(e) => {
                contextMenu.showContextMenu(
                  e.clientX,
                  e.clientY,
                  [
                    {
                      id: 'invitation',
                      label: lang.tr.invitation,
                      show: canApplyMember,
                      icon: 'memberapply',
                      onClick: () => handleOpenApplyMember(userId, serverId),
                    },
                    // {
                    //   id: 'memberChat',
                    //   label: '會員群聊',
                    //   show: memberPermissionLevel > 2,
                    //   onClick: () => {},
                    // },
                    // {
                    //   id: 'admin',
                    //   label: '查看管理員',
                    //   onClick: () => {},
                    // },
                    // {
                    //   id: 'separator',
                    //   label: '',
                    //   show: canEditNickname,
                    // },
                    {
                      id: 'editNickname',
                      label: lang.tr.editNickname,
                      icon: 'editGroupcard',
                      show: canEditNickname,
                      onClick: () => handleOpenEditNickname(userId, serverId),
                    },
                    {
                      id: 'locateMe',
                      label: lang.tr.locateMe,
                      icon: 'locateme',
                      onClick: () => handleLocateUser(),
                    },
                    // {
                    //   id: 'separator',
                    //   label: '',
                    // },
                    // {
                    //   id: 'report',
                    //   label: '舉報',
                    //   onClick: () => {},
                    // },
                    // {
                    //   id: 'favorite',
                    //   label: isFavorite ? lang.tr.unfavorite : lang.tr.favorite,
                    //   icon: isFavorite ? 'collect' : 'uncollect',
                    //   onClick: () => handleAddFavoriteServer(serverId),
                    // },
                  ],
                  e.currentTarget as HTMLElement,
                );
              }}
            />
          </div>
        </div>

        {/* Current Channel */}
        <div className={styles['currentChannelBox']}>
          <div
            className={`
              ${styles['currentChannelIcon']} 
              ${styles[`status${connectStatus}`]}
            `}
          >
            <div
              className={`${styles['currentChannelPing']}`}
            >{`${latency}ms`}</div>
          </div>
          <div className={styles['currentChannelText']}>
            {currentChannelName}
          </div>
        </div>

        {/* Mic Queue */}
        {currentChannelVoiceMode === 'queue' && (
          <>
            <div className={styles['sectionTitle']}>{lang.tr.micOrder}</div>
            <div className={styles['micQueueBox']}>
              <div className={styles['userList']}>
                {/* {micQueueUsers.map((user) => (
                    <UserTab
                      key={user.id}
                      user={user}
                      server={server}
                      mainUser={user}
                    />
                  ))} */}
              </div>
            </div>
            <div className={styles['saperator-2']} />
          </>
        )}

        {/* Channel List Title */}
        <div className={styles['sectionTitle']}>
          {view === 'current' ? lang.tr.currentChannel : lang.tr.allChannel}
        </div>

        {/* Channel List */}
        <div className={styles['scrollView']}>
          <div className={styles['channelList']}>
            {view === 'current' ? (
              <ChannelTab
                key={currentChannelId}
                member={member}
                channel={currentChannel}
                currentChannel={currentChannel}
                userFriends={userFriends}
                serverMembers={serverMembers}
                expanded={{ [currentChannelId]: true }}
                setExpanded={() => {}}
              />
            ) : (
              serverChannels
                .filter((c) => !c.categoryId)
                .sort((a, b) =>
                  a.order !== b.order
                    ? a.order - b.order
                    : a.createdAt - b.createdAt,
                )
                .map((item) =>
                  item.type === 'category' ? (
                    <CategoryTab
                      key={item.channelId}
                      member={member}
                      category={item}
                      currentChannel={currentChannel}
                      userFriends={userFriends}
                      serverMembers={serverMembers}
                      serverChannels={serverChannels}
                      expanded={expanded}
                      setExpanded={setExpanded}
                    />
                  ) : (
                    <ChannelTab
                      key={item.channelId}
                      member={member}
                      channel={item}
                      currentChannel={currentChannel}
                      userFriends={userFriends}
                      serverMembers={serverMembers}
                      expanded={expanded}
                      setExpanded={setExpanded}
                    />
                  ),
                )
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className={styles['bottomNav']}>
          <div
            className={`
              ${styles['navItem']} 
              ${view === 'current' ? styles['active'] : ''}
            `}
            onClick={() => setView('current')}
          >
            {lang.tr.currentChannel}
          </div>
          <div
            className={`
              ${styles['navItem']} 
              ${view === 'all' ? styles['active'] : ''}
            `}
            onClick={() => setView('all')}
          >
            {lang.tr.allChannel}
          </div>
        </div>
      </>
    );
  },
);

ChannelListViewer.displayName = 'ChannelListViewer';

export default ChannelListViewer;
