// Error
import StandardizedError from '@/error';

// Utils
import Logger from '@/utils/logger';

// Schemas
import {
  ConnectChannelSchema,
  CreateChannelSchema,
  DeleteChannelSchema,
  DisconnectChannelSchema,
  UpdateChannelsSchema,
  UpdateChannelSchema,
} from '@/api/socket/events/channel/channel.schema';

// Middleware
import DataValidator from '@/middleware/data.validator';

// Services
import {
  ConnectChannelService,
  DisconnectChannelService,
  CreateChannelService,
  UpdateChannelService,
  DeleteChannelService,
} from '@/api/socket/events/channel/channel.service';

// Handler
import { SocketHandler } from '@/api/socket/base.handler';

// Socket
import SocketServer from '@/api/socket';

export class ConnectChannelHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { userId, channelId, serverId, password } = await new DataValidator(
        ConnectChannelSchema,
        'CONNECTCHANNEL',
      ).validate(data);

      const {
        userUpdate,
        serverMemberUpdate,
        serverUpdate,
        currentChannelId,
        currentServerId,
      } = await new ConnectChannelService(
        operatorId,
        userId,
        channelId,
        serverId,
        password,
      ).use();

      const targetSocket =
        operatorId === userId ? this.socket : SocketServer.getSocket(userId);

      if (targetSocket) {
        if (currentChannelId) {
          targetSocket.leave(`channel_${currentChannelId}`);
          targetSocket
            .to(`channel_${currentChannelId}`)
            .emit('playSound', 'leave');
          targetSocket.to(`channel_${currentChannelId}`).emit('RTCLeave', {
            from: targetSocket.id,
            userId: userId,
          });
        }
        targetSocket.emit('userUpdate', userUpdate);
        targetSocket.emit('serverUpdate', serverId, serverUpdate);
        targetSocket.join(`channel_${channelId}`);
        targetSocket.to(`channel_${channelId}`).emit('playSound', 'join');
        targetSocket.to(`channel_${channelId}`).emit('RTCJoin', {
          from: targetSocket.id,
          userId: userId,
        });
      }

      if (currentServerId) {
        this.io
          .to(`server_${currentServerId}`)
          .emit(
            'serverMemberUpdate',
            userId,
            currentServerId,
            serverMemberUpdate,
          );
      }
      this.io
        .to(`server_${serverId}`)
        .emit('serverMemberUpdate', userId, serverId, serverMemberUpdate);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `連接頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'CONNECTCHANNEL',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}

export class DisconnectChannelHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { userId, channelId, serverId } = await new DataValidator(
        DisconnectChannelSchema,
        'DISCONNECTCHANNEL',
      ).validate(data);

      const { userUpdate, serverMemberUpdate } =
        await new DisconnectChannelService(
          operatorId,
          userId,
          channelId,
          serverId,
        ).use();

      const targetSocket =
        operatorId === userId ? this.socket : SocketServer.getSocket(userId);

      if (targetSocket) {
        targetSocket.emit('userUpdate', userUpdate);
        targetSocket.leave(`channel_${channelId}`);
        targetSocket.to(`channel_${channelId}`).emit('playSound', 'leave');
        targetSocket.to(`channel_${channelId}`).emit('RTCLeave', {
          from: targetSocket.id,
          userId: userId,
        });
      }

      this.io
        .to(`server_${serverId}`)
        .emit('serverMemberUpdate', userId, serverId, serverMemberUpdate);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `離開頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'DISCONNECTCHANNEL',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}

export class CreateChannelHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { serverId, channel } = await new DataValidator(
        CreateChannelSchema,
        'CREATECHANNEL',
      ).validate(data);

      const { serverChannelAdd, actions } = await new CreateChannelService(
        operatorId,
        serverId,
        channel,
      ).use();

      this.io
        .to(`server_${serverId}`)
        .emit('serverChannelAdd', serverChannelAdd);

      await Promise.all(actions.map((action) => action(this.io, this.socket)));
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `建立頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'CREATECHANNEL',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}

export class UpdateChannelHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { channelId, serverId, channel } = await new DataValidator(
        UpdateChannelSchema,
        'UPDATECHANNEL',
      ).validate(data);

      const { onMessages } = await new UpdateChannelService(
        operatorId,
        serverId,
        channelId,
        channel,
      ).use();

      this.io.to(`channel_${channelId}`).emit('onMessage', ...onMessages);
      this.io
        .to(`server_${serverId}`)
        .emit('serverChannelUpdate', channelId, channel);
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `更新頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'UPDATECHANNEL',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}

export class UpdateChannelsHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const { serverId, channels } = await new DataValidator(
        UpdateChannelsSchema,
        'UPDATECHANNELS',
      ).validate(data);

      await Promise.all(
        channels.map(async (channel: any) => {
          await new UpdateChannelHandler(this.io, this.socket).handle({
            serverId,
            channelId: channel.channelId,
            channel: channel.channel,
          });
        }),
      );
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `更新頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'UPDATECHANNELS',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}

export class DeleteChannelHandler extends SocketHandler {
  async handle(data: any) {
    try {
      const operatorId = this.socket.data.userId;

      const { channelId, serverId } = await new DataValidator(
        DeleteChannelSchema,
        'DELETECHANNEL',
      ).validate(data);

      const { actions } = await new DeleteChannelService(
        operatorId,
        serverId,
        channelId,
      ).use();

      this.io.to(`server_${serverId}`).emit('serverChannelDelete', channelId);

      await Promise.all(actions.map((action) => action(this.io, this.socket)));
    } catch (error: any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `刪除頻道時發生無法預期的錯誤: ${error.message}`,
          part: 'DELETECHANNEL',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }

      this.socket.emit('error', error);
      new Logger('Channel').error(error.message);
    }
  }
}
