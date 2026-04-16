import { timedFetch, type TimedFetchResult } from './timedFetch';

export type LoginBody = { email: string; password: string };

export type UserFromLogin = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type LoginResponse = {
  user: UserFromLogin;
  token: string;
};

export type AddUserBody = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type ContactBody = {
  firstName: string;
  lastName: string;
  birthdate: string;
  email: string;
  phone: string;
  street1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  street2?: string;
};

export class ContactListApi {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async addUser(body: AddUserBody): Promise<TimedFetchResult> {
    return timedFetch(this.url('/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async login(body: LoginBody): Promise<TimedFetchResult> {
    return timedFetch(this.url('/users/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async patchMe(token: string, body: Record<string, unknown>): Promise<TimedFetchResult> {
    return timedFetch(this.url('/users/me'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async addContact(token: string, body: ContactBody): Promise<TimedFetchResult> {
    return timedFetch(this.url('/contacts'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async deleteMe(token: string): Promise<TimedFetchResult> {
    return timedFetch(this.url('/users/me'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export function redactToken(obj: unknown): unknown {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k.toLowerCase() === 'token' || k.toLowerCase() === 'authorization') {
        out[k] = '[REDACTED]';
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  };
  return walk(obj);
}
