import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// Error
import StandardizedError from '@/error';

// Database
import { database } from '@/index';

// Utils
import { generateUniqueDisplayId } from '@/utils';

// Handlers
import {
  ConnectChannelHandler,
  DisconnectChannelHandler,
} from '@/api/socket/events/channel/channel.handler';
import { ConnectServerHandler } from '@/api/socket/events/server/server.handler';

export class SearchServerService {
  constructor(private query: string) {
    this.query = query;
  }

  async use() {
    const result = await database.get.searchServer(this.query);

    return {
      serverSearch: result,
    };
  }
}

export class CreateServerService {
  constructor(private operatorId: string, private server: any) {
    this.operatorId = operatorId;
    this.server = server;
  }

  async use() {
    const actions: any[] = [];
    const operator = await database.get.user(this.operatorId);
    const operatorServers = await database.get.userServers(this.operatorId);

    if (
      operatorServers &&
      operatorServers.filter((s: any) => s.owned).length >=
        Math.min(3 + operator.level / 5, 10)
    ) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '可擁有群組數量已達上限',
        part: 'CREATESERVER',
        tag: 'LIMIT_REACHED',
        statusCode: 403,
      });
    }

    // Create server
    const serverId = uuidv4();
    const displayId = await generateUniqueDisplayId();
    await database.set.server(serverId, {
      ...this.server,
      displayId,
      ownerId: this.operatorId,
      createdAt: Date.now(),
    });

    // Create channel (lobby)
    const lobbyId = uuidv4();
    await database.set.channel(lobbyId, {
      name: '大廳',
      isLobby: true,
    });

    // Create member
    await database.set.member(this.operatorId, serverId, {
      permissionLevel: 6,
      createdAt: Date.now(),
    });

    // Create user-server
    await database.set.userServer(this.operatorId, serverId, {
      owned: true,
    });

    // Update Server (lobby)
    await database.set.server(serverId, {
      lobbyId,
    });

    // Join the server

    actions.push({
      handler: (io: Server, socket: Socket) =>
        new ConnectServerHandler(io, socket),
      data: {
        userId: this.operatorId,
        serverId: serverId,
      },
    });

    return {
      actions,
    };
  }
}

export class UpdateServerService {
  constructor(
    private operatorId: string,
    private serverId: string,
    private update: any,
  ) {
    this.operatorId = operatorId;
    this.serverId = serverId;
    this.update = update;
  }

  async use() {
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (operatorMember.permissionLevel < 5) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '你沒有足夠的權限更新該群組',
        part: 'UPDATESERVER',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    // Update server
    await database.set.server(this.serverId, this.update);

    return {};
  }
}

export class ConnectServerService {
  constructor(
    private operatorId: string,
    private userId: string,
    private serverId: string,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.serverId = serverId;
  }

  async use() {
    const actions: any[] = [];
    const user = await database.get.user(this.userId);
    const server = await database.get.server(this.serverId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (this.operatorId !== this.userId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法移動其他用戶的群組',
        part: 'CONNECTSERVER',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    } else {
      if (
        server.visibility === 'invisible' &&
        (!operatorMember || operatorMember.permissionLevel < 2)
      ) {
        return {
          openPopup: {
            type: 'applyMember',
            id: 'applyMember',
            initialData: {
              serverId: this.serverId,
              userId: this.userId,
            },
          },
        };
      }
    }

    // Create new membership if there isn't one
    if (!operatorMember) {
      await database.set.member(this.userId, this.serverId, {
        permissionLevel: 1,
      });
    }

    // Update user-server
    await database.set.userServer(this.userId, this.serverId, {
      recent: true,
      timestamp: Date.now(),
    });

    // Join lobby
    actions.push(async (io: Server, socket: Socket) => {
      await new ConnectChannelHandler(io, socket).handle({
        channelId: server.lobbyId,
        serverId: this.serverId,
        userId: this.userId,
      });
    });

    return {
      serversUpdate: await database.get.userServers(this.userId),
      serverChannelsUpdate: await database.get.serverChannels(this.serverId),
      serverMembersUpdate: await database.get.serverMembers(this.serverId),
      currentServerId: user.currentServerId,
      actions,
    };
  }
}

export class DisconnectServerService {
  constructor(
    private operatorId: string,
    private userId: string,
    private serverId: string,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.serverId = serverId;
  }

  async use() {
    const actions: any[] = [];
    const user = await database.get.user(this.userId);
    const userMember = await database.get.member(this.userId, this.serverId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (this.operatorId !== this.userId) {
      if (this.serverId !== user.currentServerId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法踢出不在該群組的用戶',
          part: 'DISCONNECTSERVER',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
      if (operatorMember.permissionLevel < 5) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '你沒有足夠的權限踢出其他用戶',
          part: 'DISCONNECTSERVER',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
      if (operatorMember.permissionLevel <= userMember.permissionLevel) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '你沒有足夠的權限踢出該用戶',
          part: 'DISCONNECTSERVER',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
    }

    // Leave current channel
    if (user.currentChannelId) {
      actions.push(async (io: Server, socket: Socket) => {
        await new DisconnectChannelHandler(io, socket).handle({
          userId: this.userId,
          channelId: user.currentChannelId,
          serverId: user.currentServerId,
        });
      });
    }

    return {
      actions,
    };
  }
}
