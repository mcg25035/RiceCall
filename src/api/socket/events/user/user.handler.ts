// Utils
import Logger from '@/utils/logger';

// Error
import StandardizedError from '@/error';

// Handler
import { SocketHandler } from '@/api/socket/base.handler';

// Schemas
import {
  SearchUserSchema,
  UpdateUserSchema,
} from '@/api/socket/events/user/user.schema';

// Middleware
import DataValidator from '@/middleware/data.validator';

// Database
import { database } from '@/index';
import { ConnectServerHandler } from '@/api/socket/events/server/server.handler';
import { DisconnectServerHandler } from '@/api/socket/events/server/server.handler';
import { ConnectChannelHandler } from '@/api/socket/events/channel/channel.handler';
import { DisconnectChannelHandler } from '@/api/socket/events/channel/channel.handler';

export class SearchUserHandler extends SocketHandler {
  async handle(data: any) {
    try {
      // const operatorId = this.socket.data.userId;

      const { query } = await new DataValidator(
        SearchUserSchema,
        'SEARCHUSER',
      ).validate(data);

      const result = await database.get.searchUser(query);

      this.socket.emit('userSearch', result);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `搜尋使用者時發生無法預期的錯誤: ${error.message}`,
          part: 'SEARCHUSER',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('User').error(error.message);
    }
  }
}

export class ConnectUserHandler extends SocketHandler {
  async handle() {
    try {
      const operatorId = this.socket.data.userId;

      const user = await database.get.user(operatorId);

      // Reconnect user to server
      if (user.currentServerId) {
        await new DisconnectServerHandler(this.io, this.socket).handle({
          userId: user.userId,
          serverId: user.currentServerId,
        });
        await new ConnectServerHandler(this.io, this.socket).handle({
          userId: user.userId,
          serverId: user.currentServerId,
        });
      }
      if (user.currentChannelId) {
        await new DisconnectChannelHandler(this.io, this.socket).handle({
          userId: user.userId,
          channelId: user.currentChannelId,
          serverId: user.currentServerId,
        });
        await new ConnectChannelHandler(this.io, this.socket).handle({
          userId: user.userId,
          channelId: user.currentChannelId,
          serverId: user.currentServerId,
        });
      }

      // Update user
      await database.set.user(operatorId, {
        lastActiveAt: Date.now(),
      });

      this.socket.emit('userUpdate', await database.get.user(operatorId));
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `連接使用者時發生無法預期的錯誤: ${error.message}`,
          part: 'CONNECTUSER',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('User').error(error.message);
    }
  }
}

export class DisconnectUserHandler extends SocketHandler {
  async handle() {
    try {
      const operatorId = this.socket.data.userId;

      const user = await database.get.user(operatorId);

      // Disconnect user from server and channel
      if (user.currentServerId) {
        await new DisconnectServerHandler(this.io, this.socket).handle({
          userId: user.userId,
          serverId: user.currentServerId,
        });
      } else if (user.currentChannelId) {
        await new DisconnectChannelHandler(this.io, this.socket).handle({
          userId: user.userId,
          channelId: user.currentChannelId,
          serverId: user.currentServerId,
        });
      }

      // Update user
      await database.set.user(operatorId, {
        lastActiveAt: Date.now(),
      });

      this.socket.emit('userUpdate', null);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `斷開使用者時發生無法預期的錯誤: ${error.message}`,
          part: 'DISCONNECTUSER',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('User').error(error.message);
    }
  }
}

export class UpdateUserHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { userId, user: update } = await new DataValidator(
        UpdateUserSchema,
        'UPDATEUSER',
      ).validate(data);

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'ServerError',
          message: '無法更新其他使用者的資料',
          part: 'UPDATEUSER',
          tag: 'PERMISSION_ERROR',
          statusCode: 403,
        });
      }

      await database.set.user(userId, update);

      this.socket.emit('userUpdate', update);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `更新使用者時發生無法預期的錯誤: ${error.message}`,
          part: 'UPDATEUSER',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('User').error(error.message);
    }
  }
}
