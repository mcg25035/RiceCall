import http from 'http';
import { Server, Socket } from 'socket.io';

// Error
import StandardizedError from '@/error';

// Validators
import AuthValidator from '@/middleware/auth.validator';

// Handlers
import {
  ConnectUserHandler,
  DisconnectUserHandler,
  SearchUserHandler,
  UpdateUserHandler,
} from '@/api/socket/events/user/user.handler';
import {
  ConnectServerHandler,
  CreateServerHandler,
  DisconnectServerHandler,
  SearchServerHandler,
  UpdateServerHandler,
} from '@/api/socket/events/server/server.handler';
import {
  ConnectChannelHandler,
  DisconnectChannelHandler,
  CreateChannelHandler,
  UpdateChannelsHandler,
  UpdateChannelHandler,
  DeleteChannelHandler,
} from '@/api/socket/events/channel/channel.handler';
import {
  CreateFriendGroupHandler,
  DeleteFriendGroupHandler,
  UpdateFriendGroupHandler,
} from '@/api/socket/events/friendGroup/friendGroup.handler';
import {
  CreateFriendHandler,
  UpdateFriendHandler,
  DeleteFriendHandler,
} from '@/api/socket/events/friend/friend.handler';
import {
  CreateMemberApplicationHandler,
  UpdateMemberApplicationHandler,
  DeleteMemberApplicationHandler,
} from '@/api/socket/events/memberApplication/memberApplication.handler';
import {
  CreateMemberHandler,
  DeleteMemberHandler,
  UpdateMemberHandler,
} from '@/api/socket/events/member/member.handler';
import {
  CreateFriendApplicationHandler,
  UpdateFriendApplicationHandler,
  DeleteFriendApplicationHandler,
} from '@/api/socket/events/friendApplication/friendApplication.handler';
import {
  SendMessageHandler,
  SendDirectMessageHandler,
  ShakeWindowHandler,
} from '@/api/socket/events/message/message.handler';
import {
  RTCOfferHandler,
  RTCAnswerHandler,
  RTCCandidateHandler,
} from '@/api/socket/events/rtc/rtc.handler';

export default class SocketServer {
  static io: Server;
  static socket: Socket;
  static userSocketMap: Map<string, string> = new Map(); // userId -> socketId

  constructor(private server: http.Server) {
    this.server = server;
  }

  static getSocket(userId: string) {
    const socketId = SocketServer.userSocketMap.get(userId);

    if (!socketId) return null;

    const socket = SocketServer.io.sockets.sockets.get(socketId);

    if (!socket) return null;

    return socket;
  }

  setup() {
    const io = new Server(this.server, {
      cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST'],
      },
    });

    io.use(async (socket: Socket, next: (err?: StandardizedError) => void) => {
      try {
        const { token } = socket.handshake.query;

        const userId = await new AuthValidator(token as string).validate();

        socket.data.userId = userId;

        if (SocketServer.userSocketMap.has(userId)) {
          const socketId = SocketServer.userSocketMap.get(userId);

          if (socketId) {
            io.to(socketId).emit('openPopup', {
              type: 'dialogAlert',
              id: 'logout',
              initialData: {
                title: '另一個設備已登入，請重新登入',
                submitTo: 'logout',
              },
            });
            io.to(socketId).disconnectSockets();
          }
        }

        return next();
      } catch (error: any) {
        if (!(error instanceof StandardizedError)) {
          error = new StandardizedError({
            name: 'ServerError',
            message: `驗證時發生無法預期的錯誤: ${error.message}`,
            part: 'AUTH',
            tag: 'EXCEPTION_ERROR',
            statusCode: 500,
          });
        }

        io.to(socket.id).emit('openPopup', {
          type: 'dialogAlert',
          id: 'logout',
          initialData: {
            title: error.message || '發生錯誤，請重新登入',
            submitTo: 'logout',
          },
        });
        io.to(socket.id).disconnectSockets();

        return next(error);
      }
    });

    io.on('connection', async (socket: Socket) => {
      SocketServer.userSocketMap.set(socket.data.userId, socket.id);
      await new ConnectUserHandler(io, socket).handle();

      socket.on('disconnect', async () => {
        SocketServer.userSocketMap.delete(socket.data.userId);
        await new DisconnectUserHandler(io, socket).handle();
      });

      // User
      socket.on(
        'searchUser',
        async (data) => await new SearchUserHandler(io, socket).handle(data),
      );
      socket.on('updateUser', async (data) => {
        await new UpdateUserHandler(io, socket).handle(data);
      });

      // Server
      socket.on('searchServer', async (data) => {
        await new SearchServerHandler(io, socket).handle(data);
      });
      socket.on('connectServer', async (data) => {
        await new ConnectServerHandler(io, socket).handle(data);
      });
      socket.on('disconnectServer', async (data) => {
        await new DisconnectServerHandler(io, socket).handle(data);
      });
      socket.on('createServer', async (data) => {
        await new CreateServerHandler(io, socket).handle(data);
      });
      socket.on('updateServer', async (data) => {
        await new UpdateServerHandler(io, socket).handle(data);
      });

      // Channel
      socket.on('connectChannel', async (data) => {
        await new ConnectChannelHandler(io, socket).handle(data);
      });
      socket.on('disconnectChannel', async (data) => {
        await new DisconnectChannelHandler(io, socket).handle(data);
      });
      socket.on('createChannel', async (data) => {
        await new CreateChannelHandler(io, socket).handle(data);
      });
      socket.on('updateChannel', async (data) => {
        await new UpdateChannelHandler(io, socket).handle(data);
      });
      socket.on(
        'updateChannels',
        async (data) =>
          await new UpdateChannelsHandler(io, socket).handle(data),
      );
      socket.on('deleteChannel', async (data) => {
        await new DeleteChannelHandler(io, socket).handle(data);
      });

      // Friend Group
      socket.on('createFriendGroup', async (data) => {
        await new CreateFriendGroupHandler(io, socket).handle(data);
      });
      socket.on('updateFriendGroup', async (data) => {
        await new UpdateFriendGroupHandler(io, socket).handle(data);
      });
      socket.on('deleteFriendGroup', async (data) => {
        await new DeleteFriendGroupHandler(io, socket).handle(data);
      });

      // Member
      socket.on('createMember', async (data) => {
        await new CreateMemberHandler(io, socket).handle(data);
      });
      socket.on('updateMember', async (data) => {
        await new UpdateMemberHandler(io, socket).handle(data);
      });
      socket.on('deleteMember', async (data) => {
        await new DeleteMemberHandler(io, socket).handle(data);
      });

      // Member Application
      socket.on('createMemberApplication', async (data) => {
        await new CreateMemberApplicationHandler(io, socket).handle(data);
      });
      socket.on('updateMemberApplication', async (data) => {
        await new UpdateMemberApplicationHandler(io, socket).handle(data);
      });
      socket.on('deleteMemberApplication', async (data) => {
        await new DeleteMemberApplicationHandler(io, socket).handle(data);
      });

      // Friend
      socket.on('createFriend', async (data) => {
        await new CreateFriendHandler(io, socket).handle(data);
      });
      socket.on('updateFriend', async (data) => {
        await new UpdateFriendHandler(io, socket).handle(data);
      });
      socket.on('deleteFriend', async (data) => {
        await new DeleteFriendHandler(io, socket).handle(data);
      });

      // Friend Application
      socket.on('createFriendApplication', async (data) => {
        await new CreateFriendApplicationHandler(io, socket).handle(data);
      });
      socket.on('updateFriendApplication', async (data) => {
        await new UpdateFriendApplicationHandler(io, socket).handle(data);
      });
      socket.on('deleteFriendApplication', async (data) => {
        await new DeleteFriendApplicationHandler(io, socket).handle(data);
      });

      // Message
      socket.on('message', async (data) => {
        await new SendMessageHandler(io, socket).handle(data);
      });
      socket.on('directMessage', async (data) => {
        await new SendDirectMessageHandler(io, socket).handle(data);
      });
      socket.on('shakeWindow', async (data) => {
        await new ShakeWindowHandler(io, socket).handle(data);
      });

      // RTC
      socket.on('RTCOffer', async (data) => {
        await new RTCOfferHandler(io, socket).handle(data);
      });
      socket.on('RTCAnswer', async (data) => {
        await new RTCAnswerHandler(io, socket).handle(data);
      });
      socket.on('RTCIceCandidate', async (data) => {
        await new RTCCandidateHandler(io, socket).handle(data);
      });

      // Echo
      socket.on('ping', async () => {
        socket.emit('pong');
      });
    });

    SocketServer.io = io;

    return io;
  }
}
