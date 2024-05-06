import {AUTH0_MGMT_API_CALL} from '../utils/auth';

export class UserProfile {
  static async getUserProfile(userId: string): Promise<any> {
    const data = await AUTH0_MGMT_API_CALL('GET', `users/${userId}`);
    return data;
  }
  static async deleteUser(userId: string): Promise<any> {
    const data = await AUTH0_MGMT_API_CALL('DELETE', `users/${userId}`);
    return data;
  }
}
