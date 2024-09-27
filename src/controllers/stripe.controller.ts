import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  post,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import _ from 'lodash';
import Stripe from 'stripe';
import {UserProfile} from '../authentication-strategies/user-profile';
import {winstonLogger as logger} from '../config/logger/winston-logger';

const StripeClient = new Stripe(process.env.STRIPE_API_KEY as string, {
  // @ts-ignore
  apiVersion: null,
});

const plans = [
  {
    name: 'free',
    priceIds: {
      monthly: process.env.STRIPE_PRODUCT_FREE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRODUCT_FREE_YEARLY_PRICE_ID,
    },
  },
  {
    name: 'pro',
    priceIds: {
      monthly: process.env.STRIPE_PRODUCT_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRODUCT_PRO_YEARLY_PRICE_ID,
    },
  },
  {
    name: 'team',
    priceIds: {
      monthly: process.env.STRIPE_PRODUCT_TEAM_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRODUCT_TEAM_YEARLY_PRICE_ID,
    },
  },
  {
    name: 'enterprise',
    priceIds: {
      monthly: process.env.STRIPE_PRODUCT_ENTERPRISE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRODUCT_ENTERPRISE_YEARLY_PRICE_ID,
    },
  },
];

export class StripeController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  @post('/stripe/new-customer')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async stripeNewCustomer(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    details: {
      name: string;
      email: string;
      authUserId: string;
    },
  ): Promise<{message: string; data: any} | {error: string}> {
    try {
      const customer = await StripeClient.customers.create({
        name: details.name,
        email: details.email,
        metadata: {
          authUserId: details.authUserId,
        },
      });
      if (customer) {
        const auth0Resp = await UserProfile.updateUserProfile(
          _.get(this.req, 'user.sub', 'anonymous'),
          {
            app_metadata: {
              stripeCustomerId: customer.id,
            },
          },
        );
        if (auth0Resp) {
          return {message: 'Customer created successfully', data: customer.id};
        }
      }
      return {error: 'Customer creation failed'};
    } catch (error) {
      logger.error(
        `route <stripe/new-customer> -  Error creating new stripe customer: ${error}`,
      );
      return {error: 'Customer creation failed'};
    }
  }

  @post('/stripe/checkout-session')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async stripeCheckoutSession(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    details: {
      planName: string;
      domainURL: string;
      recurrence: string;
      customerId: string;
      licensesNumber: number;
    },
  ): Promise<{message: string; data: any} | {error: string}> {
    try {
      if (!details.customerId) {
        return {error: 'customerId is required'};
      }
      const customer = await StripeClient.customers.retrieve(
        details.customerId,
      );
      const planPriceId = _.get(
        process.env,
        `STRIPE_PRODUCT_${details.planName.toUpperCase()}_${details.recurrence.toUpperCase()}_PRICE_ID`,
        process.env.STRIPE_PRODUCT_FREE_MONTHLY_PRICE_ID,
      );
      const items = [{price: planPriceId, quantity: details.licensesNumber}];
      const session = await StripeClient.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: items,
        success_url: `${details.domainURL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${details.domainURL}/canceled`,
        subscription_data: {
          trial_period_days:
            details.planName.toLowerCase() === 'free' ? undefined : 30,
        },
        customer_update: {
          shipping: 'auto',
        },
        payment_method_collection: 'if_required',
      });
      return {
        message: 'Session created successfully',
        data: session.url ?? session.id,
      };
    } catch (error) {
      logger.error(
        `route <stripe/checkout-session> -  Error creating stripe checkout session: ${error}`,
      );
      return {error: 'Checkout session creation failed'};
    }
  }

  @post('/stripe/update-user-subscription-metadata')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async stripeUpdateUserSubscriptionMetadata(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    details: {
      sessionId: string;
    },
  ): Promise<{message: string} | {error: string}> {
    try {
      const session = await StripeClient.checkout.sessions.retrieve(
        details.sessionId,
      );
      let planName = '';
      let licenses = 0;
      const subscriptionId = _.get(session, 'subscription', '');
      if (!session.line_items && subscriptionId) {
        const subscription = await StripeClient.subscriptions.retrieve(
          subscriptionId.toString(),
        );
        planName = _.get(subscription, 'items.data[0].plan.metadata.name', '');
        licenses = _.get(subscription, 'items.data[0].quantity', 0);
      } else {
        const priceId = _.get(session, 'line_items.data[0].price.id', '');
        planName =
          _.find(
            plans,
            plan =>
              plan.priceIds.monthly === priceId ||
              plan.priceIds.yearly === priceId,
          )?.name ?? '';
        licenses = _.get(session, 'line_items.data[0].quantity', 0);
      }
      const auth0Resp = await UserProfile.updateUserProfile(
        _.get(this.req, 'user.sub', 'anonymous'),
        {
          app_metadata: {
            planName,
            licenses,
            subscriptionId,
          },
        },
      );
      if (auth0Resp) {
        return {message: 'User subscription metadata updated successfully'};
      }
      return {error: 'Update user subscription metadata failed'};
    } catch (error) {
      logger.error(
        `route <stripe/update-user-subscription-metadata> -  Error updating user's subscription metadata: ${error}`,
      );
      return {error: 'Update user subscription metadata failed'};
    }
  }
}
