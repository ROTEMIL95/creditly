import type { Context } from 'hono';
import { auctionService } from '../services/auctionService.js';
import { serializeAuction, serializeOffer } from '../serializers/index.js';
import { NotFoundError } from '../lib/errors.js';
import { requireParam } from '../lib/http.js';
import type { AppEnv } from '../types/index.js';

export const auctionController = {
  // POST /accounts/:id/auctions
  async open(c: Context<AppEnv>) {
    const user = c.get('user');
    const auction = await auctionService.openAuction(user, requireParam(c, 'id'));
    if (!auction) throw new NotFoundError('Auction not found');
    return c.json({ auction: serializeAuction(auction, user) }, 201);
  },

  // GET /auctions
  async list(c: Context<AppEnv>) {
    const user = c.get('user');
    const auctions = await auctionService.listAuctions(user);
    return c.json({ auctions: auctions.map((a) => serializeAuction(a, user)) });
  },

  // GET /auctions/:id
  async getById(c: Context<AppEnv>) {
    const user = c.get('user');
    const auction = await auctionService.getAuction(user, requireParam(c, 'id'));
    return c.json({ auction: serializeAuction(auction, user) });
  },

  // POST /auctions/:id/offers
  async submitOffer(c: Context<AppEnv>) {
    const user = c.get('user');
    const { interestRate } = await c.req.json<{ interestRate: number }>();
    const offer = await auctionService.submitOffer(user, requireParam(c, 'id'), interestRate);
    return c.json({ offer: serializeOffer(offer) }, 201);
  },

  // POST /auctions/:id/close
  async close(c: Context<AppEnv>) {
    const user = c.get('user');
    const auction = await auctionService.closeAuction(user, requireParam(c, 'id'));
    if (!auction) throw new NotFoundError('Auction not found');
    return c.json({ auction: serializeAuction(auction, user) });
  },
};
