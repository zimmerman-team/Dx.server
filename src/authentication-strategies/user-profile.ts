import {AUTH0_MGMT_API_CALL} from '../utils/auth';

export class UserProfile {
  static async getUserProfile(userId: string): Promise<any> {
    const data = await AUTH0_MGMT_API_CALL('GET', `users/${userId}`);
    return data;
  }
  //delete user
  static async deleteUser(userId: string): Promise<any> {
    const data = await AUTH0_MGMT_API_CALL('DELETE', `users/${userId}`);
    return data;
  }
  //update user profile
  static async updateUserProfile(userId: string, data: any): Promise<any> {
    const response = await AUTH0_MGMT_API_CALL(
      'PATCH',
      `users/${userId}`,
      data,
    );
    return response;
  }
}
