/* eslint-disable react-hooks/exhaustive-deps */
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useRef, useCallback } from 'react';

// CSS
import homePage from '@/styles/pages/home.module.css';

// Components
import ServerListViewer from '@/components/viewers/ServerList';
import EventListViewer from '@/components/viewers/EventList';

// Type
import {
  PopupType,
  Server,
  SocketServerEvent,
  User,
  UserServer,
  Event,
} from '@/types';

// Providers
import { useSocket } from '@/providers/Socket';
import { useLanguage } from '@/providers/Language';
import { useMainTab } from '@/providers/MainTab';

// Services
import ipcService from '@/services/ipc.service';
import refreshService from '@/services/refresh.service';
import apiService from '@/services/api.service';

export interface ServerListSectionProps {
  title: string;
  servers: Server[];
  user: User;
  onServerClick?: (server: Server) => void;
}

const ServerListSection: React.FC<ServerListSectionProps> = ({
  title,
  user,
  servers,
  onServerClick,
}) => {
  // Hooks
  const lang = useLanguage();

  // States
  const [expanded, setExpanded] = useState(false);

  // Variables
  const displayedServers = expanded ? servers : servers.slice(0, 6);
  const canExpand = servers.length > 6;

  return (
    <div className={homePage['serverList']}>
      <div className={homePage['serverListTitle']}>{title}</div>
      <ServerListViewer
        user={user}
        servers={displayedServers}
        onServerClick={onServerClick}
      />
      {canExpand && (
        <button
          className={`
            ${homePage['viewMoreBtn']} 
            ${expanded ? homePage['more'] : homePage['less']}
          `}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? lang.tr.viewLess : lang.tr.viewMore}
        </button>
      )}
    </div>
  );
};

const SearchResultItem: React.FC<{
  server: Server;
  onClick: () => void;
}> = ({ server, onClick }) => (
  <div className={homePage['dropdownItem']} onClick={onClick}>
    <div
      className={homePage['serverAvatarPicture']}
      style={{
        backgroundImage: `url(${server.avatarUrl})`,
      }}
    />
    <div className={homePage['serverInfoText']}>
      <div className={homePage['serverNameText']}>{server.name}</div>
      <div className={homePage['serverIdBox']}>
        <div className={homePage['idIcon']} />
        <div className={homePage['serverIdText']}>{server.displayId}</div>
      </div>
    </div>
  </div>
);

interface HomePageProps {
  user: User;
  server: Server;
  display: boolean;
}

const HomePageComponent: React.FC<HomePageProps> = React.memo(
  ({ user, server, display }) => {
    // Hooks
    const lang = useLanguage();
    const socket = useSocket();
    const mainTab = useMainTab();

    // Refs
    const refreshed = useRef(false);

    // States
    const [userServers, setUserServers] = useState<UserServer[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLDivElement>(null);
    const [exactMatch, setExactMatch] = useState<Server | null>(null);
    const [personalResults, setPersonalResults] = useState<Server[]>([]);
    const [relatedResults, setRelatedResults] = useState<Server[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingGroupID, setLoadingGroupID] = useState<string>();
    const [activeEvents, setActiveEvents] = useState<Event[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);

    // Variables
    const { userId, name: userName, currentServerId } = user;
    const hasResults =
      exactMatch || personalResults.length > 0 || relatedResults.length > 0;
    const recentServers = userServers
      .filter((s) => s.recent)
      .sort((a, b) => b.timestamp - a.timestamp);
    const favoriteServers = userServers.filter((s) => s.favorite);
    const ownedServers = userServers.filter((s) => s.permissionLevel > 1);

    // Handlers
    const handleSearchServer = (query: string) => {
      if (!socket || !query.trim()) {
        handleClearSearchState();
        return;
      }
      socket.send.searchServer({ query });
      setSearchQuery(query);
    };

    const handleConnectServer = (
      serverId: Server['serverId'],
      serverDisplayId: Server['displayId'],
    ) => {
      if (!socket) return;
      socket.send.connectServer({
        serverId,
        userId: userId,
      });
      handleClearSearchState();
      setIsLoading(true);
      setLoadingGroupID(serverDisplayId);
    };

    const handleUserServersUpdate = (data: UserServer[] | null) => {
      if (!data) data = [];
      setUserServers(data);
    };

    const handleServerSearch = (servers: Server[]) => {
      if (!servers.length) {
        setExactMatch(null);
        setPersonalResults([]);
        setRelatedResults([]);
        return;
      }

      const sortedServers = servers.sort((a, b) => {
        const aHasId = a.displayId.toString().includes(searchQuery);
        const bHasId = b.displayId.toString().includes(searchQuery);
        if (aHasId && !bHasId) return -1;
        if (!aHasId && bHasId) return 1;
        return 0;
      });

      const exact = sortedServers.find(
        (server) => server.displayId === searchQuery,
      );
      setExactMatch(exact || null);

      const personal = sortedServers.filter((server) =>
        userServers.some(
          (s) =>
            s.recent || s.favorite || s.owned || s.serverId === server.serverId,
        ),
      );
      setPersonalResults(personal);

      const related = sortedServers
        .filter((server) => !personal.includes(server))
        .filter((server) => server.visibility !== 'invisible');
      setRelatedResults(related);
    };

    const handleOpenCreateServer = (userId: User['userId']) => {
      ipcService.popup.open(PopupType.CREATE_SERVER);
      ipcService.initialData.onRequest(PopupType.CREATE_SERVER, { userId });
    };

    const handleClearSearchState = () => {
      setSearchQuery('');
      setExactMatch(null);
      setPersonalResults([]);
      setRelatedResults([]);
      setShowDropdown(false);
    };

    const handleClickOutside = useCallback((event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }, []);

    // 加载活动数据
    const loadActiveEvents = async () => {
      try {
        setIsLoadingEvents(true);
        const response = await apiService.get('/api/events?active=true');
        const events = response;
        if (events && Array.isArray(events)) {
          // 只保留当前有效的活动（开始时间已到，结束时间未到）
          const now = Date.now();
          const activeEvents = events.filter(
            (event) => event.startTime <= now && event.endTime > now,
          );
          setActiveEvents(activeEvents);
        } else {
          setActiveEvents([]);
        }
      } catch (error) {
        console.error('獲取活動數據失敗:', error);
        setActiveEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    // 处理点击活动
    const handleEventClick = (event: Event) => {
      // 如果活动与特定服务器关联，可以连接到该服务器
      if (event.serverId) {
        // 查找服务器信息
        const serverInfo = userServers.find(
          (s) => s.serverId === event.serverId,
        );
        if (serverInfo) {
          if (currentServerId === event.serverId) {
            mainTab.setSelectedTabId('server');
          } else {
            setIsLoading(true);
            setLoadingGroupID(serverInfo.displayId);
            // 连接到服务器
            if (socket) {
              socket.send.connectServer({
                serverId: event.serverId,
                userId: userId,
              });
            }
          }
        }
      }
    };

    // Effects
    useEffect(() => {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
      if (!socket) return;

      const eventHandlers = {
        [SocketServerEvent.SERVER_SEARCH]: handleServerSearch,
        [SocketServerEvent.USER_SERVERS_UPDATE]: handleUserServersUpdate,
      };
      const unsubscribe: (() => void)[] = [];

      Object.entries(eventHandlers).map(([event, handler]) => {
        const unsub = socket.on[event as SocketServerEvent](handler);
        unsubscribe.push(unsub);
      });

      return () => {
        unsubscribe.forEach((unsub) => unsub());
      };
    }, [socket, searchQuery]);

    useEffect(() => {
      if (!userId || refreshed.current) return;
      const refresh = async () => {
        refreshed.current = true;
        Promise.all([
          refreshService.userServers({
            userId: userId,
          }),
        ]).then(([userServers]) => {
          handleUserServersUpdate(userServers);
        });
      };
      refresh();
    }, [userId]);

    useEffect(() => {
      if (mainTab.selectedTabId == 'server') {
        if (!server) return;
        setIsLoading(false);
        setLoadingGroupID('');
        localStorage.removeItem('trigger-handle-server-select');
      }
    }, [server, isLoading, mainTab]);

    useEffect(() => {
      if (!lang) return;
      ipcService.discord.updatePresence({
        details: lang.tr.RPCHomePage,
        state: `${lang.tr.RPCUser} ${userName}`,
        largeImageKey: 'app_icon',
        largeImageText: 'RC Voice',
        smallImageKey: 'home_icon',
        smallImageText: lang.tr.RPCHome,
        timestamp: Date.now(),
        buttons: [
          {
            label: lang.tr.RPCJoinServer,
            url: 'https://discord.gg/adCWzv6wwS',
          },
        ],
      });
    }, [lang, userName]);

    useEffect(() => {
      const handler = ({ key, newValue }: StorageEvent) => {
        if (key !== 'trigger-handle-server-select' || !newValue) return;
        const { serverDisplayId } = JSON.parse(newValue);
        mainTab.setSelectedTabId('home');
        setIsLoading(true);
        setLoadingGroupID(serverDisplayId);
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }, [mainTab]);

    // 加载活动数据
    useEffect(() => {
      if (display) {
        loadActiveEvents();
      }
    }, [display]);

    // 每分钟刷新一次活动数据（用于更新倒计时）
    useEffect(() => {
      if (!display) return;

      const timer = setInterval(() => {
        // 只刷新界面，不重新加载数据
        setActiveEvents((prev) => [...prev]);
      }, 60000);

      return () => clearInterval(timer);
    }, [display]);

    return (
      <div
        className={homePage['homeWrapper']}
        style={{ display: display ? 'flex' : 'none' }}
      >
        {/* Header */}
        <header className={homePage['homeHeader']}>
          <div className={homePage['left']}>
            <div className={homePage['backBtn']} />
            <div className={homePage['forwardBtn']} />
            <div className={homePage['searchBar']} ref={searchRef}>
              <input
                placeholder={lang.tr.searchPlaceholder}
                className={homePage['searchInput']}
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  setShowDropdown(true);
                  handleSearchServer(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && exactMatch) {
                    handleConnectServer(
                      exactMatch.serverId,
                      exactMatch.displayId,
                    );
                  }
                }}
                onFocus={() => setShowDropdown(true)}
              />
              {searchQuery ? (
                <button
                  className={homePage['searchInputClear']}
                  onClick={handleClearSearchState}
                />
              ) : (
                <i className={homePage['searchInputIcon']} />
              )}
              {showDropdown && (
                <div className={homePage['searchDropdown']}>
                  {hasResults && (
                    <>
                      {exactMatch && (
                        <div className={homePage['dropdownHeaderText']}>
                          {lang.tr.quickEnterServer} {exactMatch.displayId}
                        </div>
                      )}
                      {personalResults.length > 0 && (
                        <>
                          <div className={homePage['dropdownHeader']}>
                            <div>{lang.tr.personalExclusive}</div>
                          </div>
                          {personalResults.map((server) => (
                            <SearchResultItem
                              key={server.serverId}
                              server={server}
                              onClick={() =>
                                handleConnectServer(
                                  server.serverId,
                                  server.displayId,
                                )
                              }
                            />
                          ))}
                        </>
                      )}
                      {relatedResults.length > 0 && (
                        <>
                          <div className={homePage['dropdownHeader']}>
                            <div>{lang.tr.relatedSearch}</div>
                          </div>
                          {relatedResults.map((server) => (
                            <SearchResultItem
                              key={server.serverId}
                              server={server}
                              onClick={() =>
                                handleConnectServer(
                                  server.serverId,
                                  server.displayId,
                                )
                              }
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {!hasResults && searchQuery === '' && (
                    <div
                      className={`${homePage['dropdownItem']} ${homePage['inputEmptyItem']}`}
                    >
                      {lang.tr.searchEmpty}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className={homePage['mid']}>
            <button
              className={`${homePage['navegateItem']} ${homePage['active']}`}
              data-key="60060"
            >
              {lang.tr.home}
            </button>
            <button className={homePage['navegateItem']} data-key="30014">
              {lang.tr.game}
            </button>
            <button className={homePage['navegateItem']} data-key="30375">
              {lang.tr.live}
            </button>
          </div>
          <div className={homePage['right']}>
            <button
              className={homePage['navegateItem']}
              data-key="30014"
              onClick={() => handleOpenCreateServer(userId)}
            >
              {lang.tr.createGroup}
            </button>
            <button className={homePage['navegateItem']} data-key="60004">
              {lang.tr.personalExclusive}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className={homePage['homeContent']}>
          {/* 活動部分 - 移動到最上方 */}
          {!isLoadingEvents && activeEvents.length > 0 && (
            <EventListViewer
              events={activeEvents}
              onEventClick={handleEventClick}
            />
          )}

          <ServerListSection
            title={lang.tr.recentVisits}
            servers={recentServers}
            user={user}
            onServerClick={(server) => {
              if (currentServerId == server.serverId) {
                mainTab.setSelectedTabId('server');
              } else {
                setIsLoading(true);
                setLoadingGroupID(server.displayId);
              }
            }}
          />
          <ServerListSection
            title={lang.tr.myGroups}
            servers={ownedServers}
            user={user}
            onServerClick={(server) => {
              setIsLoading(true);
              setLoadingGroupID(server.displayId);
            }}
          />
          <ServerListSection
            title={lang.tr.favoriteGroups}
            servers={favoriteServers}
            user={user}
            onServerClick={(server) => {
              setIsLoading(true);
              setLoadingGroupID(server.displayId);
            }}
          />
        </main>

        {/* Loading */}
        {isLoading && (
          <div className={homePage['loadingWrapper']}>
            <div className={homePage['loadingBox']}>
              <div className={homePage['loadingTitleContain']}>
                <div>{lang.tr.connectingServer}</div>
                <div className={homePage['loadingGroupID']}>
                  {loadingGroupID}
                </div>
              </div>
              <div className={homePage['loadingGif']}></div>
              <div
                className={homePage['loadingCloseBtn']}
                onClick={() => setIsLoading(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);

HomePageComponent.displayName = 'HomePageComponent';

// use dynamic import to disable SSR
const HomePage = dynamic(() => Promise.resolve(HomePageComponent), {
  ssr: false,
});

export default HomePage;
