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
  UserServer,
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
  category: Category;
  currentChannel: Channel;
  currentServer: UserServer;
  userFriends: UserFriend[];
  serverMembers: ServerMember[];
  serverChannels: (Channel | Category)[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const CategoryTab: React.FC<CategoryTabProps> = React.memo(
  ({
    category,
    currentChannel,
    currentServer,
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
    const { permissionLevel, userId, serverId } = currentServer;
    const { channelId: currentChannelId } = currentChannel;
    const categoryChannels = serverChannels
      .filter((ch) => ch.type === 'channel')
      .filter((ch) => ch.categoryId === categoryId);
    const userInCategory = categoryChannels.some(
      (ch) => ch.channelId === currentChannelId,
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
      ipcService.popup.open(PopupType.DIALOG_WARNING, 'warningDialog');
      ipcService.initialData.onRequest('warningDialog', {
        title: message,
        submitTo: 'warningDialog',
      });
      ipcService.popup.onSubmit('warningDialog', callback);
    };

    const handleOpenChannelSetting = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_SETTING, 'channelSetting');
      ipcService.initialData.onRequest('channelSetting', {
        channelId,
        serverId,
      });
    };

    const handleOpenCreateChannel = (
      serverId: Server['serverId'],
      categoryId: Category['categoryId'],
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.CREATE_CHANNEL, 'createChannel');
      ipcService.initialData.onRequest('createChannel', {
        serverId,
        categoryId,
        userId,
      });
    };

    const handleOpenChangeChannelOrder = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_CHANNEL_ORDER, 'editChannelOrder');
      ipcService.initialData.onRequest('editChannelOrder', {
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
                currentServer={currentServer}
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
  channel: Channel;
  currentChannel: Channel;
  currentServer: UserServer;
  userFriends: UserFriend[];
  serverMembers: ServerMember[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const ChannelTab: React.FC<ChannelTabProps> = React.memo(
  ({
    channel,
    currentChannel,
    currentServer,
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
    const { userId, serverId, permissionLevel } = currentServer;
    const { channelId: currentChannelId } = currentChannel;
    const channelMembers = serverMembers.filter(
      (mb) => mb.currentChannelId === channelId,
    );
    const userInChannel = currentChannelId === channelId;
    const canJoin =
      !userInChannel &&
      (channelVisibility === 'public' ||
        (channelVisibility === 'private' && permissionLevel > 2) ||
        (channelVisibility === 'member' && permissionLevel > 1)) &&
      (!channelUserLimit ||
        channelUserLimit > channelMembers.length ||
        permissionLevel > 4);
    const canUsePassword =
      !userInChannel &&
      channelVisibility === 'private' &&
      permissionLevel < 3 &&
      channel.password;
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
      ipcService.popup.open(PopupType.DIALOG_WARNING, 'warningDialog');
      ipcService.initialData.onRequest('warningDialog', {
        title: message,
        submitTo: 'warningDialog',
      });
      ipcService.popup.onSubmit('warningDialog', callback);
    };

    const handleOpenChannelSetting = (
      channelId: Channel['channelId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_SETTING, 'channelSetting');
      ipcService.initialData.onRequest('channelSetting', {
        channelId,
        serverId,
      });
    };

    const handleOpenCreateChannel = (
      serverId: Server['serverId'],
      channelId: Channel['channelId'] | null,
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.CREATE_CHANNEL, 'createChannel');
      ipcService.initialData.onRequest('createChannel', {
        serverId,
        channelId,
        userId,
      });
    };

    const handleOpenEditChannelOrder = (
      serverId: Server['serverId'],
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_CHANNEL_ORDER, 'editChannelOrder');
      ipcService.initialData.onRequest('editChannelOrder', {
        serverId,
        userId,
      });
    };

    const handleOpenChannelPassword = (
      userId: User['userId'],
      serverId: Server['serverId'],
      channelId: Channel['channelId'],
    ) => {
      ipcService.popup.open(PopupType.CHANNEL_PASSWORD, 'channelPassword');
      ipcService.initialData.onRequest('channelPassword', {
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
            if (canJoin) {
              handleJoinChannel(userId, serverId, channelId);
            } else if (canUsePassword) {
              handleOpenChannelPassword(userId, serverId, channelId);
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
            .map((member) => (
              <UserTab
                key={member.userId}
                member={member}
                currentChannel={currentChannel}
                currentServer={currentServer}
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
  member: ServerMember;
  currentChannel: Channel;
  currentServer: UserServer;
  userFriends: UserFriend[];
}

const UserTab: React.FC<UserTabProps> = React.memo(
  ({ member, currentChannel, currentServer, userFriends }) => {
    // Hooks
    const lang = useLanguage();
    const contextMenu = useContextMenu();
    const socket = useSocket();
    const webRTC = useWebRTC();

    // Variables
    const {
      name: memberName,
      permissionLevel: memberPermission,
      nickname: memberNickname,
      level: memberLevel,
      gender: memberGender,
      badges: memberBadges,
      vip: memberVip,
      userId: memberUserId,
      currentChannelId: memberCurrentChannelId,
      currentServerId: memberCurrentServerId,
    } = member;
    const {
      userId,
      serverId,
      permissionLevel: userPermissionLevel,
    } = currentServer;
    const { channelId: currentChannelId } = currentChannel;
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
    const canApplyFriend = !isFriend && !isCurrentUser;
    const canManageMember =
      !isCurrentUser &&
      userPermissionLevel > 4 &&
      userPermissionLevel > memberPermission;
    const canEditNickname =
      canManageMember || (isCurrentUser && userPermissionLevel > 1);
    const canChangeToGuest =
      canManageMember && userPermissionLevel > 5 && memberPermission !== 1;
    const canChangeToMember =
      canManageMember && userPermissionLevel > 5 && memberPermission !== 2;
    const canChangeToChannelAdmin =
      canManageMember && memberPermission !== 3 && memberPermission > 1;
    const canChangeToCategoryAdmin =
      canManageMember && memberPermission !== 4 && memberPermission > 1;
    const canChangeToAdmin =
      canManageMember && memberPermission !== 5 && memberPermission > 1;
    const canKick = canManageMember && memberCurrentServerId === serverId;
    const canMoveToChannel =
      canManageMember && memberCurrentChannelId !== currentChannelId;
    const canMute = !isCurrentUser && !isMutedByUser;
    const canUnmute = !isCurrentUser && isMutedByUser;

    // Handlers
    const handleMuteUser = (userId: User['userId']) => {
      if (!webRTC) return;
      webRTC.handleMute(userId);
    };

    const handleUnmuteUser = (userId: User['userId']) => {
      if (!webRTC) return;
      webRTC.handleUnmute(userId);
    };

    const handleKickServer = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.disconnectServer({ userId, serverId });
    };

    const handleMoveToChannel = (
      userId: User['userId'],
      serverId: Server['serverId'],
      channelId: Channel['channelId'],
    ) => {
      if (!socket) return;
      socket.send.connectChannel({ userId, serverId, channelId });
    };

    const handleOpenEditNickname = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_NICKNAME, 'editNickname');
      ipcService.initialData.onRequest('editNickname', {
        serverId,
        userId,
      });
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

    const handleOpenDirectMessage = (
      userId: User['userId'],
      targetId: User['userId'],
      targetName: User['name'],
    ) => {
      ipcService.popup.open(
        PopupType.DIRECT_MESSAGE,
        `directMessage-${targetId}`,
      );
      ipcService.initialData.onRequest(`directMessage-${targetId}`, {
        userId,
        targetId,
        targetName,
      });
    };

    const handleOpenUserInfo = (
      userId: User['userId'],
      targetId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.USER_INFO, `userInfo-${targetId}`);
      ipcService.initialData.onRequest(`userInfo-${targetId}`, {
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
                show: canApplyFriend,
                onClick: () => handleOpenApplyFriend(userId, memberUserId),
              },
              {
                id: 'mute',
                label: lang.tr.mute,
                show: canMute,
                onClick: () => handleMuteUser(memberUserId),
              },
              {
                id: 'unmute',
                label: lang.tr.unmute,
                show: canUnmute,
                onClick: () => handleUnmuteUser(memberUserId),
              },
              {
                id: 'edit-nickname',
                label: lang.tr.editNickname,
                show: canEditNickname,
                onClick: () => handleOpenEditNickname(memberUserId, serverId),
              },
              {
                id: 'separator',
                label: '',
                show: canMoveToChannel,
              },
              {
                id: 'move-to-channel',
                label: lang.tr.moveToChannel,
                show: canMoveToChannel,
                onClick: () =>
                  handleMoveToChannel(memberUserId, serverId, currentChannelId),
              },
              {
                id: 'separator',
                label: '',
                show: canManageMember,
              },
              {
                id: 'forbid-voice',
                label: lang.tr.forbidVoice,
                show: canManageMember,
                onClick: () => {},
              },
              {
                id: 'forbid-text',
                label: lang.tr.forbidText,
                show: canManageMember,
                onClick: () => {},
              },
              {
                id: 'kick-channel',
                label: lang.tr.kickChannel,
                show: canKick,
                onClick: () => {}, // handleKickChannel(memberUserId, serverId),
              },
              {
                id: 'kick-server',
                label: lang.tr.kickServer,
                show: canKick,
                onClick: () => handleKickServer(memberUserId, serverId),
              },
              {
                id: 'ban',
                label: lang.tr.ban,
                show: canManageMember,
                onClick: () => {},
              },
              {
                id: 'separator',
                label: '',
                show: canManageMember,
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
                        serverId,
                      ),
                  },
                  {
                    id: 'set-member',
                    label: lang.tr.setMember,
                    show: canChangeToMember,
                    onClick: () =>
                      handleUpdateMember(
                        { permissionLevel: 2 },
                        memberUserId,
                        serverId,
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
                        serverId,
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
                        serverId,
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
                        serverId,
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
  currentServer: UserServer;
  currentChannel: Channel;
  serverMembers: ServerMember[];
  serverChannels: (Channel | Category)[];
}

const ChannelListViewer: React.FC<ChannelListViewerProps> = React.memo(
  ({ currentServer, currentChannel, serverMembers, serverChannels }) => {
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
      userId,
      serverId,
      name: serverName,
      avatarUrl: serverAvatarUrl,
      displayId: serverDisplayId,
      receiveApply: serverReceiveApply,
      permissionLevel: userPermissionLevel,
    } = currentServer;
    const {
      channelId: currentChannelId,
      name: currentChannelName,
      voiceMode: currentChannelVoiceMode,
    } = currentChannel;
    const canEditNickname = userPermissionLevel > 1;
    const canApplyMember = userPermissionLevel < 2;
    const canOpenSettings = userPermissionLevel > 4;

    // Handlers
    const handleOpenAlert = (message: string) => {
      ipcService.popup.open(PopupType.DIALOG_ALERT, 'alertDialog');
      ipcService.initialData.onRequest('alertDialog', {
        title: message,
      });
    };

    const handleOpenServerSetting = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.SERVER_SETTING, 'serverSetting');
      ipcService.initialData.onRequest('serverSetting', {
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
      ipcService.popup.open(PopupType.APPLY_MEMBER, 'applyMember');
      ipcService.initialData.onRequest('applyMember', {
        userId,
        serverId,
      });
    };

    const handleOpenEditNickname = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_NICKNAME, 'editNickname');
      ipcService.initialData.onRequest('editNickname', {
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
                channel={currentChannel}
                currentChannel={currentChannel}
                currentServer={currentServer}
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
                      category={item}
                      currentChannel={currentChannel}
                      currentServer={currentServer}
                      userFriends={userFriends}
                      serverMembers={serverMembers}
                      serverChannels={serverChannels}
                      expanded={expanded}
                      setExpanded={setExpanded}
                    />
                  ) : (
                    <ChannelTab
                      key={item.channelId}
                      channel={item}
                      currentChannel={currentChannel}
                      currentServer={currentServer}
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
