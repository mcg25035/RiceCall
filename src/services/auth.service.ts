// Services
import apiService from '@/services/api.service';
import ipcService from '@/services/ipc.service';

interface LoginFormData {
  account: string;
  password: string;
  rememberAccount: boolean;
  autoLogin: boolean;
}

interface RegisterFormData {
  account: string;
  password: string;
  username: string;
}

interface AccountItem {
  account: string;
  token: string;
  auto: boolean;
  selected: boolean;
}

const getParsed = (): { accounts: AccountItem[]; remembered: string[] } => {
  try {
    return JSON.parse(localStorage.getItem('login-accounts') || '');
  } catch {
    return { accounts: [], remembered: [] };
  }
};

const saveParsed = (data: { accounts: AccountItem[]; remembered: string[] }) =>
  localStorage.setItem('login-accounts', JSON.stringify(data));

export const authService = {
  login: async (data: LoginFormData): Promise<boolean> => {
    const res = await apiService.post('/login', data);
    if (!res?.token) return false;
    localStorage.setItem('token', res.token);
    const parsed = getParsed();
    parsed.accounts = parsed.accounts.map((acc) =>
      acc.account === data.account
        ? {
            ...acc,
            token: data.autoLogin ? res.token : '',
            auto: data.autoLogin,
            selected: true,
          }
        : { ...acc, token: acc.auto ? acc.token : '', selected: false },
    );
    if (!parsed.accounts.find((a) => a.account === data.account)) {
      parsed.accounts.push({
        account: data.account,
        token: data.autoLogin ? res.token : '',
        auto: data.autoLogin,
        selected: true,
      });
    }
    parsed.remembered = data.rememberAccount
      ? Array.from(new Set([...parsed.remembered, data.account]))
      : parsed.remembered.filter((a) => a !== data.account);
    saveParsed(parsed);
    ipcService.auth.login(res.token);
    return true;
  },

  register: async (data: RegisterFormData) => {
    const res = await apiService.post('/register', data);
    return !!res;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('autoLogin');
    ipcService.auth.logout();
    const parsed = getParsed();
    parsed.accounts = parsed.accounts.map((acc) => ({
      ...acc,
      token: acc.auto ? acc.token : '',
    }));
    saveParsed(parsed);
    return true;
  },

  isAutoLoginEnabled: () => localStorage.getItem('autoLogin') === 'true',
  isRememberAccountEnabled: () => !!localStorage.getItem('account'),

  autoLogin: async () => {
    const parsed = getParsed();
    const acc =
      parsed.accounts.find((a) => a.auto && a.selected) ||
      parsed.accounts.find((a) => a.auto);
    if (!acc?.token) return false;
    localStorage.setItem('token', acc.token);
    ipcService.auth.login(acc.token);
    return true;
  },
};

export default authService;
