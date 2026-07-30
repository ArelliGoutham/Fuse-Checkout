import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fuse?authSource=admin';
const DB_NAME = 'fuse';

const IIN_RANGES = [
  // HDFC
  { _id: 'iin_459130', prefix: '459130', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_459131', prefix: '459131', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_459132', prefix: '459132', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'infinite', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455204', prefix: '455204', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'gold', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_437450', prefix: '437450', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'debit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438614', prefix: '438614', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'business', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // ICICI
  { _id: 'iin_402602', prefix: '402602', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455201', prefix: '455201', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'sapphire', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438601', prefix: '438601', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_524242', prefix: '524242', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'sapphire', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_402603', prefix: '402603', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'standard', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // SBI
  { _id: 'iin_546700', prefix: '546700', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'elite', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_542200', prefix: '542200', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_437856', prefix: '437856', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_490112', prefix: '490112', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'debit', card_tier: 'standard', card_network: 'rupay', status: 'active', updated_at: new Date().toISOString() },
  // AXIS
  { _id: 'iin_512300', prefix: '512300', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'magnus', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_541301', prefix: '541301', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455202', prefix: '455202', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438611', prefix: '438611', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // KOTAK
  { _id: 'iin_447700', prefix: '447700', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'white', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455300', prefix: '455300', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'standard', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_524366', prefix: '524366', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  // YES Bank
  { _id: 'iin_459153', prefix: '459153', bank_code: 'YESBANK', bank_name: 'YES Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_541315', prefix: '541315', bank_code: 'YESBANK', bank_name: 'YES Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  // IDBI
  { _id: 'iin_455100', prefix: '455100', bank_code: 'IDBI', bank_name: 'IDBI Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
];

const SAMPLE_CAMPAIGNS = [
  {
    _id: 'camp_hdfc_premium_july',
    code: 'HDFC-PREMIUM-JULY',
    title: 'HDFC Premium No-Cost EMI',
    scope: 'merchant',
    merchant_id: 'merch_demo',
    brand: null,
    bank: 'HDFC',
    iin_prefixes: ['459130', '459131', '459132'],
    card_tiers: ['platinum', 'signature', 'infinite'],
    emi_type: 'no_cost',
    products: null,
    max_total: 100,
    max_per_merchant: null,
    max_per_card: 2,
    subsidy_amount: null,
    requires_imei: false,
    starts_at: '2026-07-01T00:00:00.000Z',
    ends_at: '2026-12-31T23:59:59.000Z',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    _id: 'camp_samsung_s24_brand',
    code: 'SAMSUNG-S24-BRAND',
    title: 'Samsung S24 No-Cost EMI (All Merchants)',
    scope: 'brand',
    merchant_id: null,
    brand: 'Samsung',
    bank: 'HDFC',
    iin_prefixes: ['459130', '459131', '437450'],
    card_tiers: ['platinum', 'signature', 'standard'],
    emi_type: 'no_cost',
    products: ['SKU-S24', 'SKU-S24U'],
    max_total: 500,
    max_per_merchant: 50,
    max_per_card: 1,
    subsidy_amount: null,
    requires_imei: true,
    starts_at: '2026-07-01T00:00:00.000Z',
    ends_at: '2026-09-30T23:59:59.000Z',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('Connected to MongoDB, seeding IIN ranges + EMI campaigns...');

  await db.collection('iin_ranges').deleteMany({});
  await db.collection('emi_campaigns').deleteMany({});
  await db.collection('emi_redemptions').deleteMany({});

  await db.collection('iin_ranges').insertMany(IIN_RANGES);
  console.log(`Seeded ${IIN_RANGES.length} IIN ranges`);

  await db.collection('emi_campaigns').insertMany(SAMPLE_CAMPAIGNS);
  console.log(`Seeded ${SAMPLE_CAMPAIGNS.length} EMI campaigns`);

  await client.close();
  console.log('Done!');
}

seed().catch(console.error);
