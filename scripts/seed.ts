import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://offerforge:offerforge@localhost:27017/offerforge?authSource=admin';
const DB_NAME = 'offerforge';

async function seed() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('Connected to MongoDB, seeding...');

  await Promise.all([
    db.collection('merchants').deleteMany({}),
    db.collection('offers').deleteMany({}),
    db.collection('products').deleteMany({}),
    db.collection('redemptions').deleteMany({}),
  ]);

  await db.collection('merchants').insertOne({
    _id: 'merch_demo', name: 'TechStore.in', email: 'owner@techstore.in',
    api_key_hash: 'demo-key-123', plan: 'starter',
    global_stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] },
    created_at: new Date().toISOString(),
  });
  console.log('✓ Merchant: TechStore.in (API key: demo-key-123)');

  const products = [
    { _id: 'merch_demo_SKU-IP15', merchant_id: 'merch_demo', sku_id: 'SKU-IP15', name: 'iPhone 15 Pro', category: 'Electronics', brand: 'Apple', attributes: {}, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { _id: 'merch_demo_SKU-S24', merchant_id: 'merch_demo', sku_id: 'SKU-S24', name: 'Galaxy S24 Ultra', category: 'Electronics', brand: 'Samsung', attributes: {}, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { _id: 'merch_demo_SKU-TS001', merchant_id: 'merch_demo', sku_id: 'SKU-TS001', name: 'Premium Cotton T-Shirt', category: 'Clothing', brand: null, attributes: {}, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { _id: 'merch_demo_SKU-RS999', merchant_id: 'merch_demo', sku_id: 'SKU-RS999', name: 'Running Shoes Pro', category: 'Footwear', brand: 'Nike', attributes: {}, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { _id: 'merch_demo_SKU-BLT01', merchant_id: 'merch_demo', sku_id: 'SKU-BLT01', name: 'Leather Belt Classic', category: 'Accessories', brand: null, attributes: {}, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  await db.collection('products').insertMany(products);
  console.log(`✓ Products: ${products.length} inserted`);

  const now = new Date().toISOString();
  const offers = [
    { _id: 'offer_flat50', merchant_id: 'merch_demo', code: 'FLAT50', type: 'coupon', title: 'Flat ₹50 off', description: 'Get ₹50 off on orders above ₹500', discount: { type: 'flat', value: 50, max_discount: null }, subsidy_model: 'merchant', status: 'active', validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' }, usage_limits: { total: null, per_customer: null }, usage_count: 412, rules: [{ rule_type: 'min_cart_value', config: { min_amount: 500 } }], stacking: { stacks_with: null, exclusive: false, priority: 0 }, tags: [], created_at: now, updated_at: now },
    { _id: 'offer_save10', merchant_id: 'merch_demo', code: 'SAVE10', type: 'coupon', title: '10% off (max ₹300)', description: 'Weekend special', discount: { type: 'percentage', value: 10, max_discount: 300 }, subsidy_model: 'merchant', status: 'active', validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' }, usage_limits: { total: null, per_customer: null }, usage_count: 287, rules: [{ rule_type: 'weekend_only', config: {} }], stacking: { stacks_with: null, exclusive: false, priority: 0 }, tags: [], created_at: now, updated_at: now },
    { _id: 'offer_auto_elec', merchant_id: 'merch_demo', code: null, type: 'auto_offer', title: '10% off electronics', description: 'Auto-applied on electronics', discount: { type: 'percentage', value: 10, max_discount: null }, subsidy_model: 'merchant', status: 'active', validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' }, usage_limits: { total: null, per_customer: null }, usage_count: 198, rules: [{ rule_type: 'category_restriction', config: { categories: ['Electronics'], exclude: false } }], stacking: { stacks_with: ['coupon'], exclusive: false, priority: 0 }, tags: [], created_at: now, updated_at: now },
    { _id: 'offer_first100', merchant_id: 'merch_demo', code: 'FIRST100', type: 'coupon', title: '₹100 off first order', description: 'First-time buyers', discount: { type: 'flat', value: 100, max_discount: null }, subsidy_model: 'merchant', status: 'active', validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' }, usage_limits: { total: null, per_customer: 1 }, usage_count: 156, rules: [{ rule_type: 'first_time_buyer', config: {} }, { rule_type: 'min_cart_value', config: { min_amount: 999 } }], stacking: { stacks_with: null, exclusive: false, priority: 0 }, tags: [], created_at: now, updated_at: now },
  ];
  await db.collection('offers').insertMany(offers);
  console.log(`✓ Offers: ${offers.length} inserted`);

  const redemptions = [
    { offer_id: 'offer_flat50', merchant_id: 'merch_demo', session_id: 'sess_001', cart_amount: 5000, discount_applied: 50, final_amount: 4950, customer_id: 'cust_001', applied_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), order_id: 'order_001', order_status: 'paid' },
    { offer_id: 'offer_save10', merchant_id: 'merch_demo', session_id: 'sess_002', cart_amount: 3000, discount_applied: 300, final_amount: 2700, customer_id: 'cust_002', applied_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(), order_id: null, order_status: 'applied' },
    { offer_id: 'offer_first100', merchant_id: 'merch_demo', session_id: 'sess_003', cart_amount: 1500, discount_applied: 100, final_amount: 1400, customer_id: 'cust_003', applied_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(), order_id: null, order_status: 'abandoned' },
    { offer_id: 'offer_auto_elec', merchant_id: 'merch_demo', session_id: 'sess_004', cart_amount: 129999, discount_applied: 13000, final_amount: 116999, customer_id: 'cust_004', applied_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), order_id: 'order_002', order_status: 'paid' },
    { offer_id: 'offer_flat50', merchant_id: 'merch_demo', session_id: 'sess_005', cart_amount: 2500, discount_applied: 50, final_amount: 2450, customer_id: 'cust_005', applied_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), order_id: null, order_status: 'applied' },
  ];
  await db.collection('redemptions').insertMany(redemptions);
  console.log(`✓ Redemptions: ${redemptions.length} inserted`);

  await client.close();
  console.log('\n✅ Seed complete! Use API key "demo-key-123" in the dashboard.');
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
