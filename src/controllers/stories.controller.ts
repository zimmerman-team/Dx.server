import {authenticate} from '@loopback/authentication';
import {inject, intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import axios from 'axios';
import _ from 'lodash';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {cacheInterceptor} from '../interceptors/cache.interceptor';
import {Story} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  StoryRepository,
} from '../repositories';
import {getUsersOrganizationMembers} from '../utils/auth';
import {duplicateName} from '../utils/duplicateName';
import {getUserPlanData} from '../utils/planAccess';
import {addOwnerNameToAssets, handleDeleteCache} from '../utils/redis';

let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
if (process.env.ENV_TYPE !== 'prod')
  host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;

async function getStoriesCount(
  storyRepository: StoryRepository,
  owner?: string,
  where?: Where<Story>,
  filterByOwner?: boolean,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return storyRepository.count({
      ...where,
      or: [
        {owner: owner},
        ...(filterByOwner ? [] : [{owner: {inq: orgMemberIds}}]),
      ],
    });
  }
  return storyRepository.count({
    ...where,
    or: [{owner: owner}, {public: true}, {baseline: true}],
  });
}
//get stories
async function getStories(
  storyRepository: StoryRepository,
  owner?: string,
  filter?: Filter<Story>,
  filterByOwner?: boolean,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return storyRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        or: [
          {owner: owner},
          ...(filterByOwner ? [] : [{owner: {inq: orgMemberIds}}]),
        ],
      },
      fields: [
        'id',
        'name',
        'createdDate',
        'updatedDate',
        'showHeader',
        'backgroundColor',
        'title',
        'heading',
        'description',
        'public',
        'owner',
      ],
    });
  }
  return storyRepository.find({
    ...filter,
    where: {
      ...filter?.where,
      or: [{owner: owner}, {public: true}, {baseline: true}],
    },
    fields: [
      'id',
      'name',
      'createdDate',
      'updatedDate',
      'showHeader',
      'heading',
      'description',
      'backgroundColor',
      'title',
      'public',
    ],
  });
}

async function renderStory(
  chartRepository: StoryRepository,
  id: string,
  body: any,
  owner: string,
) {
  const story = await chartRepository.findById(id);
  const orgMembers = await getUsersOrganizationMembers(owner);
  if (
    !story ||
    (!story.public &&
      !story.baseline &&
      orgMembers
        .map((m: any) => m.user_id)
        .indexOf(_.get(story, 'owner', '')) === -1 &&
      _.get(story, 'owner', '') !== owner)
  ) {
    return;
  }
  const host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
  const result = await (
    await axios.post(`http://${host}:4400/render/story/${id}`, {...body})
  ).data;
  return result;
}

export class StoriesController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(StoryRepository)
    public StoryRepository: StoryRepository,

    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,

    @repository(ChartRepository)
    public chartRepository: ChartRepository,
  ) {}

  @post('/story')
  @response(200, {
    description: 'Story model instance',
    content: {'application/json': {schema: getModelSchemaRef(Story)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Story, {
            title: 'NewStory',
            exclude: ['id'],
          }),
        },
      },
    })
    Story: Omit<Story, 'id'>,
  ): Promise<
    | {data: Story; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    logger.info(`route </story> creating a new story`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userStoriesCount = await this.StoryRepository.count({
      owner: userId,
    });
    if (userStoriesCount.count >= userPlan.stories.noOfStories) {
      return {
        error: `You have reached the <b>${userPlan.stories.noOfStories}</b> story limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }
    Story.owner = userId;
    await handleDeleteCache({
      asset: 'story',
      userId,
    });
    return {
      data: await this.StoryRepository.create(Story),
      planWarning:
        userPlan.name === 'Enterprise' || userPlan.name === 'Beta'
          ? null
          : `(<b>${userStoriesCount.count + 1}</b>/${
              userPlan.stories.noOfStories
            }) stories left on the ${userPlan.name} plan. Upgrade to increase.`,
    };
  }

  @get('/stories/count')
  @response(200, {
    description: 'Story model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(
    @param.where(Story) where?: Where<Story>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<Count> {
    logger.info(`route </stories/count> getting stories count`);
    return getStoriesCount(
      this.StoryRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
      userOnly,
    );
  }

  @get('/stories/count/public')
  @response(200, {
    description: 'Story model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(@param.where(Story) where?: Where<Story>): Promise<Count> {
    logger.info(`route </stories/count/public> getting public stories count`);
    return getStoriesCount(this.StoryRepository, 'anonymous', where);
  }

  @get('/stories')
  @response(200, {
    description: 'Array of Story model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Story, {includeRelations: true}),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @intercept(cacheInterceptor({extraKey: 'stories', useUserId: true})) // caching per user
  async find(
    @param.filter(Story) filter?: Filter<Story>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<Story[]> {
    if (filter?.order && filter.order.includes('name')) {
      // @ts-ignore
      filter.order = filter.order.replace('name', 'nameLower');
    }
    logger.info(`route </stories> getting stories`);
    const stories = await getStories(
      this.StoryRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
      userOnly,
    );
    return addOwnerNameToAssets(stories);
  }

  @get('/stories/public')
  @response(200, {
    description: 'Array of Story model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Story, {includeRelations: true}),
        },
      },
    },
  })
  @intercept(cacheInterceptor())
  async findPublic(
    @param.filter(Story) filter?: Filter<Story>,
  ): Promise<Story[]> {
    if (filter?.order && filter.order.includes('name')) {
      // @ts-ignore
      filter.order = filter.order.replace('name', 'nameLower');
    }

    logger.info(`route </stories/public> getting public stories`);
    const stories = await getStories(this.StoryRepository, 'anonymous', filter);
    return addOwnerNameToAssets(stories);
  }

  @patch('/story')
  @response(200, {
    description: 'Story PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Story, {partial: true}),
        },
      },
    })
    Story: Story,
    @param.where(Story) where?: Where<Story>,
  ): Promise<Count> {
    logger.info(`route </story> updating all stories`);
    return this.StoryRepository.updateAll(Story, where);
  }

  @get('/story/{id}')
  @response(200, {
    description: 'Story model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Story, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @intercept(
    cacheInterceptor({
      useFirstPathParam: true,
      cacheId: 'story-detail',
      useUserId: true,
    }),
  )
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Story, {exclude: 'where'})
    filter?: FilterExcludingWhere<Story>,
  ): Promise<Story | {error: string}> {
    logger.info(`route </story/{id}> getting story by id ${id}`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const story = await this.StoryRepository.findById(id, filter);
    if (
      story.public ||
      story.baseline ||
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(story, 'owner', '')) !== -1 ||
      _.get(story, 'owner', '') === userId
    ) {
      return story;
    }
    logger.info(`route </story/{id}> unauthorized`);
    return {error: 'Unauthorized', name: story.name};
  }

  @get('/story/public/{id}')
  @response(200, {
    description: 'Story model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Story, {includeRelations: true}),
      },
    },
  })
  @intercept(
    cacheInterceptor({
      useFirstPathParam: true,
      cacheId: 'public-story-detail',
    }),
  )
  async findPublicById(
    @param.path.string('id') id: string,
    @param.filter(Story, {exclude: 'where'})
    filter?: FilterExcludingWhere<Story>,
  ): Promise<Story | {error: string}> {
    logger.info(`route </story/public/{id}> getting public story by id ${id}`);
    const story = await this.StoryRepository.findById(id, filter);
    if (story.public || story.baseline || story.owner === 'anonymous') {
      logger.info(`route </story/public/{id}> story found`);
      return story;
    } else {
      logger.info(`route </story/public/{id}> unauthorized`);
      return {error: 'Unauthorized', name: story.name};
    }
  }

  @post('/story/{id}/render')
  @response(200, {
    description: 'Story model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Story, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async renderById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    logger.info(`route </story/{id}/render> rendering story by id ${id}`);
    return renderStory(
      this.StoryRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }

  @post('/story/{id}/render/public')
  @response(200, {
    description: 'Story model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Story, {includeRelations: true}),
      },
    },
  })
  async renderPublicById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    logger.info(
      `route </story/{id}/render/public> rendering public story by id ${id}`,
    );
    return renderStory(this.StoryRepository, id, body, 'anonymous');
  }

  @patch('/story/{id}')
  @response(204, {
    description: 'Story PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Story, {partial: true}),
        },
      },
    })
    story: Story,
  ): Promise<void | {error: string}> {
    logger.info(`route </story/{id}> updating story by id ${id}`);
    const dBstory = await this.StoryRepository.findById(id);
    if (dBstory.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    await this.StoryRepository.updateById(id, {
      ...story,
      updatedDate: new Date().toISOString(),
    });
    await handleDeleteCache({
      asset: 'story',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }

  @put('/story/{id}')
  @response(204, {
    description: 'Story PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() Story: Story,
  ): Promise<void | {error: string}> {
    logger.info(`route </story/{id}> updating story by id ${id}`);
    const dBstory = await this.StoryRepository.findById(id);
    if (dBstory.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    logger.info(`route </story/{id}> replacing story by id ${id}`);
    await this.StoryRepository.replaceById(id, Story);
    await handleDeleteCache({
      asset: 'story',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }

  @del('/story/{id}')
  @response(204, {
    description: 'Story DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(
    @param.path.string('id') id: string,
  ): Promise<void | {error: string}> {
    logger.info(`route </story/{id}> deleting story by id ${id}`);
    logger.info(`route </story/{id}> updating story by id ${id}`);
    const dBstory = await this.StoryRepository.findById(id);
    if (dBstory.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    await this.StoryRepository.deleteById(id);
    await handleDeleteCache({
      asset: 'story',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }

  @get('/story/duplicate/{id}')
  @response(200, {
    description: 'Story model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Story, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicate(
    @param.path.string('id') id: string,
  ): Promise<
    | {data: Story; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    logger.info(`route </story/duplicate/{id}> duplicating story by id ${id}`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userStoriesCount = await this.StoryRepository.count({
      owner: userId,
    });
    if (userStoriesCount.count >= userPlan.stories.noOfStories) {
      return {
        error: `You have reached the <b>${userPlan.stories.noOfStories}</b> story limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }

    const fStory = await this.StoryRepository.findById(id);

    const name = await duplicateName(
      fStory.name,
      fStory.owner === userId,
      this.StoryRepository,
      userId,
    );

    // Duplicate Story
    const newStory = await this.StoryRepository.create({
      name,
      showHeader: fStory.showHeader,
      title: fStory.title,
      description: fStory.description,
      heading: fStory.heading,
      rows: fStory.rows,
      public: false,
      baseline: false,
      backgroundColor: fStory.backgroundColor,
      titleColor: fStory.titleColor,
      descriptionColor: fStory.descriptionColor,
      dateColor: fStory.dateColor,
      owner: userId,
    });
    await handleDeleteCache({
      asset: 'story',
      userId,
    });
    return {
      data: newStory,
      planWarning:
        userPlan.name === 'Enterprise' || userPlan.name === 'Beta'
          ? null
          : `(<b>${userStoriesCount.count + 1}</b>/${
              userPlan.stories.noOfStories
            }) stories left on the ${userPlan.name} plan. Upgrade to increase.`,
    };
  }

  @get('/youtube/search')
  @response(200, {
    description: 'Youtube search',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async searchYoutube(
    @param.query.string('q') q: string,
    @param.query.string('maxResults') maxResults: string,
    @param.query.string('pageToken') pageToken: string,
  ): Promise<object> {
    logger.info(`route </youtube/search> searching youtube for ${q}`);
    try {
      const response = await axios.get(
        `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&pageToken=${pageToken}&q=${q}&key=${process.env.GOOGLE_API_KEY}&type=video&videoEmbeddable=true&videoSyndicated=true`,
      );
      return response.data;
    } catch (err) {
      logger.error(`route </youtube/search> ${err}`);
      return [];
    }
  }

  @get('/vimeo/search')
  @response(200, {
    description: 'Vimeo search',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async searchVimeo(
    @param.query.string('q') q: string,
    @param.query.string('perPage') perPage: string,
    @param.query.string('page') page: string,
  ): Promise<object> {
    logger.info(`route </vimeo/search> searching vimeo for ${q}`);
    try {
      const response = await axios.get(
        `https://api.vimeo.com/videos?query=${q}&per_page=${perPage}&page=${page}&filter=content_rating&filter_content_rating=safe`,
        {
          headers: {
            Authorization: `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          },
        },
      );
      return response.data;
    } catch (err) {
      logger.error(`route </vimeo/search> ${err}`);
      return [];
    }
  }

  @get('/shutterstock/image/search')
  @response(200, {
    description: 'Shutterstock search',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async searchShutterstock(
    @param.query.string('q') q: string,
    @param.query.string('perPage') perPage: string,
    @param.query.string('page') page: string,
  ): Promise<object> {
    logger.info(
      `route </shutterstock/image/search> searching shutterstock for ${q}`,
    );
    try {
      const response = await axios.get(
        `https://api.shutterstock.com/v2/images/search?per_page=${perPage}&page=${page}&query=${q}&sort=popular`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SHUTTERSTOCK_API_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (err) {
      logger.error(`route </shutterstock/image/search> ${err?.message}`);
      return [];
    }
  }

  @get('/unsplash/image/search')
  @response(200, {
    description: 'Unsplash search',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async searchUnsplash(
    @param.query.string('q') q: string,
    @param.query.string('perPage') perPage: string,
    @param.query.string('page') page: string,
  ): Promise<object> {
    logger.info(`route </unsplash/image/search> searching unsplash for ${q}`);
    try {
      const response = await axios.get(
        `https://api.unsplash.com/search/photos?per_page=${perPage}&page=${page}&query=${q}`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
          },
        },
      );

      return response.data;
    } catch (err) {
      logger.error(`route </unsplash/image/search> ${err?.message}`);
      return [];
    }
  }
}
