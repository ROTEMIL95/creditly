// Pure auction domain logic — no I/O, fully unit-testable.

export interface OfferLike {
  id: string;
  interestRate: { toString(): string } | number | string;
  createdAt: Date;
}

const toRate = (v: OfferLike['interestRate']): number => Number(v.toString());

// Winner = lowest interest rate. Deterministic tie-break:
// lower rate → earlier submission → lower id (stable & reproducible).
export function selectWinningOffer<T extends OfferLike>(offers: readonly T[]): T | null {
  if (offers.length === 0) return null;

  return offers.reduce((best, offer) => {
    const a = toRate(offer.interestRate);
    const b = toRate(best.interestRate);
    if (a !== b) return a < b ? offer : best;

    const ta = offer.createdAt.getTime();
    const tb = best.createdAt.getTime();
    if (ta !== tb) return ta < tb ? offer : best;

    return offer.id < best.id ? offer : best;
  });
}
