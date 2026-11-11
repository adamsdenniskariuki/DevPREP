export type DiscountCode = 'SAVE10' | 'FLAT5';

const CODES: readonly DiscountCode[] = ['SAVE10', 'FLAT5'];

export function parseCode(raw: string): DiscountCode | null {
  const code = raw.trim().toUpperCase();
  return (CODES as readonly string[]).includes(code) ? (code as DiscountCode) : null;
}

/** Cents off a subtotal. SAVE10 is 10% (rounded down), FLAT5 is $5, never more than the subtotal. */
export function discountFor(code: DiscountCode | null, subtotal: number): number {
  if (code === 'SAVE10') return Math.floor(subtotal / 10);
  if (code === 'FLAT5') return Math.min(500, subtotal);
  return 0;
}
