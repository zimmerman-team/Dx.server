import {redisClient} from '../application';

export async function deleteKeysWithPattern(pattern: string) {
  // Find all keys matching the pattern (e.g., 'user:*')
  const keys = await redisClient.keys(pattern);

  if (keys.length > 0) {
    // Delete all matching keys
    await redisClient.del(keys);
    console.log(`Deleted ${keys.length} keys.`);
  } else {
    console.log('No matching keys found.');
  }
}
