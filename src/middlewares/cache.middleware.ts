import {Next} from '@loopback/core';
import {Middleware, MiddlewareContext} from '@loopback/rest';
import {redisClient} from '../application';

export const cacheMiddleware: Middleware = async (
  middlewareCtx: MiddlewareContext,
  next: Next,
) => {
  const {request} = middlewareCtx;

  const cacheName = `${request.originalUrl}-${JSON.stringify(request.body)}`;

  try {
    if (request.method !== 'GET') {
      return next();
    }
    const cachedResult = await redisClient.get(cacheName);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }
    const result = await next();

    await redisClient.set(cacheName, JSON.stringify(result), {
      EX: 60 * 10,
    });
    return result;
  } catch (err) {
    throw err;
  }
};
