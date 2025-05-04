import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// Error
import StandardizedError from '@/error';

// Database
import { database } from '@/index';

// Systems
import xpSystem from '@/systems/xp';

// Handlers
import {
  ConnectChannelHandler,
  UpdateChannelHandler,
  UpdateChannelsHandler,
} from '@/api/socket/events/channel/channel.handler';
import {
  RTCJoinHandler,
  RTCLeaveHandler,
} from '@/api/socket/events/rtc/rtc.handler';

export class ConnectChannelService {
  constructor(
    private operatorId: string,
    private userId: string,
    private channelId: string,
    private serverId: string,
    private password?: string,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.channelId = channelId;
    this.serverId = serverId;
    this.password = password;
  }

  async use() {
    const actions: any[] = [];
    const user = await database.get.user(this.userId);
    const server = await database.get.server(this.serverId);
    const channel = await database.get.channel(this.channelId);
    const channelUsers = await database.get.channelUsers(this.channelId);
    const userMember = await database.get.member(this.userId, this.serverId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (!channel.isLobby) {
      if (this.operatorId !== this.userId) {
        if (
          operatorMember.permissionLevel < 5 ||
          operatorMember.permissionLevel <= userMember.permissionLevel
        ) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '你沒有足夠的權限移動其他用戶',
            part: 'CONNECTCHANNEL',
            tag: 'PERMISSION_DENIED',
            statusCode: 403,
          });
        }
        if (channel.visibility === 'readonly') {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '該頻道為唯獨頻道',
            part: 'CONNECTCHANNEL',
            tag: 'CHANNEL_IS_READONLY',
            statusCode: 403,
          });
        }
        if (user.currentChannelId === this.channelId) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '用戶已經在該頻道中',
            part: 'CONNECTCHANNEL',
            tag: 'PERMISSION_DENIED',
            statusCode: 403,
          });
        }
        if (user.currentServerId !== this.serverId) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '用戶不在該語音群中',
            part: 'CONNECTCHANNEL',
            tag: 'PERMISSION_DENIED',
            statusCode: 403,
          });
        }
      } else {
        if (channel.visibility === 'readonly') {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '該頻道為唯獨頻道',
            part: 'CONNECTCHANNEL',
            tag: 'CHANNEL_IS_READONLY',
            statusCode: 403,
          });
        }
        if (
          (server.visibility === 'private' ||
            channel.visibility === 'member') &&
          operatorMember.permissionLevel < 2
        ) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '你需要成為該群組的會員才能加入該頻道',
            part: 'CONNECTCHANNEL',
            tag: 'PERMISSION_DENIED',
            statusCode: 403,
          });
        }
        if (
          channel.password &&
          this.password !== channel.password &&
          operatorMember.permissionLevel < 3
        ) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '你需要輸入正確的密碼才能加入該頻道',
            part: 'CONNECTCHANNEL',
            tag: 'PASSWORD_INCORRECT',
            statusCode: 403,
          });
        }
        if (
          channel.userLimit &&
          channelUsers &&
          channelUsers.length >= channel.userLimit &&
          operatorMember.permissionLevel < 5
        ) {
          throw new StandardizedError({
            name: 'PermissionError',
            message: '該頻道已達人數上限',
            part: 'CONNECTCHANNEL',
            tag: 'CHANNEL_USER_LIMIT_REACHED',
            statusCode: 403,
          });
        }
      }
    }

    // Update user
    const updatedUser = {
      currentServerId: this.serverId,
      currentChannelId: this.channelId,
      lastActiveAt: Date.now(),
    };
    await database.set.user(this.userId, updatedUser);

    // Update Member
    const updatedMember = {
      lastJoinChannelTime: Date.now(),
    };
    await database.set.member(this.userId, this.serverId, updatedMember);

    if (!user.currentChannelId) {
      // Setup user xp interval
      await xpSystem.create(this.userId);
    }

    if (user.currentChannelId) {
      actions.push(async (io: Server, socket: Socket) => {
        await new RTCLeaveHandler(io, socket).handle({
          channelId: user.currentChannelId,
        });
      });
    }

    actions.push(async (io: Server, socket: Socket) => {
      await new RTCJoinHandler(io, socket).handle({
        channelId: this.channelId,
      });
    });

    return {
      userUpdate: updatedUser,
      serverMemberUpdate: { ...updatedUser, ...updatedMember },
      serverUpdate: updatedMember,
      currentChannelId: user.currentChannelId,
      currentServerId: user.currentServerId,
      actions,
    };
  }
}

export class DisconnectChannelService {
  constructor(
    private operatorId: string,
    private userId: string,
    private channelId: string,
    private serverId: string,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.channelId = channelId;
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
      if (user.currentChannelId !== this.channelId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '用戶不在該頻道中',
          part: 'DISCONNECTCHANNEL',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
      if (user.currentServerId !== this.serverId) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '用戶不在該語音群中',
          part: 'DISCONNECTCHANNEL',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
      if (
        operatorMember.permissionLevel < 5 ||
        operatorMember.permissionLevel <= userMember.permissionLevel
      ) {
        throw new StandardizedError({
          name: 'PermissionError',
          message: '你沒有足夠的權限踢除其他用戶',
          part: 'DISCONNECTCHANNEL',
          tag: 'PERMISSION_DENIED',
          statusCode: 403,
        });
      }
    }

    // Update user
    const updatedUser = {
      currentServerId: null,
      currentChannelId: null,
      lastActiveAt: Date.now(),
    };
    await database.set.user(this.userId, updatedUser);

    // Clear user xp interval
    await xpSystem.delete(this.userId);

    actions.push(async (io: Server, socket: Socket) => {
      await new RTCLeaveHandler(io, socket).handle({
        channelId: this.channelId,
      });
    });

    return {
      userUpdate: updatedUser,
      serverMemberUpdate: updatedUser,
      actions,
    };
  }
}

export class CreateChannelService {
  constructor(
    private operatorId: string,
    private serverId: string,
    private channel: any,
  ) {
    this.operatorId = operatorId;
    this.serverId = serverId;
    this.channel = channel;
  }

  async use() {
    const actions: any[] = [];
    const category = await database.get.channel(this.channel.categoryId);
    const serverChannels = await database.get.serverChannels(this.serverId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (operatorMember.permissionLevel < 5) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '你沒有足夠的權限創建頻道',
        part: 'CREATECHANNEL',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    if (category && category.categoryId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法在二級頻道下創建頻道',
        part: 'CREATECHANNEL',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    if (category && !category.categoryId) {
      const channel = {
        type: 'category',
      };
      actions.push(async (io: Server, socket: Socket) => {
        await new UpdateChannelHandler(io, socket).handle({
          channelId: category.channelId,
          serverId: this.serverId,
          channel,
        });
      });
    }

    const categoryChannels = serverChannels?.filter(
      (ch) => ch.categoryId === this.channel.categoryId,
    );

    // Create new channel
    const channelId = uuidv4();
    await database.set.channel(channelId, {
      ...this.channel,
      serverId: this.serverId,
      order: (categoryChannels?.length || 0) + 1, // 1 is for lobby (-1 ~ serverChannels.length - 1)
      createdAt: Date.now(),
    });

    return {
      serverChannelAdd: await database.get.channel(channelId),
      actions,
    };
  }
}

export class UpdateChannelService {
  constructor(
    private operatorId: string,
    private serverId: string,
    private channelId: string,
    private update: any,
  ) {
    this.operatorId = operatorId;
    this.serverId = serverId;
    this.channelId = channelId;
    this.update = update;
  }

  async use() {
    const messages: any[] = [];
    const channel = await database.get.channel(this.channelId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (operatorMember.permissionLevel < 5) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '你沒有足夠的權限編輯頻道',
        part: 'UPDATECHANNEL',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    if (this.update.voiceMode !== channel.voiceMode) {
      messages.push({
        message: {
          type: 'info',
          content:
            this.update.voiceMode === 'free'
              ? 'VOICE_CHANGE_TO_FREE_SPEECH'
              : this.update.voiceMode === 'forbidden'
              ? 'VOICE_CHANGE_TO_FORBIDDEN_SPEECH'
              : 'VOICE_CHANGE_TO_QUEUE',
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.forbidText !== channel.forbidText) {
      messages.push({
        message: {
          type: 'info',
          content: this.update.forbidText
            ? 'TEXT_CHANGE_TO_FORBIDDEN_SPEECH'
            : 'TEXT_CHANGE_TO_FREE_SPEECH',
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.forbidGuestText !== channel.forbidGuestText) {
      messages.push({
        message: {
          type: 'info',
          content: this.update.forbidGuestText
            ? 'TEXT_CHANGE_TO_FORBIDDEN_TEXT'
            : 'TEXT_CHANGE_TO_ALLOWED_TEXT',
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.forbidGuestUrl !== channel.forbidGuestUrl) {
      messages.push({
        message: {
          type: 'info',
          content: this.update.forbidGuestUrl
            ? 'TEXT_CHANGE_TO_FORBIDDEN_URL'
            : 'TEXT_CHANGE_TO_ALLOWED_URL',
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.guestTextMaxLength !== channel.guestTextMaxLength) {
      messages.push({
        message: {
          type: 'info',
          content: `TEXT_CHANGE_TO_MAX_LENGTH ${this.update.guestTextMaxLength}`,
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.guestTextWaitTime !== channel.guestTextWaitTime) {
      messages.push({
        message: {
          type: 'info',
          content: `TEXT_CHANGE_TO_WAIT_TIME ${this.update.guestTextWaitTime}`,
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    if (this.update.guestTextGapTime !== channel.guestTextGapTime) {
      messages.push({
        message: {
          type: 'info',
          content: `TEXT_CHANGE_TO_GAP_TIME ${this.update.guestTextGapTime}`,
          timestamp: Date.now().valueOf(),
        },
        userId: this.operatorId,
        serverId: this.serverId,
        channelId: this.channelId,
      });
    }

    // Update channel
    await database.set.channel(this.channelId, this.update);

    return {
      onMessage: messages,
    };
  }
}

export class DeleteChannelService {
  constructor(
    private operatorId: string,
    private serverId: string,
    private channelId: string,
  ) {
    this.operatorId = operatorId;
    this.serverId = serverId;
    this.channelId = channelId;
  }

  async use() {
    const actions: any[] = [];
    const channel = await database.get.channel(this.channelId);
    const channelUsers = await database.get.channelUsers(this.channelId);
    const serverChannels = await database.get.serverChannels(this.serverId);
    const server = await database.get.server(this.serverId);
    const operatorMember = await database.get.member(
      this.operatorId,
      this.serverId,
    );

    if (operatorMember.permissionLevel < 5) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '你沒有足夠的權限刪除頻道',
        part: 'DELETECHANNEL',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    const channelChildren = serverChannels?.filter(
      (ch) => ch.categoryId === this.channelId,
    );
    const categoryChildren = serverChannels?.filter(
      (ch) => ch.categoryId === channel.categoryId,
    );

    if (categoryChildren && categoryChildren.length <= 1) {
      const categoryUpdate = {
        type: 'channel',
      };
      actions.push(async (io: Server, socket: Socket) => {
        await new UpdateChannelHandler(io, socket).handle({
          channelId: channel.categoryId,
          serverId: this.serverId,
          channel: categoryUpdate,
        });
      });
    }

    if (channelChildren) {
      actions.push(async (io: Server, socket: Socket) => {
        await new UpdateChannelsHandler(io, socket).handle({
          serverId: this.serverId,
          channels: channelChildren.map((child, index) => ({
            channelId: child.channelId,
            channel: {
              categoryId: null,
              order: (categoryChildren?.length || 0) + 1 + index, // 1 is for lobby (-1 ~ serverChannels.length - 1)
            },
          })),
        });
      });
    }

    if (channelUsers) {
      channelUsers.map((user: any) => {
        actions.push(async (io: Server, socket: Socket) => {
          await new ConnectChannelHandler(io, socket).handle({
            channelId: server.lobbyId,
            serverId: this.serverId,
            userId: user.userId,
          });
        });
      });
    }

    // Delete channel
    await database.delete.channel(this.channelId);

    return {
      actions,
    };
  }
}
