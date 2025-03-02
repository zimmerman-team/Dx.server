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

    cacheName = `${cacheName}${
      options?.extraKey ? `-${options?.extraKey}` : ''
    }`;

    if (options?.useFirstPathParam) {
      const pathValue = invocationCtx.args[0];
      cacheName = `${cacheName}-${pathValue}`;
    }
    cacheName = `${cacheName}${
      options?.useUserId ? `-${(request?.user as any).sub}` : ''
    }`;

    try {
      const cachedResult = await redisClient.get(cacheName);
      if (cachedResult) {
        console.log('Cache hit', cacheName);
        return JSON.parse(cachedResult);
      }
      const result = await next();

      if ((result as any)?.error) {
        return result;
      }

      await redisClient.set(cacheName, JSON.stringify(result), {
        EX: options?.expiry ?? 60 * 30, // 30 minutes expiry by default
      });

      return result;
    } catch (err) {
      throw err;
    }
  };
};
