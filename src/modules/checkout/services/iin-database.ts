import { IINRange } from '../schemas/iin-range';

/**
 * In-memory IIN lookup service.
 * Maps 6-digit IIN prefixes to bank, card type, tier, and network.
 * Load from MongoDB at startup or use in-memory for tests.
 */
export class IINLookupService {
  private ranges: IINRange[] = [];

  loadRanges(ranges: IINRange[]): void {
    this.ranges = ranges;
  }

  lookup(bin: string): IINRange | null {
    if (!bin || bin.length < 6) return null;
    const prefix = bin.substring(0, 6);
    return this.ranges.find(r => r.prefix === prefix) || null;
  }

  findByBank(bankCode: string, tier?: string): IINRange[] {
    return this.ranges.filter(r =>
      r.bank_code === bankCode &&
      (!tier || r.card_tier === tier) &&
      r.status === 'active'
    );
  }

  all(): IINRange[] {
    return this.ranges;
  }
}
