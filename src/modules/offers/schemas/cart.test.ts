import { CartSchema, CartItemSchema } from './cart';

describe('CartItemSchema', () => {
  it('parses a valid cart item', () => {
    const item = {
      sku_id: 'SKU-IP15',
      category: 'electronics',
      brand: 'Apple',
      price: 99999,
      qty: 1,
    };
    expect(CartItemSchema.parse(item)).toEqual(item);
  });

  it('rejects negative price', () => {
    const item = { sku_id: 'SKU-1', price: -100, qty: 1 };
    expect(() => CartItemSchema.parse(item)).toThrow();
  });

  it('rejects zero qty', () => {
    const item = { sku_id: 'SKU-1', price: 100, qty: 0 };
    expect(() => CartItemSchema.parse(item)).toThrow();
  });

  it('accepts item with optional fields omitted', () => {
    const item = { sku_id: 'SKU-1', price: 100, qty: 1 };
    expect(CartItemSchema.parse(item)).toEqual(item);
  });
});

describe('CartSchema', () => {
  it('parses a valid cart with items', () => {
    const cart = {
      amount: 5000,
      items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }],
    };
    expect(CartSchema.parse(cart)).toEqual(cart);
  });

  it('parses a cart with empty items array', () => {
    const cart = { amount: 0, items: [] };
    expect(CartSchema.parse(cart)).toEqual(cart);
  });

  it('rejects negative cart amount', () => {
    expect(() => CartSchema.parse({ amount: -1, items: [] })).toThrow();
  });
});
