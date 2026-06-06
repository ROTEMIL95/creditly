// Turns backend enum values (SCREAMING_SNAKE_CASE) into friendly display text.
// e.g. "AUCTION_OPENED" -> "Auction opened", "IN_AUCTION" -> "In auction".
// Display-only — the API contract keeps the UPPERCASE values.
export function humanizeEnum(value?: string | null): string {
  if (!value) return '';
  const words = value.toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
