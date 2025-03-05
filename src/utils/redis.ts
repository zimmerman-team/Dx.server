import {uniq} from 'lodash';
import {redisClient} from '../application';
import {UserProfile} from '../authentication-strategies/user-profile';
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
    await deleteKeysWithPattern(`${options.asset}-detail-${options.assetId}*`);
    await redisClient.del(`public-${options.asset}-detail-${options.assetId}`);
    if (options.asset === 'chart') {
      await redisClient.del(`public-chart-render-detail-${options.assetId}`);
      await deleteKeysWithPattern(`*${options.assetId}*`);
    }
  }
  if (options.userId) {
    const orgMembers = await getUsersOrganizationMembers(options.userId);

    const orgMemberIds = uniq(
      orgMembers.map((m: any) => m.user_id).concat(options.userId),
    );
    const promisesToAwait = [];
    const assetPlural =
      options.asset === 'story' ? 'stories' : `${options.asset}s`;
    for (const memberId of orgMemberIds) {
      promisesToAwait.push(
        deleteKeysWithPattern(`*${assetPlural}-${memberId}`),
        deleteKeysWithPattern(`*assets-${memberId}`),
      );
    }
    await Promise.all(promisesToAwait);
  }
};

export const getUserName = async (userId: string) => {
  const name = await redisClient.get(`user-name-${userId}`);
  if (name) {
    return name;
  }
  return null;
};

export const getUserNames = async (userIds: string[]) => {
  let names: {[key: string]: string} = {};
  for (const userId of userIds) {
    const name = await getUserName(userId);
    if (!name) {
      // If any name is not found in cache, fetch all names from Auth0
      const usersFromAuth0 = await UserProfile.getUsersByIds(userIds);
      names = usersFromAuth0.reduce((acc: typeof names, user: any) => {
        acc[user.user_id] = user.name;
        return acc;
      }, {});

      // Cache all names
      for (const [userId, name] of Object.entries(names)) {
        redisClient.set(`user-name-${userId}`, name);
      }
      break;
    }
    names[userId] = name;
  }
  return names;
};

export const addOwnerNameToAssets = async <
  T extends {owner: string; baseline: boolean},
>(
  assets: T[],
) => {
  const ownerIds = assets
    .filter(asset => !asset.baseline && asset.owner.length > 5)
    .map(asset => asset.owner);
  const uniqueOwnerIds = uniq(ownerIds);
  const userNames = await getUserNames(uniqueOwnerIds);

  const promises = assets.map(async asset => {
    if (asset.baseline || asset.owner.length < 5) {
      return {...asset, ownerName: 'Dataxplorer'};
    }
    const ownerName = userNames[asset.owner];
    return {...asset, ownerName};
  });
  return Promise.all(promises);
};
