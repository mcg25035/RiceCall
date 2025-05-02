// Database
import { database } from '@/index';

export class RefreshMemberService {
  constructor(private userId: string, private serverId: string) {
    this.userId = userId;
    this.serverId = serverId;
  }

  async use() {
    const member = await database.get.member(this.userId, this.serverId);
    return member;
  }
}
