const { MongoClient } = require('mongodb');
require('dotenv').config();

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'cresceja_logs';

let db;

async function connectMongo() {
  if (!db) {
    const client = new MongoClient(mongoUrl, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
  }
  return db;
}

async function logAccess(userId, action, details) {
  const db = await connectMongo();
  await db.collection('access_logs').insertOne({
    userId,
    action,
    details,
    timestamp: new Date(),
  });
}

module.exports = { logAccess };