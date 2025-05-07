// Error
import StandardizedError from '@/error';

// Utils
import Logger from '@/utils/logger';

// Socket
import SocketServer from '@/api/socket';

// Handler
import { SocketHandler } from '@/api/socket/base.handler';

// Schemas
import {
  CreateFriendSchema,
  UpdateFriendSchema,
  DeleteFriendSchema,
} from '@/api/socket/events/friend/friend.schema';

// Middleware
import DataValidator from '@/middleware/data.validator';

// Database
import { database } from '@/index';

export class CreateFriendHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const {
        userId,
        targetId,
        friend: preset,
      } = await new DataValidator(CreateFriendSchema, 'CREATEFRIEND').validate(
        data,
      );

      const friend = await database.get.friend(userId, targetId);

      if (friend) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '你已經是對方的好友',
          part: 'CREATEFRIEND',
          tag: 'FRIEND_EXISTS',
          statusCode: 400,
        });
      }

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法新增非自己的好友',
          part: 'CREATEFRIEND',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      if (userId === targetId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法將自己加入好友',
          part: 'CREATEFRIEND',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      // Create friend
      await database.set.friend(userId, targetId, {
        ...preset,
        createdAt: Date.now(),
      });

      // Create friend (reverse)
      await database.set.friend(targetId, userId, {
        ...preset,
        createdAt: Date.now(),
      });

      const targetSocket = SocketServer.getSocket(targetId);

      this.socket.emit(
        'friendAdd',
        await database.get.userFriend(userId, targetId),
      );
      if (targetSocket) {
        targetSocket.emit(
          'friendAdd',
          await database.get.userFriend(targetId, userId),
        );
      }
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `建立好友時發生無法預期的錯誤: ${error.message}`,
          part: 'CREATEFRIEND',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Friend').error(error.message);
    }
  }
}

export class UpdateFriendHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { userId, targetId, friend } = await new DataValidator(
        UpdateFriendSchema,
        'UPDATEFRIEND',
      ).validate(data);

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法修改非自己的好友',
          part: 'UPDATEFRIEND',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      // Update friend
      await database.set.friend(userId, targetId, friend);

      this.socket.emit('friendUpdate', userId, targetId, friend);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `更新好友時發生無法預期的錯誤: ${error.message}`,
          part: 'UPDATEFRIEND',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Friend').error(error.message);
    }
  }
}

export class DeleteFriendHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { userId, targetId } = await new DataValidator(
        DeleteFriendSchema,
        'DELETEFRIEND',
      ).validate(data);

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法刪除非自己的好友',
          part: 'DELETEFRIEND',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      // Delete friend
      await database.delete.friend(userId, targetId);

      // Delete friend (reverse)
      await database.delete.friend(targetId, userId);

      const targetSocket = SocketServer.getSocket(targetId);

      this.socket.emit('friendDelete', userId, targetId);
      if (targetSocket) {
        targetSocket.emit('friendDelete', targetId, userId);
      }
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `刪除好友時發生無法預期的錯誤: ${error.message}`,
          part: 'DELETEFRIEND',
          tag: 'EXCEPTION_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Friend').error(error.message);
    }
  }
}
