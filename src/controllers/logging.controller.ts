import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  getModelSchemaRef,
  post,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import _ from 'lodash';
import {frontendLogger} from '../config/logger/winston-logger';
import {Chart} from '../models';

export class LoggingController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  @post('/logging')
  @response(200, {
    description: 'Frontend logging endpoint',
  })
  //   @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async log(
    @requestBody({
      description: 'Frontend log payload',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['message'],
            properties: {
              level: {
                type: 'string',
                enum: ['info', 'warn', 'error', 'debug'],
                default: 'info',
              },
              message: {type: 'string'},
              stack: {type: 'string'},
              metadata: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
      },
    })
    body: {
      level?: string;
      message: string;
      stack?: string;
      metadata?: object;
    },
  ) {
    try {
      const {level = 'info', message, stack, metadata} = body;

      frontendLogger.log({
        level,
        message,
        stack,
        ...metadata,
      });

      return {success: true};
    } catch (error) {
      frontendLogger.error(`Error logging frontend message: ${error}`);
      throw error;
    }
  }
}
