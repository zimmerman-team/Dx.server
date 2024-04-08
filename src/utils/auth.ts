import axios, {Method} from 'axios';
import mcache from 'memory-cache';
import queryString from 'querystring';

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
      .catch(err => err);
  });
}

export async function getOrganizationMembers(organizationId: string) {
  return AUTH0_MGMT_API_CALL('GET', `organizations/${organizationId}/members`)
    .then((orgUsers: any) => orgUsers)
    .catch((e: any) => {
      console.log(e);
      return e;
    });
}

export async function getUsersOrganizationMembers(userId: string) {
  return AUTH0_MGMT_API_CALL('GET', `users/${userId}/organizations`).then(
    (orgs: any) => {
      if (orgs.length) {
        return getOrganizationMembers(orgs[0].id);
      }
      return Promise.resolve([]);
    },
  );
}
