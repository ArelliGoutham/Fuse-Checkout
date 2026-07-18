import { CustomerContextSchema } from './customer';

describe('CustomerContextSchema', () => {
  it('parses a full customer context', () => {
    const ctx = {
      customer_id: 'cust_123',
      segments: ['new', 'returning'],
      total_orders: 3,
      per_customer_used: 1,
    };
    expect(CustomerContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('parses with empty segments and zero orders (new customer)', () => {
    const ctx = {
      customer_id: 'cust_new',
      segments: [],
      total_orders: 0,
      per_customer_used: 0,
    };
    expect(CustomerContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('rejects negative total_orders', () => {
    expect(() => CustomerContextSchema.parse({
      customer_id: 'cust_1', segments: [], total_orders: -1, per_customer_used: 0,
    })).toThrow();
  });

  it('rejects negative per_customer_used', () => {
    expect(() => CustomerContextSchema.parse({
      customer_id: 'cust_1', segments: [], total_orders: 0, per_customer_used: -1,
    })).toThrow();
  });
});
