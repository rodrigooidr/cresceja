
// ESM
import pkg from 'bullmq';
const { Queue } = pkg;
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});

export const repurposeQueue = new Queue('repurpose', { connection });

export async function enqueueRepurpose({ postId, modes = ['story', 'email', 'video'] }) {
  if (!postId) throw new Error('postId_required');
  return repurposeQueue.add(
    'repurpose',
    { postId, modes },
    { removeOnComplete: true, removeOnFail: true }
  );
}

export default { repurposeQueue, enqueueRepurpose };