import React from 'react';

// CSS
import homePage from '@/styles/pages/home.module.css';

// Type
import { UserServer, User } from '@/types';

// Providers
import { useSocket } from '@/providers/Socket';

interface ServerCardProps {
  user: User;
  server: UserServer;
  onClick?: () => void;
}

const ServerCard: React.FC<ServerCardProps> = React.memo(
  ({ user, server, onClick }) => {
    // Hooks
    const socket = useSocket();

    // Variables
    const {
      serverId,
      name: serverName,
      avatarUrl: serverAvatarUrl,
      displayId: serverDisplayId,
      slogan: serverSlogan,
      ownerId: serverOwnerId,
    } = server;
    const { userId } = user;
    const isOwner = serverOwnerId === userId;

    // Handlers
    const handleServerSelect = (
      userId: User['userId'],
      serverId: UserServer['serverId'],
    ) => {
      setTimeout(() => {
        if (!socket) return;
        socket.send.connectServer({ userId, serverId });
      }, 1500);
      onClick?.();
    };

    return (
      <div
        className={homePage['serverCard']}
        onClick={() => {
          handleServerSelect(userId, serverId);
        }}
      >
        <div
          className={homePage['serverAvatarPicture']}
          style={{ backgroundImage: `url(${serverAvatarUrl})` }}
        ></div>
        <div className={homePage['serverInfoText']}>
          <div className={homePage['serverNameText']}>{serverName}</div>
          <div className={homePage['serverIdBox']}>
            <div
              className={`
                ${homePage['serverIdText']} 
                ${isOwner ? homePage['IsOwner'] : ''}
              `}
            >
              ID:
            </div>
            <div className={homePage['serverIdText']}>{serverDisplayId}</div>
          </div>
          <div className={homePage['serverSlogen']}>{serverSlogan}</div>
        </div>
      </div>
    );
  },
);

ServerCard.displayName = 'ServerCard';

// ServerGrid Component
interface ServerListViewerProps {
  user: User;
  servers: UserServer[];
  onServerClick?: (server: UserServer) => void;
}

const ServerListViewer: React.FC<ServerListViewerProps> = React.memo(
  ({ user, servers, onServerClick }) => {
    return (
      <div className={homePage['serverCards']}>
        {servers.map((server) => (
          <ServerCard
            key={server.serverId}
            user={user}
            server={server}
            onClick={() => onServerClick?.(server)}
          />
        ))}
      </div>
    );
  },
);

ServerListViewer.displayName = 'ServerListViewer';

export default ServerListViewer;
