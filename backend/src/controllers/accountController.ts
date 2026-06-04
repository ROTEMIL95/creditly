import type { Context } from 'hono';
import { accountService } from '../services/accountService.js';
import { serializeAccount, serializeAuction, serializeEvent } from '../serializers/index.js';
import { requireParam } from '../lib/http.js';
import type { AppEnv } from '../types/index.js';

export const accountController = {
  async list(c: Context<AppEnv>) {
    const user = c.get('user');
    const accounts = await accountService.list(user);
    return c.json({ accounts: accounts.map(serializeAccount) });
  },

  async getById(c: Context<AppEnv>) {
    const user = c.get('user');
    const { account, events } = await accountService.getById(user, requireParam(c, 'id'));

    return c.json({
      account: serializeAccount(account),
      auctions: (account.auctions ?? []).map((a) => serializeAuction(a, user)),
      events: events.map(serializeEvent),
    });
  },
};
