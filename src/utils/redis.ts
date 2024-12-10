import {uniq} from 'lodash';
import {redisClient} from '../application';
import {getUsersOrganizationMembers} from './auth';

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

export const handleDeleteCache = async (options: {
  userId?: string;
  asset: string;
  assetId?: string;
}) => {
  if (options.assetId) {
    await redisClient.del(`${options.asset}-detail-${options.assetId}`);
    await redisClient.del(`public-${options.asset}-detail-${options.assetId}`);
  }
  if (options.userId) {
    const orgMembers = await getUsersOrganizationMembers(options.userId);

    const orgMemberIds = uniq(
      orgMembers.map((m: any) => m.user_id).concat(options.userId),
    );
    const promisesToAwait = [];
    for (const memberId of orgMemberIds) {
      promisesToAwait.push(
        deleteKeysWithPattern(`*${options.asset}s-${memberId}`),
        deleteKeysWithPattern(`*assets-${memberId}`),
      );
    }
    await Promise.all(promisesToAwait);
  }
};
