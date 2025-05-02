// Database
import { database } from '@/index';

export class RefreshMemberApplicationService {
  constructor(private userId: string, private serverId: string) {
    this.userId = userId;
    this.serverId = serverId;
  }

  async use() {
    const memberApplication = await database.get.memberApplication(
      this.userId,
      this.serverId,
    );
    return memberApplication;
  }
}
