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
  SendDirectMessageSchema,
  SendMessageSchema,
} from '@/api/socket/events/message/message.schemas';

// Middleware
import DataValidator from '@/middleware/data.validator';

// Database
import { database } from '@/index';

export class SendMessageHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const {
        userId,
        serverId,
        channelId,
        message: preset,
      } = await new DataValidator(SendMessageSchema, 'SENDMESSAGE').validate(
        data,
      );

      const channel = await database.get.channel(channelId);
      const operatorMember = await database.get.member(operatorId, serverId);

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法傳送非自己的訊息',
          part: 'SENDMESSAGE',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      if (channel.forbidGuestUrl && operatorMember.permissionLevel === 1) {
        preset.content = preset.content.replace(
          /https?:\/\/[^\s]+/g,
          '{{GUEST_SEND_AN_EXTERNAL_LINK}}',
        );
      }

      // Create new message
      const message = {
        ...preset,
        ...(await database.get.member(userId, serverId)),
        ...(await database.get.user(userId)),
        senderId: userId,
        serverId: serverId,
        channelId: channelId,
        timestamp: Date.now().valueOf(),
      };

      // Update member
      const updatedMember = {
        lastMessageTime: Date.now().valueOf(),
      };
      await database.set.member(operatorId, serverId, updatedMember);

      this.socket.emit('serverUpdate', serverId, updatedMember);
      this.socket
        .to(`channel_${channelId}`)
        .emit('playSound', 'recieveChannelMessage');

      this.io.to(`channel_${channelId}`).emit('onMessage', message);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `傳送訊息時發生無法預期的錯誤: ${error.message}`,
          part: 'SEARCHSERVER',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('SendMessage').error(error.message);
    }
  }
}

export class SendDirectMessageHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const {
        userId,
        targetId,
        directMessage: preset,
      } = await new DataValidator(
        SendDirectMessageSchema,
        'SENDDIRECTMESSAGE',
      ).validate(data);

      if (operatorId !== userId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '無法傳送非自己的私訊',
          part: 'SENDDIRECTMESSAGE',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }

      // Create new message
      const directMessage = {
        ...preset,
        ...(await database.get.user(userId)),
        senderId: userId,
        user1Id: userId.localeCompare(targetId) < 0 ? userId : targetId,
        user2Id: userId.localeCompare(targetId) < 0 ? targetId : userId,
        timestamp: Date.now().valueOf(),
      };

      const targetSocket = SocketServer.getSocket(targetId);

      this.socket.emit('onDirectMessage', directMessage);
      if (targetSocket) {
        targetSocket.emit('onDirectMessage', directMessage);
      }
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `傳送私訊時發生無法預期的錯誤: ${error.message}`,
          part: 'SEARCHSERVER',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('SendDirectMessage').error(error.message);
    }
  }
}
