/**
 * 本測試專注於測試 socket/member.js 中的事件處理流程。
 *
 * 策略：
 * 1. 模擬所有外部依賴（utils），專注測試 member.js 中的流程
 * 2. 每個事件流程都有測試正常流程和異常情況
 * 3. 驗證每個流程是否正確回應並發送適當事件
 *
 * 覆蓋範圍：
 * - createMember
 * - updateMember
 *
 * 模擬對象：
 * - 所有資料庫操作 (DB.get, DB.set) 均被模擬，預設成功
 * - 使用者驗證 (Func.validate) 邏輯被模擬，預設成功
 * - Socket.IO 事件發送被模擬，預設成功
 */

// __tests__/socket/member.test.js
// 讀取共用 mock 物件
const { createMocks } = require('../_testSetup');
const { mockUtils, mockDB } = createMocks();

// 在當前 jest 環境中 mock 相關依賴
jest.mock('../../utils', () => mockUtils);
jest.mock('../../db', () => mockDB);
jest.mock('../../standardizedError');

// 此時 utils 和 DB 已經被 mock 過
const utils = require('../../utils');
const DB = require('../../db');
const StandardizedError = require('../../standardizedError');

// 真正要測試的模組
const memberHandler = require('../../socket/member');

// 初始化測試用的模擬物件
const mockSocket = {
  id: 'socket-id-123',
  userId: 'user-id-123',
  join: jest.fn(),
  leave: jest.fn(),
};

const mockIo = {
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
  sockets: {
    sockets: new Map([['socket-id-123', mockSocket]]),
  },
};

// 初始化測試資料
const mockUser = {
  id: 'user-id-123',
  username: 'testuser',
  currentServerId: 'server-id-123',
  currentChannelId: 'channel-id-123',
  lastActiveAt: Date.now(),
};

const mockServer = {
  id: 'server-id-123',
  name: '測試伺服器',
  slogan: '這是一個測試伺服器',
  visibility: 'public',
  lobbyId: 'channel-id-123',
  ownerId: 'user-id-123',
  createdAt: Date.now(),
};

const mockMember = {
  id: 'mb_user-id-123-server-id-123',
  userId: 'user-id-123',
  serverId: 'server-id-123',
  permissionLevel: 6,
  nickname: '測試暱稱',
  createdAt: Date.now(),
};

const mockOperator = {
  id: 'user-id-456',
  username: 'operatoruser',
  currentServerId: 'server-id-123',
};

const mockOperatorMember = {
  id: 'mb_user-id-456-server-id-123',
  userId: 'user-id-456',
  serverId: 'server-id-123',
  permissionLevel: 6,
};

describe('成員 Socket 處理器', () => {
  // 在每個測試前重置 mock 並設置常用的默認值
  beforeEach(() => {
    jest.clearAllMocks();

    // 為 StandardizedError 設置模擬行為
    StandardizedError.mockImplementation(
      (message, type, source, code, status) => {
        return {
          error_message: message,
          error_type: type,
          error_source: source,
          error_code: code,
          status_code: status,
        };
      },
    );

    // 默認設置常用的 mock 行為
    utils.Func.validate.socket.mockResolvedValue('user-id-456');
    utils.Func.validate.member.mockImplementation((member) => member);
    DB.get.user.mockImplementation(async (id) => {
      if (id === 'user-id-123') return mockUser;
      if (id === 'user-id-456') return mockOperator;
      return null;
    });
    DB.get.server.mockResolvedValue(mockServer);
    DB.get.member.mockImplementation(async (userId, serverId) => {
      if (userId === 'user-id-123' && serverId === 'server-id-123')
        return mockMember;
      if (userId === 'user-id-456' && serverId === 'server-id-123')
        return mockOperatorMember;
      return null;
    });
    DB.get.serverMembers.mockResolvedValue([mockMember, mockOperatorMember]);
    DB.get.serverUsers.mockResolvedValue([mockUser, mockOperator]);
    DB.set.member.mockImplementation(async (userId, serverId, data) => ({
      id: `mb_${userId}-${serverId}`,
      ...data,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMember', () => {
    it('應該成功創建成員', async () => {
      // 條件：管理員創建普通成員，權限許可
      const newMember = {
        permissionLevel: 3,
        nickname: '新成員',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證關鍵操作執行，不檢查具體參數
      expect(utils.Func.validate.socket).toHaveBeenCalled();
      expect(utils.Func.validate.member).toHaveBeenCalled();
      expect(DB.set.member).toHaveBeenCalled();

      // 驗證事件發送，不檢查具體參數
      expect(mockIo.to).toHaveBeenCalled();
      expect(mockIo.to().emit).toHaveBeenCalled();
    });

    it('應該允許用戶創建自己的遊客身份', async () => {
      // 條件：用戶為自己創建遊客身份（權限等級1）
      utils.Func.validate.socket.mockResolvedValue('user-id-123');
      DB.get.server.mockResolvedValue({
        ...mockServer,
        ownerId: 'user-id-456', // 讓伺服器擁有者不是自己
      });
      const newMember = {
        permissionLevel: 1,
        nickname: '遊客',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證關鍵操作執行，不檢查具體參數
      expect(DB.set.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalled();
      expect(mockIo.to().emit).toHaveBeenCalled();
    });

    it('應該允許伺服器擁有者自行創建擁有者身份', async () => {
      // 條件：伺服器擁有者為自己創建擁有者身份（權限等級6）
      utils.Func.validate.socket.mockResolvedValue('user-id-123');
      DB.get.server.mockResolvedValue({
        ...mockServer,
        ownerId: 'user-id-123',
      });
      const newMember = {
        permissionLevel: 6,
        nickname: '擁有者',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證關鍵操作執行，不檢查具體參數
      expect(DB.set.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalled();
    });

    it('應該在非擁有者嘗試創建擁有者身份時拋出錯誤', async () => {
      // 條件：普通管理員嘗試創建擁有者身份（權限等級6）
      const newMember = {
        permissionLevel: 6,
        nickname: '假擁有者',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在嘗試創建權限高於自己的成員時拋出錯誤', async () => {
      // 條件：權限等級5的管理員嘗試創建權限等級5的成員
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 };
        }
        return null;
      });

      const newMember = {
        permissionLevel: 5,
        nickname: '同等權限',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在權限不足時拋出錯誤', async () => {
      // 條件：權限等級3的管理員嘗試創建新成員
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 3 };
        }
        return null;
      });

      const newMember = {
        permissionLevel: 2,
        nickname: '新成員',
      };

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: newMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在資料無效時拋出錯誤', async () => {
      // 條件：缺少必要資料
      await memberHandler.createMember(mockIo, mockSocket, {
        // 缺少 userId, serverId 或 member
        userId: 'user-id-123',
        // 缺少 serverId
        member: { permissionLevel: 2 },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在資料驗證失敗時拋出錯誤', async () => {
      // 條件：成員資料驗證失敗
      utils.Func.validate.member.mockImplementation(() => {
        throw new Error('無效的成員資料');
      });

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { permissionLevel: 2 },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在目標用戶不存在時拋出錯誤', async () => {
      // 條件：要創建成員的用戶不存在
      DB.get.user.mockImplementation(async (id) => {
        if (id === 'user-id-456') return mockOperator; // 操作者存在
        return null; // 目標用戶不存在
      });

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { permissionLevel: 2, nickname: '新成員' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在伺服器不存在時拋出錯誤', async () => {
      // 條件：要創建成員的伺服器不存在
      DB.get.server.mockResolvedValue(null);

      await memberHandler.createMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { permissionLevel: 2, nickname: '新成員' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });
  });

  describe('updateMember', () => {
    it('應該成功更新成員', async () => {
      // 條件：管理員更新普通成員，權限許可

      // 設置 mock 行為
      const editedMember = {
        nickname: '更新的暱稱',
      };

      utils.Func.validate.socket.mockResolvedValue('user-id-456');
      utils.Func.validate.member.mockResolvedValue(editedMember);

      // 模擬較低權限的成員，這樣操作者才能更新
      const mockLowerMember = {
        ...mockMember,
        permissionLevel: 3, // 較低的權限等級
      };

      DB.get.user.mockImplementation(async (id) => {
        if (id === 'user-id-123') return mockUser;
        if (id === 'user-id-456') return mockOperator;
        return null;
      });

      DB.get.server.mockResolvedValue(mockServer);

      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return mockLowerMember;
        }
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 }; // 管理員有較高權限
        }
        return null;
      });

      // 確保 set.member 被模擬並可被追蹤
      DB.set.member.mockClear();
      DB.set.member.mockResolvedValue({ ...mockLowerMember, ...editedMember });

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證關鍵操作執行，不檢查具體參數
      expect(DB.set.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalled();
      expect(mockIo.to().emit).toHaveBeenCalled();
    });

    it('應該允許用戶更新自己的資料但不能更改權限', async () => {
      // 條件：用戶嘗試更新自己的暱稱並同時更改權限
      utils.Func.validate.socket.mockResolvedValue('user-id-123');

      const editedMember = {
        nickname: '自己更新的暱稱',
        permissionLevel: 5, // 嘗試提升自己的權限
      };

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該允許高權限管理員更新成員權限', async () => {
      // 條件：權限等級5的管理員更新成員的權限
      // 設置 mock 行為
      const editedMember = {
        permissionLevel: 3,
      };

      utils.Func.validate.socket.mockResolvedValue('user-id-456');
      utils.Func.validate.member.mockResolvedValue(editedMember);

      DB.get.user.mockImplementation(async (id) => {
        if (id === 'user-id-123') return mockUser;
        if (id === 'user-id-456') return mockOperator;
        return null;
      });

      DB.get.server.mockResolvedValue(mockServer);

      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return { ...mockMember, permissionLevel: 4 }; // 普通成員
        }
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 }; // 管理員
        }
        return null;
      });

      // 確保 set.member 被模擬並可被追蹤
      DB.set.member.mockClear();
      DB.set.member.mockResolvedValue({ ...mockMember, permissionLevel: 3 });

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證關鍵操作執行，不檢查具體參數
      expect(DB.set.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalled();
      expect(mockIo.to().emit).toHaveBeenCalled();
    });

    it('應該拒絕權限不足的管理員更新成員暱稱', async () => {
      // 條件：權限等級3的管理員嘗試更新成員的暱稱
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 3 };
        }
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return mockMember;
        }
        return null;
      });

      const editedMember = {
        nickname: '嘗試更新的暱稱',
      };

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該拒絕將成員權限設置為高於操作者的權限', async () => {
      // 條件：權限等級5的管理員嘗試將成員權限設為6
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 };
        }
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return { ...mockMember, permissionLevel: 4 };
        }
        return null;
      });

      const editedMember = {
        permissionLevel: 6,
      };

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該拒絕更新群組創建者的權限', async () => {
      // 條件：嘗試更新權限等級為6的成員
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 };
        }
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return { ...mockMember, permissionLevel: 6 };
        }
        return null;
      });

      const editedMember = {
        permissionLevel: 5,
      };

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在資料無效時拋出錯誤', async () => {
      // 條件：缺少必要資料
      await memberHandler.updateMember(mockIo, mockSocket, {
        // 缺少 userId
        serverId: 'server-id-123',
        member: { nickname: '測試' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在依賴服務拋出異常時妥善處理', async () => {
      // This test will need to be updated since there are issues with the mock behavior
      // 條件：資料庫操作拋出異常

      utils.Func.validate.socket.mockResolvedValue('user-id-456');
      utils.Func.validate.member.mockReturnValue({ nickname: '更新的暱稱' });
      DB.get.user.mockImplementation(async (id) => {
        if (id === 'user-id-123') return mockUser;
        if (id === 'user-id-456') return mockOperator;
        return null;
      });
      DB.get.server.mockResolvedValue(mockServer);
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return { ...mockMember, permissionLevel: 3 }; // 使用權限較低的普通成員
        }
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return { ...mockOperatorMember, permissionLevel: 5 };
        }
        return null;
      });

      // 模擬 set.member 拋出錯誤
      DB.set.member.mockImplementation(() => {
        throw new Error('資料庫連接錯誤');
      });

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { nickname: '更新的暱稱' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
    });

    it('應該拒絕將會員更改為非會員', async () => {
      // 條件：嘗試將現有會員變更為非會員
      const editedMember = {
        permissionLevel: 1, // 非會員權限
      };

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: editedMember,
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在要更新的成員不存在時拋出錯誤', async () => {
      // 條件：要更新的成員不存在
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-456' && serverId === 'server-id-123') {
          return mockOperatorMember; // 操作者是成員
        }
        return null; // 目標成員不存在
      });

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { nickname: '更新的暱稱' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(utils.Func.validate.socket).toHaveBeenCalled();
      expect(DB.get.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });

    it('應該在操作者不是伺服器成員時拋出錯誤', async () => {
      // 條件：操作者不是伺服器成員
      DB.get.member.mockImplementation(async (userId, serverId) => {
        if (userId === 'user-id-123' && serverId === 'server-id-123') {
          return mockMember; // 目標用戶是成員
        }
        return null; // 操作者不是成員
      });

      await memberHandler.updateMember(mockIo, mockSocket, {
        userId: 'user-id-123',
        serverId: 'server-id-123',
        member: { nickname: '更新的暱稱' },
      });

      // 驗證錯誤處理，不檢查具體錯誤內容
      expect(utils.Func.validate.socket).toHaveBeenCalled();
      expect(DB.get.member).toHaveBeenCalled();
      expect(mockIo.to).toHaveBeenCalledWith('socket-id-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith(
        'error',
        expect.any(Object),
      );
      expect(DB.set.member).not.toHaveBeenCalled();
    });
  });
});
