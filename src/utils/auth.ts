import axios, {Method} from 'axios';
import Queue from 'bull';
import {isArray} from 'lodash';
import mcache from 'memory-cache';
import queryString from 'querystring';
import {redisClient} from '../application';
import {winstonLogger as logger} from '../config/logger/winston-logger';

async function getAccessToken(): Promise<string> {
  const cachedToken = mcache.get('auth0_token');
  if (cachedToken) {
    return cachedToken;
  }
  const body = {
    client_id: process.env.AUTH0_MGMT_CLIENT,
    client_secret: process.env.AUTH0_MGMT_SECRET,
    audience: process.env.AUTH0_AUDIENCE,
    grant_type: 'client_credentials',
  };
  const response = await axios.post(
    process.env.AUTH0_TOKEN_URL as string,
    queryString.stringify(body),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    },
  );
  mcache.put('auth0_token', response.data.access_token, 1000 * 60 * 60 * 24);
  return response.data.access_token;
}

export async function AUTH0_MGMT_API_CALL(
  method: Method,
  path: string,
  data?: any,
) {
  return getAccessToken().then(token => {
    return axios
      .request({
        data,
        method,
        url: `https://${process.env.AUTH0_DOMAIN}/api/v2/${path}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(response => response.data)
      .catch(err => {
        throw err;
      });
  });
}

const getUserOrganisation = async (userId: string) => {
  try {
    const orgs = await AUTH0_MGMT_API_CALL(
      'GET',
      `users/${userId}/organizations`,
    );
    let orgId = 'none';
    if (isArray(orgs) && orgs.length) {
      orgId = orgs[0].id;
    }
    await redisClient.set(
      `${userId}-organization-id`,
      orgId,
      {
        EX: 60 * 60 * 24,
      }, // 5 minutes
    );
    return orgId;
  } catch (e: any) {
    logger.error(`fn <getUserOrganisation()> ${String(e)}`);
    return 'none';
  }
};

const getAuth0OrganizationMembers = async (organizationId: string) => {
  try {
    const orgUsers = await AUTH0_MGMT_API_CALL(
      'GET',
      `organizations/${organizationId}/members`,
    );
    await redisClient.set(
      `${organizationId}-org-members`,
      JSON.stringify(orgUsers),
      {
        EX: 60 * 60 * 24,
      }, // 24 hours
    );
    return orgUsers;
  } catch (e: any) {
    logger.error(`fn <getAuth0OrganizationMembers()> ${String(e)}`);
    return [];
  }
};

const orgMembersQueue = new Queue(
  'orgMembers',
  `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:6379`,
);
const userOrgQueue = new Queue(
  'userOrg',
  `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:6379`,
);

orgMembersQueue.process(async (job, done) => {
  const {organizationId} = job.data;
  getAuth0OrganizationMembers(organizationId);
  logger.info(`queue <orgMembersQueue> org members cached`);
  done();
});

userOrgQueue.process(async (job, done) => {
  const {userId} = job.data;
  await getUserOrganisation(userId);
  logger.info(`queue <userOrgQueue> user orgid cached`);
  done();
});

export async function getOrganizationMembers(organizationId: string) {
  /*
   cache structure:

   organisationMembers: {
      [organisationId]: [members]
   }

   */
  if (organizationId === 'none' || !organizationId) {
    return [];
  }
  const cachedOrgMembers = JSON.parse(
    (await redisClient.get(`${organizationId}-org-members`)) ?? '[]',
  );

  if (cachedOrgMembers && cachedOrgMembers.length) {
    // TODO: Setup background job to refresh cache

    if (!(await redisClient.get(organizationId))) {
      orgMembersQueue.add({organizationId}, {delay: 1000 * 5});
      await redisClient.set(
        organizationId,
        'true',
        {
          EX: 60 * 5,
        }, // 5 minutes
      );
    }
    return cachedOrgMembers;
  }
  logger.info(`fn <getOrganizationMembers()> cachedOrgMembers expired`);
  return getAuth0OrganizationMembers(organizationId);
}

export async function getUsersOrganizationMembers(userId: string) {
  /*
  cache structure:

  userId-organization-id: organisationId

  */
  const cachedUserOrganisationId =
    (await redisClient.get(`${userId}-organization-id`)) || '';
  if (cachedUserOrganisationId) {
    if (!(await redisClient.get(userId))) {
      userOrgQueue.add({userId}, {delay: 1000 * 5});
      await redisClient.set(
        userId,
        'true',
        {
          EX: 60 * 5,
        }, // 5 minutes
      );
    }
    return getOrganizationMembers(cachedUserOrganisationId);
    // TODO: Setup background job to refresh cache
  }
  logger.info(
    `fn <getUsersOrganizationMembers()> cachedUsersOrganisations expired`,
  );
  const orgId = await getUserOrganisation(userId);
  if (orgId === 'none') {
    return [];
  }
  return getOrganizationMembers(orgId);
}
