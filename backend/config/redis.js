
import IORedis from 'ioredis';
let conn = null;
export function getRedis() {
  if (!conn) {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    conn = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return conn;
}
export default { getRedis };
