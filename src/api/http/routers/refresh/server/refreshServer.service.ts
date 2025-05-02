// Database
import { database } from '@/index';

export class RefreshServerService {
  constructor(private serverId: string) {
    this.serverId = serverId;
  }

  async use() {
    const server = await database.get.server(this.serverId);
    return server;
  }
}

export class RefreshServerChannelsService {
  constructor(private serverId: string) {
    this.serverId = serverId;
  }

  async use() {
    const serverChannels = await database.get.serverChannels(this.serverId);
    return serverChannels;
  }
}

export class RefreshServerMemberApplicationsService {
  constructor(private serverId: string) {
    this.serverId = serverId;
  }

  async use() {
    const serverMemberApplications =
      await database.get.serverMemberApplications(this.serverId);
    return serverMemberApplications;
  }
}

export class RefreshServerMembersService {
  constructor(private serverId: string) {
    this.serverId = serverId;
  }

  async use() {
    const serverMembers = await database.get.serverMembers(this.serverId);
    return serverMembers;
  }
}
