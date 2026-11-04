import { MongoClient } from 'mongodb';

const g = globalThis;

export async function mongo() {
  if (!g._ffMongo) {
    g._ffMongo = new MongoClient(process.env.MONGODB_URI).connect();
  }
  const client = await g._ffMongo;
  return client.db(process.env.MONGODB_DB || 'freshflow');
}

// Call from every stock action: await audit(user, 'ISSUE', 'inventory', id, before, after)
export async function audit(userId, action, entity, entityId, before = null, after = null) {
  const db = await mongo();
  await db.collection('audit_logs').insertOne({
    userId, action, entity, entityId, before, after, at: new Date(),
  });
}

// Run once (npm run seed:users also calls this) to create indexes.
export async function ensureIndexes() {
  const db = await mongo();
  await db.collection('audit_logs').createIndex({ entity: 1, entityId: 1, at: -1 });
  await db.collection('audit_logs').createIndex({ userId: 1, at: -1 });
  await db.collection('alert_events').createIndex({ inventoryId: 1, at: -1 });
  await db.collection('temperature_readings').createIndex({ locationId: 1, at: -1 });
  await db.collection('temperature_readings').createIndex(
    { at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL: 90 days
}
