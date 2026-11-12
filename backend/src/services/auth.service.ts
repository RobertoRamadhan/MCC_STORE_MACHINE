export type SessionUser = {
  id: number;
  username: string;
  role: string;
  nama: string;
  permissions: string[];
};

export class AuthService {
  static verifyToken(token: string | null): SessionUser | null {
    if (!token) return null;

    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as SessionUser;
      return payload;
    } catch {
      return null;
    }
  }

  static createToken(user: SessionUser): string {
    return Buffer.from(JSON.stringify(user)).toString('base64');
  }
}

export default AuthService;
