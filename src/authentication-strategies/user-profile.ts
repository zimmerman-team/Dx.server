import axios from 'axios';
import mcache from 'memory-cache';
import queryString from 'querystring';
export class UserProfile {
  static async getAccessToken(): Promise<string> {
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
    return response.data.access_token;
  }

  static async getUserProfile(userId: string): Promise<any> {
    let cachedToken = mcache.get('auth0_token');
    if (!cachedToken) {
      cachedToken = await UserProfile.getAccessToken();
      mcache.put('auth0_token', cachedToken, 1000 * 60 * 60 * 24);
    }
    const response = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${cachedToken}`,
        },
      },
    );
    return response.data;
  }
}
