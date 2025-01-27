import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  get,
  param,
  post,
  put,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import _ from 'lodash';
import Stripe from 'stripe';
import {UserProfile} from '../authentication-strategies/user-profile';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import moment = require('moment');

const StripeClient = new Stripe(process.env.STRIPE_API_KEY as string, {
  // @ts-ignore
  apiVersion: null,
});

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
        billing_address_collection: 'required',
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
      const subscriptionId = _.get(session, 'subscription', '');
      const auth0Resp = await UserProfile.updateUserProfile(
        _.get(this.req, 'user.sub', 'anonymous'),
        {
          app_metadata: {
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

  @get('/stripe/payment-method/{userId}')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async getPaymentMethod(@param.path.string('userId') userId: string) {
    const user = await UserProfile.getUserProfile(userId);
    const customerId = _.get(user, 'app_metadata.stripeCustomerId', '');
    if (!customerId) {
      return {
        data: {
          method: '',
          number: '',
        },
      };
    }
    const customerPaymentMethods = await StripeClient.paymentMethods.list({
      customer: customerId,
    });
    const paymentMethod =
      customerPaymentMethods.data.length > 0
        ? customerPaymentMethods.data[0]
        : null;
    if (paymentMethod) {
      let details = {};
      switch (paymentMethod.type) {
        case 'card':
          details = {
            method: _.get(paymentMethod, 'card.brand', 'card'),
            number: _.get(paymentMethod, 'card.last4', '0000'),
          };
          break;
        case 'blik':
          details = {
            method: 'BLIK',
            number: _.get(paymentMethod, 'blik.code', ''),
          };
          break;
        case 'bancontact':
          details = {
            method: 'Bancontact',
            number: _.get(paymentMethod, 'bancontact.code', ''),
          };
          break;
        case 'giropay':
          details = {
            method: 'giropay',
            number: _.get(paymentMethod, 'giropay.code', ''),
          };
          break;
        case 'ideal':
          details = {
            method: 'iDEAL',
            number: _.get(paymentMethod, 'ideal.bank', ''),
          };
          break;
        case 'sepa_debit':
          details = {
            method: `SEPA Direct Debit (${_.get(
              paymentMethod,
              'sepa_debit.bank_code',
              '',
            )})`,
            number: _.get(paymentMethod, 'sepa_debit.last4', ''),
          };
        default:
          break;
      }
      return {data: details};
    } else {
      return {data: null};
    }
  }

  @put('/stripe/payment-method/{customerId}')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async changePaymentMethod(
    @param.path.string('customerId') customerId: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    data: {
      paymentMethodId: string;
    },
  ) {
    const paymentMethod = await StripeClient.paymentMethods.attach(
      data.paymentMethodId,
      {customer: customerId},
    );
    return {data: paymentMethod};
  }

  @get('/stripe/{userId}/billing')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async getCustomerBilling(@param.path.string('userId') userId: string) {
    if (!userId) {
      throw new Error('userId is required');
    }
    const user = await UserProfile.getUserProfile(userId);
    const customerId = _.get(user, 'app_metadata.stripeCustomerId', '');
    if (!customerId) {
      return {
        data: {
          city: '',
          country: '',
          line1: '',
          line2: '',
          address: '',
          postal_code: '',
          state: '',
        },
      };
    }
    const customer = (await StripeClient.customers.retrieve(
      customerId,
    )) as Stripe.Customer;
    return {data: customer.address};
  }

  @post('/stripe/portal-session')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async createCustomerPortalSession(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    data: {
      userId: string;
      returnUrl: string;
      flowDataType?: string;
    },
  ) {
    const user = await UserProfile.getUserProfile(data.userId);
    const customerId = _.get(user, 'app_metadata.stripeCustomerId', '');
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    let config: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: data.returnUrl,
    };
    if (data.flowDataType) {
      config = {
        ...config,
        flow_data: {
          // @ts-ignore
          type: data.flowDataType,
        },
      };
    }
    const session = await StripeClient.billingPortal.sessions.create(config);
    return {data: session.url};
  }

  @get('/stripe/invoices/{userId}')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async getInvoices(@param.path.string('userId') userId: string) {
    const user = await UserProfile.getUserProfile(userId);
    const customerId = _.get(user, 'app_metadata.stripeCustomerId', '');
    if (!customerId) {
      return {data: []};
    }
    const invoices = await StripeClient.invoices.list({
      customer: customerId,
    });
    const data: any[] = [];
    for (const invoice of invoices.data) {
      const sub = await StripeClient.subscriptions.retrieve(
        invoice.subscription as string,
      );
      data.push({
        id: invoice.id,
        name: invoice.number,
        url: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        date: moment(invoice.created * 1000).format('DD/MM/YYYY'),
        plan: _.get(sub, 'plan.metadata.name', ''),
      });
    }
    return {data};
  }

  @get('/stripe/subscription/{userId}')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async getSubscription(@param.path.string('userId') userId: string) {
    const user = await UserProfile.getUserProfile(userId);
    const subscriptionId = _.get(user, 'app_metadata.subscriptionId', '');
    if (!subscriptionId) {
      return {
        data: {
          plan: 'Free',
        },
      };
    }
    const subscription = await StripeClient.subscriptions.retrieve(
      subscriptionId,
    );
    console.log(subscription);
    return {
      data: {
        plan: _.get(subscription, 'plan.metadata.name', ''),
        message: subscription.cancel_at
          ? `will be canceled on ${moment(subscription.cancel_at * 1000).format(
              'DD/MM/YYYY',
            )}`
          : null,
      },
    };
  }

  @get('/stripe/auto-update-address/{userId}')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scope: ['greet']}})
  async autoUpdateAddress(@param.path.string('userId') userId: string) {
    const user = await UserProfile.getUserProfile(userId);
    const customerId = _.get(user, 'app_metadata.stripeCustomerId', '');
    if (!customerId) {
      return {data: 'No customer found'};
    }
    const paymentMethods = await StripeClient.paymentMethods.list({
      customer: customerId,
    });
    const paymentMethod = paymentMethods.data[0];
    const updatedCustomer = await StripeClient.customers.update(customerId, {
      address: {
        city: _.get(paymentMethod, 'billing_details.address.city', ''),
        country: _.get(paymentMethod, 'billing_details.address.country', ''),
        line1: _.get(paymentMethod, 'billing_details.address.line1', ''),
        line2: _.get(paymentMethod, 'billing_details.address.line2', ''),
        postal_code: _.get(
          paymentMethod,
          'billing_details.address.postal_code',
          '',
        ),
        state: _.get(paymentMethod, 'billing_details.address.state', ''),
      },
    });
    return {data: updatedCustomer};
  }
}
