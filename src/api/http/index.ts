import http, { ServerResponse } from 'http';
import { IncomingForm } from 'formidable';

// Error
import StandardizedError from '@/error';

// Utils
import Logger from '@/utils/logger';

// Handlers
import { LoginHandler } from './routers/login/login.handler';
import { RegisterHandler } from './routers/register/register.handler';
import { RefreshChannelHandler } from './routers/refresh/channel/refreshChannel.handler';
import { RefreshFriendHandler } from './routers/refresh/friend/refreshFriend.handler';
import { RefreshFriendApplicationHandler } from './routers/refresh/friendApplication/refreshFriendApplication.handler';
import { RefreshFriendGroupHandler } from './routers/refresh/friendGroup/refreshFriendGroup.handler';
import { RefreshMemberHandler } from './routers/refresh/member/refreshMember.handler';
import { RefreshMemberApplicationHandler } from './routers/refresh/memberApplication/refreshMemberApplication.handler';
import {
  RefreshServerHandler,
  RefreshServerChannelsHandler,
  RefreshServerMemberApplicationsHandler,
  RefreshServerMembersHandler,
} from './routers/refresh/server/refreshServer.handler';
import {
  RefreshUserHandler,
  RefreshUserFriendApplicationsHandler,
  RefreshUserFriendGroupsHandler,
  RefreshUserFriendsHandler,
  RefreshUserServersHandler,
} from './routers/refresh/user/refreshUser.handler';
import { ImagesHandler } from './routers/images/images.handler';
import { UploadHandler } from './routers/upload/upload.handler';

export type ResponseType = {
  statusCode: number;
  message: string;
  data: any;
};

const sendImage = (res: ServerResponse, response: ResponseType) => {
  res.writeHead(200, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Expires': '0',
    'Pragma': 'no-cache',
  });
  res.end(response.data);
};

const sendResponse = (res: ServerResponse, response: ResponseType) => {
  res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response.data));
};

const sendError = (res: ServerResponse, error: StandardizedError) => {
  if (error instanceof StandardizedError) {
    res.writeHead(error.statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  } else {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
};

const sendOptions = (res: ServerResponse) => {
  res.writeHead(200);
  res.end();
};

export default class HttpServer {
  constructor(private port: number) {
    this.port = port;
  }

  setup() {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, PATCH');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );

      if (req.method === 'OPTIONS') {
        sendOptions(res);
        return;
      }

      if (req.method === 'GET') {
        let response: ResponseType | null = null;

        if (req.url?.startsWith('/images')) {
          response = await new ImagesHandler(req).handle();
        }

        if (response) sendImage(res, response);
        return;
      }

      if (req.method === 'POST') {
        let response: ResponseType | null = null;

        if (req.headers['content-type'] === 'application/json') {
          let data = '';

          req.on('data', (chunk) => {
            data += chunk.toString();
          });

          req.on('end', async () => {
            data = JSON.parse(data);

            if (req.url === '/login') {
              response = await new LoginHandler(req).handle(data);
            } else if (req.url === '/register') {
              response = await new RegisterHandler(req).handle(data);
            } else if (req.url === '/refresh/channel') {
              response = await new RefreshChannelHandler(req).handle(data);
            } else if (req.url === '/refresh/friend') {
              response = await new RefreshFriendHandler(req).handle(data);
            } else if (req.url === '/refresh/friendApplication') {
              response = await new RefreshFriendApplicationHandler(req).handle(
                data,
              );
            } else if (req.url === '/refresh/friendGroup') {
              response = await new RefreshFriendGroupHandler(req).handle(data);
            } else if (req.url === '/refresh/member') {
              response = await new RefreshMemberHandler(req).handle(data);
            } else if (req.url === '/refresh/memberApplication') {
              response = await new RefreshMemberApplicationHandler(req).handle(
                data,
              );
            } else if (req.url === '/refresh/server') {
              response = await new RefreshServerHandler(req).handle(data);
            } else if (req.url === '/refresh/serverChannels') {
              response = await new RefreshServerChannelsHandler(req).handle(
                data,
              );
            } else if (req.url === '/refresh/serverMemberApplications') {
              response = await new RefreshServerMemberApplicationsHandler(
                req,
              ).handle(data);
            } else if (req.url === '/refresh/serverMembers') {
              response = await new RefreshServerMembersHandler(req).handle(
                data,
              );
            } else if (req.url === '/refresh/user') {
              response = await new RefreshUserHandler(req).handle(data);
            } else if (req.url === '/refresh/userFriendApplications') {
              response = await new RefreshUserFriendApplicationsHandler(
                req,
              ).handle(data);
            } else if (req.url === '/refresh/userFriendGroups') {
              response = await new RefreshUserFriendGroupsHandler(req).handle(
                data,
              );
            } else if (req.url === '/refresh/userFriends') {
              response = await new RefreshUserFriendsHandler(req).handle(data);
            } else if (req.url === '/refresh/userServers') {
              response = await new RefreshUserServersHandler(req).handle(data);
            }

            if (response) sendResponse(res, response);
            return;
          });
        } else {
          const form = new IncomingForm();

          form.parse(req, async (err, data) => {
            if (err) {
              sendError(res, err);
              return;
            }

            if (req.url === '/upload') {
              response = await new UploadHandler(req).handle(data);
            }

            if (response) sendResponse(res, response);
            return;
          });
        }
      }
    });

    server.listen(this.port, () => {
      new Logger('Server').info(`Server is running on port ${this.port}`);
    });

    server.on('error', (error: any) => {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError({
          name: 'ServerError',
          message: `伺服器發生預期外的錯誤: ${error.message}`,
          part: 'SERVER',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      }
      new Logger('Server').error(`Server error: ${error.error_message}`);
    });

    return server;
  }
}
