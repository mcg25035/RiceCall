import React, { useRef, useEffect, useState } from 'react';

// CSS
import styles from '@/styles/pages/friend.module.css';
import grade from '@/styles/grade.module.css';
import vip from '@/styles/vip.module.css';

// Types
import { PopupType, User, FriendGroup, UserFriend, Server } from '@/types';

// Components
import BadgeListViewer from '@/components/viewers/BadgeList';

// Providers
import { useContextMenu } from '@/providers/ContextMenu';
import { useLanguage } from '@/providers/Language';
import { useSocket } from '@/providers/Socket';

// Services
import ipcService from '@/services/ipc.service';
import refreshService from '@/services/refresh.service';

// Utils
import { createDefault } from '@/utils/createDefault';

interface FriendGroupTabProps {
  user: User;
  friendGroup: FriendGroup;
  friends: UserFriend[];
}

const FriendGroupTab: React.FC<FriendGroupTabProps> = React.memo(
  ({ user, friendGroup, friends }) => {
    // Hooks
    const lang = useLanguage();
    const contextMenu = useContextMenu();

    // States
    const [expanded, setExpanded] = useState<boolean>(true);

    // Socket
    const socket = useSocket();

    // Variables
    const { userId } = user;
    const { friendGroupId, name: friendGroupName } = friendGroup;
    const friendGroupFriends =
      friendGroupId === ''
        ? friends
        : friends.filter((fd) => fd.friendGroupId === friendGroupId);
    const friendsInServer = friendGroupFriends.filter(
      (fd) => fd.currentServerId,
    ).length;
    const canManageFriendGroup = friendGroupId !== '';

    // Handlers
    const handleDeleteFriendGroup = (
      friendGroupId: FriendGroup['friendGroupId'],
      userId: User['userId'],
    ) => {
      if (!socket) return;
      handleOpenWarning(
        lang.tr.deleteFriendGroupDialog.replace('{0}', friendGroupName),
        () => socket.send.deleteFriendGroup({ friendGroupId, userId }),
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

    const handleOpenEditFriendGroup = (
      friendGroupId: FriendGroup['friendGroupId'],
      userId: User['userId'],
    ) => {
      ipcService.popup.open(PopupType.EDIT_FRIENDGROUP, 'editFriendGroup');
      ipcService.initialData.onRequest('editFriendGroup', {
        friendGroupId,
        userId,
      });
    };

    return (
      <div key={friendGroupId}>
        {/* Tab View */}
        <div
          className={styles['tab']}
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => {
            contextMenu.showContextMenu(e.clientX, e.clientY, [
              {
                id: 'edit',
                label: lang.tr.editFriendGroup,
                show: canManageFriendGroup,
                onClick: () => handleOpenEditFriendGroup(friendGroupId, userId),
              },
              {
                id: 'delete',
                label: lang.tr.friendDeleteGroup,
                show: canManageFriendGroup,
                onClick: () => handleDeleteFriendGroup(friendGroupId, userId),
              },
            ]);
          }}
        >
          <div
            className={`${styles['toggleIcon']} ${
              expanded ? styles['expanded'] : ''
            }`}
          />
          <div className={styles['tabLable']}>{friendGroupName}</div>
          <div className={styles['tabCount']}>
            {`(${friendsInServer}/${friendGroupFriends.length})`}
          </div>
        </div>

        {/* Expanded Sections */}
        <div
          className={styles['tabContent']}
          style={{
            display: expanded ? 'block' : 'none',
          }}
        >
          {friendGroupFriends.map((friend) => (
            <FriendCard key={friend.targetId} friend={friend} />
          ))}
        </div>
      </div>
    );
  },
);

FriendGroupTab.displayName = 'FriendGroupTab';

interface FriendCardProps {
  friend: UserFriend;
}

const FriendCard: React.FC<FriendCardProps> = React.memo(({ friend }) => {
  // Hooks
  const lang = useLanguage();
  const contextMenu = useContextMenu();

  // Socket
  const socket = useSocket();

  // Refs
  const refreshed = useRef(false);

  // States
  const [friendServerName, setFriendServerName] = useState<Server['name']>(
    createDefault.server().name,
  );

  // Variables
  const {
    userId: friendUserId,
    targetId: friendTargetId,
    name: friendName,
    avatarUrl: friendAvatarUrl,
    signature: friendSignature,
    vip: friendVip,
    level: friendLevel,
    badges: friendBadges,
    currentServerId: friendCurrentServerId,
  } = friend;
  const isCurrentUser = friendTargetId === friendUserId;
  const canManageFriend = !isCurrentUser;

  // Handlers

  const handleDeleteFriend = (
    userId: User['userId'],
    targetId: User['userId'],
  ) => {
    if (!socket) return;
    handleOpenWarning(
      lang.tr.deleteFriendDialog.replace('{0}', friendName),
      () => socket.send.deleteFriend({ userId, targetId }),
    );
  };

  const handleServerUpdate = (data: Server) => {
    setFriendServerName(data.name);
  };

  const handleOpenWarning = (message: string, callback: () => void) => {
    ipcService.popup.open(PopupType.DIALOG_WARNING, 'warningDialog');
    ipcService.initialData.onRequest('warningDialog', {
      title: message,
      submitTo: 'warningDialog',
    });
    ipcService.popup.onSubmit('warningDialog', callback);
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

  const handleOpenEditFriend = (
    userId: User['userId'],
    targetId: User['userId'],
  ) => {
    ipcService.popup.open(PopupType.EDIT_FRIEND, 'editFriend');
    ipcService.initialData.onRequest('editFriend', {
      userId,
      targetId,
    });
  };

  useEffect(() => {
    if (!friendCurrentServerId || refreshed.current) return;
    const refresh = async () => {
      refreshed.current = true;
      Promise.all([
        refreshService.server({
          serverId: friendCurrentServerId,
        }),
      ]).then(([server]) => {
        if (server) handleServerUpdate(server);
      });
    };
    refresh();
  }, [friendCurrentServerId]);

  return (
    <div key={friendTargetId}>
      {/* User View */}
      <div
        className={styles['friendCard']}
        onContextMenu={(e) => {
          contextMenu.showContextMenu(e.clientX, e.clientY, [
            {
              id: 'info',
              label: lang.tr.viewProfile,
              show: !isCurrentUser,
              onClick: () => handleOpenUserInfo(friendUserId, friendTargetId),
            },
            {
              id: 'edit',
              label: lang.tr.editFriendGroup,
              show: canManageFriend,
              onClick: () => handleOpenEditFriend(friendUserId, friendTargetId),
            },
            {
              id: 'delete',
              label: lang.tr.deleteFriend,
              show: canManageFriend,
              onClick: () => handleDeleteFriend(friendUserId, friendTargetId),
            },
          ]);
        }}
        onDoubleClick={() =>
          handleOpenDirectMessage(friendUserId, friendTargetId, friendName)
        }
      >
        <div
          className={styles['avatarPicture']}
          style={{
            backgroundImage: `url(${friendAvatarUrl})`,
            filter: !friendServerName ? 'grayscale(100%)' : '',
          }}
        />
        <div className={styles['baseInfoBox']}>
          <div className={styles['container']}>
            {friendVip > 0 && (
              <div
                className={`${vip['vipIcon']} ${vip[`vip-small-${friendVip}`]}`}
              />
            )}
            <div className={styles['name']}>{friendName}</div>
            <div
              className={`
                ${grade['grade']} 
                ${grade[`lv-${Math.min(56, friendLevel)}`]}
              `}
            />
            <BadgeListViewer badges={friendBadges} maxDisplay={5} />
          </div>
          {friendServerName ? (
            <div className={styles['container']}>
              <div className={styles['location']} />
              <div className={styles['serverName']}>{friendServerName}</div>
            </div>
          ) : (
            <div className={styles['signature']}>{friendSignature}</div>
          )}
        </div>
      </div>
    </div>
  );
});

FriendCard.displayName = 'FriendCard';

interface FriendListViewerProps {
  user: User;
  friendGroups: FriendGroup[];
  friends: UserFriend[];
}

const FriendListViewer: React.FC<FriendListViewerProps> = React.memo(
  ({ user, friendGroups, friends }) => {
    // Hooks
    const lang = useLanguage();

    // States
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedTabId, setSelectedTabId] = useState<number>(0);

    // Variables
    const { userId } = user;
    friends.sort((a, b) => {
      if (a.currentServerId && !b.currentServerId) return -1;
      if (!a.currentServerId && b.currentServerId) return 1;
      return 0;
    });
    const filteredFriends = friends.filter((fd) =>
      fd.name.includes(searchQuery),
    );
    const defaultFriendGroup: FriendGroup = createDefault.friendGroup({
      name: `${lang.tr.myFriends}`,
      order: 0,
      userId,
    });

    // Handlers
    const handleOpenSearchUser = (userId: User['userId']) => {
      ipcService.popup.open(PopupType.SEARCH_USER, 'searchUser');
      ipcService.initialData.onRequest('searchUser', {
        userId,
      });
    };

    const handleOpenCreateFriendGroup = () => {
      ipcService.popup.open(PopupType.CREATE_FRIENDGROUP, 'createFriendGroup');
      ipcService.initialData.onRequest('createFriendGroup', {
        userId,
      });
    };

    return (
      <>
        {/* Navigation Tabs */}
        <div className={styles['navigateTabs']}>
          <div
            className={`${styles['tab']} ${
              selectedTabId == 0 ? styles['selected'] : ''
            }`}
            onClick={() => setSelectedTabId(0)}
          >
            <div className={styles['friendListIcon']} />
          </div>
          <div
            className={`${styles['tab']} ${
              selectedTabId == 1 ? styles['selected'] : ''
            }`}
            onClick={() => setSelectedTabId(1)}
          >
            <div className={styles['recentIcon']} />
          </div>
        </div>

        {/* Search Bar */}
        <div className={styles['searchBar']}>
          <div className={styles['searchIcon']} />
          <input
            name="query"
            type="text"
            className={styles['searchInput']}
            placeholder={lang.tr.searchFriend}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className={styles['prevIcon']} />
          <div className={styles['nextIcon']} />
        </div>

        {/* Friend List */}
        {selectedTabId == 0 && (
          <div className={styles['scrollView']}>
            {/* Friend Groups */}
            <div className={styles['friendList']}>
              {[defaultFriendGroup, ...friendGroups]
                .sort((a, b) =>
                  a.order !== b.order
                    ? a.order - b.order
                    : a.createdAt - b.createdAt,
                )
                .map((friendGroup) => (
                  <FriendGroupTab
                    key={friendGroup.friendGroupId}
                    friendGroup={friendGroup}
                    friends={filteredFriends}
                    user={user}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Recent */}
        {selectedTabId == 1 && <div className={styles['recentList']}></div>}

        {/* Bottom Buttons */}
        <div className={styles['sidebarFooter']}>
          <div
            className={styles['button']}
            datatype="addGroup"
            onClick={() => handleOpenCreateFriendGroup()}
          >
            {lang.tr.friendAddGroup}
          </div>
          <div
            className={styles['button']}
            datatype="addFriend"
            onClick={() => handleOpenSearchUser(userId)}
          >
            {lang.tr.addFriend}
          </div>
        </div>
      </>
    );
  },
);

FriendListViewer.displayName = 'FriendListViewer';

export default FriendListViewer;
