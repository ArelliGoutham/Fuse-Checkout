import { Db, Collection } from 'mongodb';
import { PGCredentials, PGCredentialsSchema } from '../schemas/pg-credentials';

/**
 * MongoDB repository for merchant payment gateway credentials.
 * Stores encrypted credentials with tenant isolation.
 */
export class MongoPGCredentialsRepository {
  private collection: Collection<PGCredentials>;

  constructor(db: Db) {
    this.collection = db.collection('pg_credentials');
  }

  /**
   * Saves PG credentials for a merchant (upsert by merchant_id + pg_name).
   */
  async save(credentials: PGCredentials): Promise<PGCredentials> {
    await this.collection.updateOne(
      { merchant_id: credentials.merchant_id, pg_name: credentials.pg_name },
      { $set: credentials },
      { upsert: true }
    );
    return PGCredentialsSchema.parse(credentials);
  }

  /**
   * Finds active PG credentials for a merchant.
   */
  async findActive(merchantId: string, pgName: string): Promise<PGCredentials | null> {
    const doc = await this.collection.findOne({
      merchant_id: merchantId,
      pg_name: pgName,
      status: 'active',
    });
    if (!doc) return null;
    return PGCredentialsSchema.parse(doc);
  }

  /**
   * Lists all PG credentials for a merchant.
   */
  async findByMerchant(merchantId: string): Promise<PGCredentials[]> {
    const docs = await this.collection.find({ merchant_id: merchantId }).toArray();
    return docs.map(doc => PGCredentialsSchema.parse(doc));
  }

  /**
   * Deactivates PG credentials (does not delete — for audit).
   */
  async deactivate(merchantId: string, pgName: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { merchant_id: merchantId, pg_name: pgName },
      { $set: { status: 'inactive', updated_at: new Date().toISOString() } }
    );
    return result.modifiedCount > 0;
  }
}
