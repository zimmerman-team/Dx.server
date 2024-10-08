import {Interceptor, InvocationContext, Next} from '@loopback/core';
import {Request, RestBindings} from '@loopback/rest';
import {redisClient} from '../application';

export const cacheInterceptor = (options?: {
  cacheId?: string;
  useFirstPathParam?: boolean;
  expiry?: number;
  useUserId?: boolean;
  extraKey?: string;
}): Interceptor => {
  return async (invocationCtx: InvocationContext, next: Next) => {
    const request: Request = await invocationCtx.get(RestBindings.Http.REQUEST);

    let cacheName =
      options?.cacheId ??
      `${request.originalUrl}-${JSON.stringify(request.body)}`;

    cacheName = `${cacheName}-${options?.extraKey ?? ''}-${
      options?.useUserId ? (request?.user as any).sub : ''
    }`;

    if (options?.useFirstPathParam) {
      const pathValue = invocationCtx.args[0];
      cacheName = `${cacheName}-${pathValue}`;
    }

    try {
      const cachedResult = await redisClient.get(cacheName);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }
      const result = await next();

      await redisClient.set(cacheName, JSON.stringify(result), {
        EX: options?.expiry ?? 60 * 30, // 30 minutes expiry by default
      });

      return result;
    } catch (err) {
      throw err;
    }
  };
};
