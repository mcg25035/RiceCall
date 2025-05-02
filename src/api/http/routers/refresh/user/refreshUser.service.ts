// Database
import { database } from '@/index';

export class RefreshUserService {
  constructor(private userId: string) {
    this.userId = userId;
  }

  async use() {
    const user = await database.get.user(this.userId);
    return user;
  }
}

export class RefreshUserFriendApplicationsService {
  constructor(private userId: string) {
    this.userId = userId;
  }

  async use() {
    const userFriendApplications = await database.get.userFriendApplications(
      this.userId,
    );
    return userFriendApplications;
  }
}

export class RefreshUserFriendGroupsService {
  constructor(private userId: string) {
    this.userId = userId;
  }

  async use() {
    const userFriendGroups = await database.get.userFriendGroups(this.userId);
    return userFriendGroups;
  }
}

export class RefreshUserFriendsService {
  constructor(private userId: string) {
    this.userId = userId;
  }

  async use() {
    const userFriends = await database.get.userFriends(this.userId);
    return userFriends;
  }
}

export class RefreshUserServersService {
  constructor(private userId: string) {
    this.userId = userId;
  }

  async use() {
    const userServers = await database.get.userServers(this.userId);
    return userServers;
  }
}
