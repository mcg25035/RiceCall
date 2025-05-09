import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// CSS
import setting from '@/styles/popups/setting.module.css';
import popup from '@/styles/popup.module.css';
import permission from '@/styles/permission.module.css';
import markdown from '@/styles/viewers/markdown.module.css';

// Types
import {
  MemberApplication,
  Server,
  PopupType,
  ServerMember,
  Member,
  User,
  SocketServerEvent,
} from '@/types';

// Providers
import { useSocket } from '@/providers/Socket';
import { useContextMenu } from '@/providers/ContextMenu';
import { useLanguage } from '@/providers/Language';

// Services
import ipcService from '@/services/ipc.service';
import apiService from '@/services/api.service';
import refreshService from '@/services/refresh.service';

// Utils
import { createDefault } from '@/utils/createDefault';
import { createSorter } from '@/utils/createSorter';

// Components
import MarkdownViewer from '@/components/viewers/Markdown';

interface ServerSettingPopupProps {
  serverId: Server['serverId'];
  userId: User['userId'];
}

const ServerSettingPopup: React.FC<ServerSettingPopupProps> = React.memo(
  (initialData: ServerSettingPopupProps) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();
    const contextMenu = useContextMenu();

    // Constants
    const MEMBER_FIELDS = [
      {
        name: lang.tr.name,
        field: 'name',
      },
      {
        name: lang.tr.permission,
        field: 'permissionLevel',
      },
      {
        name: lang.tr.contribution,
        field: 'contribution',
      },
      {
        name: lang.tr.joinDate,
        field: 'createdAt',
      },
    ];
    const APPLICATION_FIELDS = [
      {
        name: lang.tr.name,
        field: 'name',
      },
      {
        name: lang.tr.description,
        field: 'description',
      },
      {
        name: lang.tr.creationTime,
        field: 'createdAt',
      },
    ];
    const BLOCK_MEMBER_FIELDS = [
      {
        name: lang.tr.name,
        field: 'name',
      },
    ];

    // Refs
    const refreshRef = useRef(false);

    // States
    const [server, setServer] = useState<Server>(createDefault.server());
    const [member, setMember] = useState<Member>(createDefault.member());
    const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
    const [serverApplications, setServerApplications] = useState<
      MemberApplication[]
    >([]);
    const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
    const [sortState, setSortState] = useState<1 | -1>(-1);
    const [sortField, setSortField] = useState<string>('permissionLevel');
    const [searchText, setSearchText] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    // Variables
    const { serverId, userId } = initialData;
    const {
      name: serverName,
      avatar: serverAvatar,
      avatarUrl: serverAvatarUrl,
      announcement: serverAnnouncement,
      description: serverDescription,
      type: serverType,
      displayId: serverDisplayId,
      slogan: serverSlogan,
      level: serverLevel,
      wealth: serverWealth,
      createdAt: serverCreatedAt,
      visibility: serverVisibility,
    } = server;
    const { permissionLevel: userPermission } = member;
    const filteredMembers = serverMembers.filter((member) => {
      const searchLower = searchText.toLowerCase();
      return (
        member.permissionLevel > 1 &&
        (member.nickname?.toLowerCase().includes(searchLower) ||
          member.name.toLowerCase().includes(searchLower))
      );
    });
    const filteredBlockMembers = serverMembers.filter((member) => {
      const searchLower = searchText.toLowerCase();
      return (
        member.isBlocked &&
        (member.nickname?.toLowerCase().includes(searchLower) ||
          member.name.toLowerCase().includes(searchLower))
      );
    });
    const filteredApplications = serverApplications.filter((application) => {
      const searchLower = searchText.toLowerCase();
      return (
        application.name.toLowerCase().includes(searchLower) ||
        application.description.toLowerCase().includes(searchLower)
      );
    });

    // Handlers
    const handleServerMemberAdd = (member: ServerMember): void => {
      setServerMembers((prev) => [...prev, member]);
    };

    const handleServerMemberUpdate = (
      userId: ServerMember['userId'],
      serverId: ServerMember['serverId'],
      member: Partial<ServerMember>,
    ): void => {
      setServerMembers((prev) =>
        prev.map((item) =>
          item.userId === userId && item.serverId === serverId
            ? { ...item, ...member }
            : item,
        ),
      );
    };

    const handleServerMemberDelete = (
      userId: ServerMember['userId'],
      serverId: ServerMember['serverId'],
    ): void => {
      setServerMembers((prev) =>
        prev.filter(
          (item) => !(item.userId === userId && item.serverId === serverId),
        ),
      );
    };

    const handleServerMemberApplicationAdd = (
      application: MemberApplication,
    ) => {
      setServerApplications((prev) => [...prev, application]);
    };

    const handleServerMemberApplicationUpdate = (
      userId: User['userId'],
      serverId: Server['serverId'],
      application: Partial<MemberApplication>,
    ) => {
      setServerApplications((prev) =>
        prev.map((item) =>
          item.serverId === serverId && item.userId === userId
            ? { ...item, ...application }
            : item,
        ),
      );
    };

    const handleServerMemberApplicationDelete = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      setServerApplications((prev) =>
        prev.filter(
          (item) => !(item.userId === userId && item.serverId === serverId),
        ),
      );
    };

    const handleSort = <T extends ServerMember | MemberApplication>(
      field: keyof T,
      array: T[],
    ) => {
      const newDirection =
        sortField === String(field) ? (sortState === 1 ? -1 : 1) : -1;
      setSortField(String(field));
      setSortState(newDirection);
      return [...array].sort(createSorter(field, newDirection));
    };

    const handleUpdateServer = (
      server: Partial<Server>,
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.updateServer({ server, serverId });
    };

    const handleDeleteMemberApplication = (
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.deleteMemberApplication({ userId, serverId });
    };

    const handleCreateMember = (
      member: Partial<Member>,
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.createMember({ member, userId, serverId });
    };

    const handleUpdateMember = (
      member: Partial<Member>,
      userId: User['userId'],
      serverId: Server['serverId'],
    ) => {
      if (!socket) return;
      socket.send.updateMember({ member, userId, serverId });
    };

    const handleOpenMemberApplySetting = () => {
      ipcService.popup.open(
        PopupType.MEMBERAPPLY_SETTING,
        'memberApplySetting',
      );
      ipcService.initialData.onRequest('memberApplySetting', {
        serverId,
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

    const handleOpenErrorDialog = (message: string) => {
      ipcService.popup.open(PopupType.DIALOG_ERROR, 'errorDialog');
      ipcService.initialData.onRequest('errorDialog', {
        title: message,
        submitTo: 'errorDialog',
      });
    };

    const handleMemberSort = (field: keyof ServerMember) => {
      const sortedMembers = handleSort(field, [...serverMembers]);
      setServerMembers(sortedMembers);
    };

    const handleApplicationSort = (field: keyof MemberApplication) => {
      const sortedApplications = handleSort(field, [...serverApplications]);
      setServerApplications(sortedApplications);
    };

    const handleClose = () => {
      ipcService.window.close();
    };

    // Effects
    useEffect(() => {
      if (!socket) return;

      const eventHandlers = {
        [SocketServerEvent.SERVER_MEMBER_ADD]: handleServerMemberAdd,
        [SocketServerEvent.SERVER_MEMBER_UPDATE]: handleServerMemberUpdate,
        [SocketServerEvent.SERVER_MEMBER_DELETE]: handleServerMemberDelete,
        [SocketServerEvent.SERVER_MEMBER_APPLICATION_ADD]:
          handleServerMemberApplicationAdd,
        [SocketServerEvent.SERVER_MEMBER_APPLICATION_UPDATE]:
          handleServerMemberApplicationUpdate,
        [SocketServerEvent.SERVER_MEMBER_APPLICATION_DELETE]:
          handleServerMemberApplicationDelete,
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
      if (!serverId || refreshRef.current) return;
      const refresh = async () => {
        refreshRef.current = true;
        Promise.all([
          refreshService.server({
            serverId: serverId,
          }),
          refreshService.member({
            serverId: serverId,
            userId: userId,
          }),
          refreshService.serverMembers({
            serverId: serverId,
          }),
          refreshService.serverMemberApplications({
            serverId: serverId,
          }),
        ]).then(([server, member, members, applications]) => {
          if (server) {
            setServer(server);
          }
          if (member) {
            setMember(member);
          }
          if (members) {
            setServerMembers(members);
          }
          if (applications) {
            setServerApplications(applications);
          }
        });
      };
      refresh();
    }, [serverId, userId]);

    return (
      <div className={popup['popupContainer']}>
        <div className={popup['popupBody']}>
          {/* Left Sidebar */}
          <div className={setting['left']}>
            <div className={setting['tabs']}>
              {[
                lang.tr.viewServerInfo,
                lang.tr.announcement,
                lang.tr.memberManagement,
                lang.tr.accessPermission,
                `${lang.tr.memberApplicationManagement} (${serverApplications.length})`,
                lang.tr.blacklistManagement,
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
              <div className={popup['col']}>
                <div className={popup['row']}>
                  <div className={popup['col']}>
                    <div className={popup['row']}>
                      <div className={`${popup['inputBox']} ${popup['col']}`}>
                        <div className={popup['label']}>{lang.tr.name}</div>
                        <input
                          type="text"
                          value={serverName}
                          onChange={(e) => {
                            setServer((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }));
                          }}
                        />
                      </div>
                      <div className={`${popup['inputBox']} ${popup['col']}`}>
                        <div className={popup['label']}>{lang.tr.id}</div>
                        <input type="text" value={serverDisplayId} disabled />
                      </div>
                    </div>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>{lang.tr.slogan}</div>
                      <input
                        type="text"
                        value={serverSlogan}
                        onChange={(e) => {
                          setServer((prev) => ({
                            ...prev,
                            slogan: e.target.value,
                          }));
                        }}
                      />
                    </div>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>{lang.tr.type}</div>
                      <div className={popup['selectBox']}>
                        <select
                          value={serverType}
                          onChange={(e) => {
                            setServer((prev) => ({
                              ...prev,
                              type: e.target.value as Server['type'],
                            }));
                          }}
                        >
                          <option value="other">{lang.tr.other}</option>
                          <option value="game">{lang.tr.game}</option>
                          <option value="entertainment">
                            {lang.tr.entertainment}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className={setting['avatarWrapper']}>
                    <div
                      className={setting['avatarPicture']}
                      style={{
                        backgroundImage: `url(${serverAvatarUrl})`,
                      }}
                    />
                    <input
                      type="file"
                      id="avatar-upload"
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          handleOpenErrorDialog(lang.tr.canNotReadImage);
                          return;
                        }
                        if (file.size > 5 * 1024 * 1024) {
                          handleOpenErrorDialog(lang.tr.imageTooLarge);
                          return;
                        }

                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const formData = new FormData();
                          formData.append('_type', 'server');
                          formData.append('_fileName', serverAvatar);
                          formData.append('_file', reader.result as string);
                          const data = await apiService.post(
                            '/upload',
                            formData,
                          );
                          if (data) {
                            setServer((prev) => ({
                              ...prev,
                              avatar: data.avatar,
                              avatarUrl: data.avatarUrl,
                            }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label
                      htmlFor="avatar-upload"
                      className={popup['button']}
                      style={{ marginTop: '10px' }}
                    >
                      {lang.tr.changeImage}
                    </label>
                  </div>
                </div>
                <div className={popup['col']}>
                  <div className={popup['row']}>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>{lang.tr.level}</div>
                      <input type="text" value={serverLevel} disabled />
                    </div>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div className={popup['label']}>
                        {lang.tr.creationTime}
                      </div>
                      <input
                        type="text"
                        value={new Date(serverCreatedAt).toLocaleString()}
                        disabled
                      />
                    </div>
                    <div className={`${popup['inputBox']} ${popup['col']}`}>
                      <div
                        className={`${popup['label']} ${setting['wealthCoinIcon']}`}
                      >
                        {lang.tr.wealth}
                      </div>
                      <input type="text" value={serverWealth} disabled />
                    </div>
                  </div>
                  <div className={`${popup['inputBox']} ${popup['col']}`}>
                    <div className={popup['label']}>{lang.tr.description}</div>
                    <textarea
                      value={serverDescription}
                      onChange={(e) =>
                        setServer((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 1 ? (
              <div className={popup['col']}>
                <div className={setting['headerTextBox']}>
                  <div className={popup['label']}>
                    {lang.tr.inputAnnouncement}
                  </div>
                  <div
                    className={popup['button']}
                    onClick={async () => {
                      if (showPreview) {
                        setShowPreview(false);
                      } else {
                        setShowPreview(true);
                      }
                    }}
                  >
                    {showPreview ? lang.tr.edit : lang.tr.preview}
                  </div>
                </div>
                <div className={`${popup['inputBox']} ${popup['col']}`}>
                  {showPreview ? (
                    <div
                      className={markdown['settingMarkdownContainer']}
                      style={{ minHeight: '330px' }}
                    >
                      <MarkdownViewer markdownText={serverAnnouncement} />
                    </div>
                  ) : (
                    <textarea
                      style={{ minHeight: '330px' }}
                      value={serverAnnouncement}
                      onChange={(e) =>
                        setServer((prev) => ({
                          ...prev,
                          announcement: e.target.value,
                        }))
                      }
                    />
                  )}
                  <div className={popup['label']}>
                    {lang.tr.markdownSupport}
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 2 ? (
              <div className={popup['col']}>
                <div
                  className={`${popup['inputBox']} ${setting['headerBar']} ${popup['row']}`}
                >
                  <div className={popup['label']}>
                    {lang.tr.members}: {filteredMembers.length}
                  </div>
                  <div className={setting['searchWrapper']}>
                    <div className={setting['searchBorder']}>
                      <div className={setting['searchIcon']}></div>
                      <input
                        className={setting['searchInput']}
                        type="search"
                        placeholder={lang.tr.searchMemberPlaceholder}
                        value={searchText}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSearchText(e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className={`${popup['inputBox']} ${popup['col']}`}>
                  <table style={{ height: '330px' }}>
                    <thead>
                      <tr>
                        {MEMBER_FIELDS.map((field) => (
                          <th
                            key={field.field}
                            onClick={() =>
                              handleMemberSort(
                                field.field as keyof ServerMember,
                              )
                            }
                          >
                            {field.name}
                            {sortField === field.field &&
                              (sortState === 1 ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              ))}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={setting['tableContainer']}>
                      {filteredMembers.map((member) => {
                        const {
                          userId: memberUserId,
                          name: memberName,
                          nickname: memberNickname,
                          gender: memberGender,
                          permissionLevel: memberPermission,
                          contribution: memberContribution,
                          createdAt: memberJoinDate,
                        } = member;
                        const isCurrentUser = memberUserId === userId;
                        const canManageMember =
                          !isCurrentUser &&
                          userPermission > 4 &&
                          userPermission > memberPermission;
                        const canEditNickname =
                          canManageMember ||
                          (isCurrentUser && userPermission > 1);
                        const canChangeToGuest =
                          canManageMember &&
                          memberPermission !== 1 &&
                          userPermission > 5;
                        const canChangeToMember =
                          canManageMember &&
                          memberPermission !== 2 &&
                          (memberPermission > 1 || userPermission > 5);
                        const canChangeToChannelAdmin =
                          canManageMember &&
                          memberPermission !== 3 &&
                          memberPermission > 1 &&
                          userPermission > 3;
                        const canChangeToCategoryAdmin =
                          canManageMember &&
                          memberPermission !== 4 &&
                          memberPermission > 1 &&
                          userPermission > 4;
                        const canChangeToAdmin =
                          canManageMember &&
                          memberPermission !== 5 &&
                          memberPermission > 1 &&
                          userPermission > 5;

                        return (
                          <tr
                            key={memberUserId}
                            onContextMenu={(e) => {
                              const isCurrentUser = memberUserId === userId;
                              contextMenu.showContextMenu(
                                e.clientX,
                                e.clientY,
                                [
                                  {
                                    id: 'direct-message',
                                    label: lang.tr.directMessage,
                                    show: !isCurrentUser,
                                    onClick: () =>
                                      handleOpenDirectMessage(
                                        userId,
                                        memberUserId,
                                        memberName,
                                      ),
                                  },
                                  {
                                    id: 'view-profile',
                                    label: lang.tr.viewProfile,
                                    show: !isCurrentUser,
                                    onClick: () =>
                                      handleOpenUserInfo(userId, memberUserId),
                                  },
                                  {
                                    id: 'apply-friend',
                                    label: lang.tr.addFriend,
                                    show: !isCurrentUser,
                                    onClick: () =>
                                      handleOpenApplyFriend(
                                        userId,
                                        memberUserId,
                                      ),
                                  },
                                  {
                                    id: 'edit-nickname',
                                    label: lang.tr.editNickname,
                                    show: canEditNickname,
                                    onClick: () =>
                                      handleOpenEditNickname(
                                        memberUserId,
                                        serverId,
                                      ),
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
                              );
                            }}
                          >
                            <td>
                              <div
                                className={`${permission[memberGender]} ${
                                  permission[`lv-${memberPermission}`]
                                }`}
                              />
                              <div
                                className={`${popup['p1']} ${
                                  memberNickname && memberName
                                    ? setting['memberName']
                                    : ''
                                }`}
                              >
                                {memberNickname || memberName}
                              </div>
                            </td>
                            <td>{lang.getPermissionText(memberPermission)}</td>
                            <td>{memberContribution}</td>
                            <td>
                              {new Date(memberJoinDate)
                                .toISOString()
                                .slice(0, 10)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className={setting['noteText']}>
                    {lang.tr.rightClickToProcess}
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 3 ? (
              <div className={popup['col']}>
                <div className={popup['pageHeaderText']}>
                  <div className={popup['label']}>
                    {lang.tr.accessPermission}
                  </div>
                  <div className={popup['textLineSplit']}></div>
                </div>
                <div className={popup['inputGroup']}>
                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <input
                      type="radio"
                      id="public"
                      name="permission"
                      value="public"
                      className="mr-3"
                      checked={serverVisibility === 'public'}
                      onChange={(e) => {
                        if (e.target.checked)
                          setServer((prev) => ({
                            ...prev,
                            visibility: 'public',
                          }));
                      }}
                    />
                    <div className={popup['label']}>{lang.tr.publicServer}</div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <input
                      type="radio"
                      id="members"
                      name="permission"
                      value="members"
                      className="mr-3"
                      checked={serverVisibility === 'private'}
                      onChange={(e) => {
                        if (e.target.checked)
                          setServer((prev) => ({
                            ...prev,
                            visibility: 'private',
                          }));
                      }}
                    />
                    <div>
                      <div className={popup['label']}>
                        {lang.tr.semiPublicServer}
                      </div>
                      <div className={setting['hintText']}>
                        {lang.tr.semiPublicServerDescription}
                      </div>
                    </div>
                  </div>

                  <div className={`${popup['inputBox']} ${popup['row']}`}>
                    <input
                      type="radio"
                      id="private"
                      name="permission"
                      value="private"
                      className="mr-3"
                      checked={serverVisibility === 'invisible'}
                      onChange={(e) => {
                        if (e.target.checked)
                          setServer((prev) => ({
                            ...prev,
                            visibility: 'invisible',
                          }));
                      }}
                    />
                    <div>
                      <div className={popup['label']}>
                        {lang.tr.privateServer}
                      </div>
                      <div className={setting['hintText']}>
                        {lang.tr.privateServerDescription}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 4 ? (
              <div className={popup['col']}>
                <div className={`${popup['inputBox']} ${popup['row']}`}>
                  <div className={popup['label']}>
                    {lang.tr.applicants}: {filteredApplications.length}
                  </div>
                  <button
                    style={{ marginLeft: 'auto' }}
                    className={popup['button']}
                    onClick={() => handleOpenMemberApplySetting()}
                  >
                    {lang.tr.editApply}
                  </button>
                  <div className={setting['searchWrapper']}>
                    <div className={setting['searchBorder']}>
                      <div className={setting['searchIcon']}></div>
                      <input
                        className={setting['searchInput']}
                        type="search"
                        placeholder={lang.tr.searchMemberPlaceholder}
                        value={searchText}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSearchText(e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className={`${popup['inputBox']} ${popup['col']}`}>
                  <table style={{ height: '330px' }}>
                    <thead>
                      <tr>
                        {APPLICATION_FIELDS.map((field) => (
                          <th
                            key={field.field}
                            onClick={() =>
                              handleApplicationSort(
                                field.field as keyof MemberApplication,
                              )
                            }
                          >
                            {field.name}
                            {sortField === field.field &&
                              (sortState === 1 ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              ))}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={setting['tableContainer']}>
                      {filteredApplications.map((application) => {
                        const {
                          userId: applicationUserId,
                          name: applicationName,
                          description: applicationDescription,
                          createdAt: applicationCreatedAt,
                        } = application;
                        const isCurrentUser = applicationUserId === userId;
                        const canAccept = !isCurrentUser && userPermission > 4;
                        const canDeny = !isCurrentUser && userPermission > 4;
                        return (
                          <tr
                            key={applicationUserId}
                            onContextMenu={(e) => {
                              contextMenu.showContextMenu(
                                e.clientX,
                                e.clientY,
                                [
                                  {
                                    id: 'view-profile',
                                    label: lang.tr.viewProfile,
                                    show: !isCurrentUser,
                                    onClick: () =>
                                      handleOpenUserInfo(
                                        userId,
                                        applicationUserId,
                                      ),
                                  },
                                  {
                                    id: 'accept',
                                    label: lang.tr.acceptApplication,
                                    show: canAccept,
                                    onClick: () => {
                                      handleDeleteMemberApplication(
                                        applicationUserId,
                                        serverId,
                                      );
                                      handleCreateMember(
                                        { permissionLevel: 2 },
                                        applicationUserId,
                                        serverId,
                                      );
                                    },
                                  },
                                  {
                                    id: 'deny',
                                    label: lang.tr.denyApplication,
                                    show: canDeny,
                                    onClick: () => {
                                      handleDeleteMemberApplication(
                                        applicationUserId,
                                        serverId,
                                      );
                                    },
                                  },
                                ],
                              );
                            }}
                          >
                            <td>
                              <div className={popup['p1']}>
                                {applicationName}
                              </div>
                            </td>
                            <td>{applicationDescription}</td>
                            <td>
                              {new Date(applicationCreatedAt)
                                .toISOString()
                                .slice(0, 10)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className={setting['noteText']}>
                    {lang.tr.rightClickToProcess}
                  </div>
                </div>
              </div>
            ) : activeTabIndex === 5 ? (
              <div className={popup['col']}>
                <div
                  className={`${popup['inputBox']} ${setting['headerBar']} ${popup['row']}`}
                >
                  <div className={popup['label']}>
                    {lang.tr.blacklist}: {filteredBlockMembers.length}
                  </div>
                  <div className={setting['searchWrapper']}>
                    <div className={setting['searchBorder']}>
                      <div className={setting['searchIcon']}></div>
                      <input
                        className={setting['searchInput']}
                        type="search"
                        placeholder={lang.tr.searchMemberPlaceholder}
                        value={searchText}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSearchText(e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className={`${popup['inputBox']} ${popup['col']}`}>
                  <table style={{ height: '330px' }}>
                    <thead>
                      <tr>
                        {BLOCK_MEMBER_FIELDS.map((field) => (
                          <th
                            key={field.field}
                            onClick={() =>
                              handleMemberSort(
                                field.field as keyof ServerMember,
                              )
                            }
                          >
                            {field.name}
                            {sortField === field.field &&
                              (sortState === 1 ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              ))}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={setting['tableContainer']}>
                      {filteredBlockMembers.map((blockMember) => {
                        const {
                          userId: memberUserId,
                          nickname: blockMemberNickname,
                          name: blockMemberName,
                        } = blockMember;
                        return (
                          <tr
                            key={memberUserId}
                            onContextMenu={(e) => {
                              contextMenu.showContextMenu(
                                e.clientX,
                                e.clientY,
                                [
                                  {
                                    id: 'unblock',
                                    label: lang.tr.unblock,
                                    show: true,
                                    onClick: () => {
                                      handleUpdateMember(
                                        { isBlocked: false },
                                        memberUserId,
                                        serverId,
                                      );
                                    },
                                  },
                                ],
                              );
                            }}
                          >
                            <td>{blockMemberNickname || blockMemberName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className={setting['noteText']}>
                    {lang.tr.rightClickToProcess}
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
              handleUpdateServer(
                {
                  name: serverName,
                  avatar: serverAvatar,
                  avatarUrl: serverAvatarUrl,
                  announcement: serverAnnouncement,
                  description: serverDescription,
                  type: serverType,
                  slogan: serverSlogan,
                  visibility: serverVisibility,
                },
                serverId,
              );
              handleClose();
            }}
          >
            {lang.tr.save}
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

ServerSettingPopup.displayName = 'ServerSettingPopup';

export default ServerSettingPopup;
