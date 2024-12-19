import _ from 'lodash';
import Stripe from 'stripe';
import {AUTH0_MGMT_API_CALL} from '../utils/auth';

const StripeClient = new Stripe(process.env.STRIPE_API_KEY as string, {
  // @ts-ignore
  apiVersion: null,
});

export class UserProfile {
  static async getUserProfile(userId: string): Promise<any> {
    const data = await AUTH0_MGMT_API_CALL('GET', `users/${userId}`);
    return data;
  }
  //delete user
  static async deleteUser(userId: string): Promise<any> {
    const userProfile = await this.getUserProfile(userId);
    const customerId = _.get(userProfile, 'app_metadata.stripeCustomerId');
    if (customerId) {
      await StripeClient.customers.del(customerId);
    }
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
