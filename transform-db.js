const { QuickDB } = require('quick.db');
const db = new QuickDB();

// database
const DB = require('./db');

// transform
const transformAccount = async () => {
  const accountPasswords = await db.get('accountPasswords');
  const accountUserIds = await db.get('accountUserIds');

  for (const [key, data] of Object.entries(accountPasswords)) {
    const password = accountPasswords[key];
    const userId = accountUserIds[key];

    if (typeof password != 'string' || typeof userId != 'string') continue;

    await DB.set.account(key, {
      password: password,
      userId: userId,
    });
  }

  console.log('account 轉換完成');
};

const transformUser = async () => {
  const users = await db.get('users');

  for (const [key, user] of Object.entries(users)) {
    const { id: userId, currentServerId, currentChannelId, ...rest } = user;

    await DB.set.user(userId, {
      ...rest,
    });
  }

  console.log('user 轉換完成');
};

const transformBadge = async () => {
  const badges = await db.get('badges');

  for (const [key, badge] of Object.entries(badges)) {
    const { id: badgeId, ...rest } = badge;

    await DB.set.badge(badgeId, {
      ...rest,
    });
  }

  console.log('badge 轉換完成');
};

const transformUserBadge = async () => {
  const userBadges = await db.get('userBadges');

  for (const [key, userBadge] of Object.entries(userBadges)) {
    const { userId, badgeId, id, ...rest } = userBadge;

    await DB.set.userBadge(userId, badgeId, {
      ...rest,
    });
  }

  console.log('userBadge 轉換完成');
};

const transformUserServer = async () => {
  const userServers = await db.get('userServers');

  for (const [key, userServer] of Object.entries(userServers)) {
    const { userId, serverId, id, ...rest } = userServer;

    await DB.set.userServer(userId, serverId, {
      ...rest,
    });
  }

  console.log('userServer 轉換完成');
};

const transformServer = async () => {
  const servers = await db.get('servers');

  for (const [key, server] of Object.entries(servers)) {
    const { id: serverId, lobbyId, ...rest } = server;

    await DB.set.server(serverId, {
      ...rest,
    });
  }

  console.log('server 轉換完成');
};

const transformChannel = async () => {
  const channels = await db.get('channels');

  for (const [key, channel] of Object.entries(channels)) {
    const { id: channelId, ...rest } = channel;

    if (rest.order < 0) rest.order = 0;

    if (!rest.serverId) continue;

    if (!rest.password) rest.password = '';

    if (rest.guestTextMaxLength > 100000000) rest.guestTextMaxLength = 2000;

    await DB.set.channel(channelId, {
      ...rest,
    });
  }
};

const transformLobby = async () => {
  const servers = await db.get('servers');

  for (const [key, server] of Object.entries(servers)) {
    const { id: serverId, lobbyId, ...rest } = server;

    await DB.set.server(serverId, {
      lobbyId: lobbyId,
    });
  }

  console.log('lobby 轉換完成');
};

const transformFriendGroup = async () => {
  const friendGroups = await db.get('friendGroups');

  for (const [key, friendGroup] of Object.entries(friendGroups)) {
    const { id: friendGroupId, ...rest } = friendGroup;

    if (rest.order < 0) rest.order = 0;

    if (typeof rest.createdAt != 'number') rest.createdAt = 0;

    await DB.set.friendGroup(friendGroupId, {
      ...rest,
    });
  }

  console.log('friendGroup 轉換完成');
};

const transformMember = async () => {
  const members = await db.get('members');

  for (const [key, member] of Object.entries(members)) {
    const { userId, serverId, id, ...rest } = member;

    await DB.set.member(userId, serverId, {
      ...rest,
    });
  }

  console.log('member 轉換完成');
};

const transformMemberApplication = async () => {
  const memberApplications = await db.get('memberApplications');

  for (const [key, memberApplication] of Object.entries(memberApplications)) {
    const { userId, serverId, id, applicationStatus, ...rest } =
      memberApplication;

    await DB.set.memberApplication(userId, serverId, {
      ...rest,
    });
  }

  console.log('memberApplication 轉換完成');
};

const transformFriend = async () => {
  const friends = await db.get('friends');
  const friendGroups = await db.get('friendGroups');

  for (const [key, friend] of Object.entries(friends)) {
    const { userId, targetId, id, ...rest } = friend;

    if (!rest.friendGroupId) rest.friendGroupId = null;

    if (!friendGroups[rest.friendGroupId]) rest.friendGroupId = null;

    await DB.set.friend(userId, targetId, {
      ...rest,
    });
  }

  console.log('friend 轉換完成');
};

const transformFriendApplication = async () => {
  const friendApplications = await db.get('friendApplications');

  for (const [key, friendApplication] of Object.entries(friendApplications)) {
    const { senderId, receiverId, id, applicationStatus, ...rest } =
      friendApplication;

    await DB.set.friendApplication(senderId, receiverId, {
      ...rest,
    });
  }

  console.log('friendApplication 轉換完成');
};

const transformMessage = async () => {
  const messages = await db.get('messages');
  const channels = await db.get('channels');

  for (const [key, message] of Object.entries(messages)) {
    const { id: messageId, ...rest } = message;

    if (!rest.serverId) continue;

    if (!channels[rest.channelId].serverId) continue;

    await DB.set.message(messageId, {
      ...rest,
    });
  }

  console.log('message 轉換完成');
};

const transformDirectMessage = async () => {
  const directMessages = await db.get('directMessages');

  for (const [key, directMessage] of Object.entries(directMessages)) {
    const {
      id: directMessageId,
      type,
      userId1,
      userId2,
      ...rest
    } = directMessage;

    rest.user1Id = userId1;
    rest.user2Id = userId2;

    await DB.set.directMessage(directMessageId, {
      ...rest,
    });
  }

  console.log('directMessage 轉換完成');
};

const main = async () => {
  await transformUser();
  await transformAccount();
  await transformBadge();
  await transformServer();
  await transformChannel();
  await transformLobby();
  await transformFriendGroup();
  await transformMessage();
  await transformDirectMessage();
  await transformMember();
  await transformMemberApplication();
  await transformFriend();
  await transformFriendApplication();
  await transformUserBadge();
  await transformUserServer();

  console.log('所有資料轉換完成');
};

main();
