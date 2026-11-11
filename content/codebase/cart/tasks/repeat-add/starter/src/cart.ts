import { discountFor, parseCode, type DiscountCode } from './discounts';
import { formatCents } from './money';

export interface LineItem {
  sku: string;
  name: string;
  unitCents: number;
  qty: number;
}

export class Cart {
  private lines: LineItem[] = [];
  private code: DiscountCode | null = null;

  add(sku: string, name: string, unitCents: number, qty = 1): void {
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('quantity must be a positive whole number');
    const existing = this.lines.find((line) => line.sku === sku);
    if (existing) existing.qty = qty;
    else this.lines.push({ sku, name, unitCents, qty });
  }

  remove(sku: string): void {
    this.lines = this.lines.filter((line) => line.sku !== sku);
  }

  applyCode(raw: string): void {
    const code = parseCode(raw);
    if (!code) throw new Error(`unknown code: ${raw}`);
    this.code = code;
  }

  items(): LineItem[] {
    return this.lines.map((line) => ({ ...line }));
  }

  subtotal(): number {
    return this.lines.reduce((sum, line) => sum + line.unitCents * line.qty, 0);
  }

  total(): number {
    const subtotal = this.subtotal();
    return Math.max(0, subtotal - discountFor(this.code, subtotal));
  }

  receipt(): string {
    const rows = this.lines.map((line) => `${line.qty} x ${line.name}  ${formatCents(line.unitCents * line.qty)}`);
    return [...rows, `Total  ${formatCents(this.total())}`].join('\n');
  }
}
