import axios, {Method} from 'axios';
import {isArray} from 'lodash';
import mcache from 'memory-cache';
import queryString from 'querystring';
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

export async function getOrganizationMembers(organizationId: string) {
  /*
   cache structure:

   organisationMembers: {
      [organisationId]: [members]
   }

   */
  const cachedOrgMembers = JSON.parse(
    mcache.get(`${organizationId}-org-members`) ?? '[]',
  );

  if (cachedOrgMembers && cachedOrgMembers.length) {
    return cachedOrgMembers;

    // TODO: Setup background job to refresh cache
  }
  logger.info(`fn <getOrganizationMembers()> cachedOrgMembers expired`);
  return AUTH0_MGMT_API_CALL('GET', `organizations/${organizationId}/members`)
    .then((orgUsers: any) => {
      mcache.put(
        `${organizationId}-org-members`,
        JSON.stringify([orgUsers]),
        1000 * 60 * 5, // 5 minutes
      );
      return orgUsers;
    })
    .catch((e: any) => {
      logger.error(`fn <getOrganizationMembers()> ${String(e)}`);
      return [];
    });
}

export async function getUsersOrganizationMembers(userId: string) {
  /*
  cache structure:

  userId-organization-id: organisationId

  */
  const cachedUserOrganisationId =
    mcache.get(`${userId}-organization-id`) || '';
  if (cachedUserOrganisationId) {
    return getOrganizationMembers(cachedUserOrganisationId);
    // TODO: Setup background job to refresh cache
  }
  logger.info(
    `fn <getUsersOrganizationMembers()> cachedUsersOrganisations expired`,
  );
  return AUTH0_MGMT_API_CALL('GET', `users/${userId}/organizations`)
    .then((orgs: any) => {
      if (isArray(orgs) && orgs.length) {
        mcache.put(
          `${userId}-organization-id`,
          orgs[0].id,
          1000 * 60 * 5, // 5 minutes
        );
        return getOrganizationMembers(orgs[0].id);
      }
      return [];
    })
    .catch((e: any) => {
      logger.error(`fn <getUsersOrganizationMembers()> ${String(e)}`);
      return [];
    });
}
