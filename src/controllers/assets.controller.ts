import {authenticate} from '@loopback/authentication';
import {inject, intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  Where,
  repository,
} from '@loopback/repository';
import {
  Request,
  RestBindings,
  get,
  getModelSchemaRef,
  param,
  response,
} from '@loopback/rest';
import _ from 'lodash';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {cacheInterceptor} from '../interceptors/cache.interceptor';
import {Chart, Dataset, Story} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  StoryRepository,
} from '../repositories';
import {getUsersOrganizationMembers} from '../utils/auth';

export class AssetController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,

    @repository(ChartRepository)
    public chartRepository: ChartRepository,

    @repository(StoryRepository)
    public storyRepository: StoryRepository,
  ) {}

  /* get assets */
  @get('/assets')
  @response(200, {
    description: 'Array of Chart model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Chart || Dataset || Story, {
            includeRelations: true,
          }),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @intercept(cacheInterceptor({useUserId: true, extraKey: 'assets'}))
  async find(
    @param.filter(Chart || Dataset || Story)
    filter?: Filter<Chart | Dataset | Story>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<any[]> {
    const owner = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    logger.info(`route</assets> Fetching assets`);

    const limit = Math.floor((filter?.limit || 0) / 3);
    const offset = Math.floor((filter?.offset || 0) / 3);
    const orderField = (filter?.order as unknown as string)?.split(' ')[0];
    const orderDirection = (filter?.order as unknown as string)?.split(
      ' ',
    )[1] as 'asc' | 'desc';

    const charts = await this.chartRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [
          {owner: owner},
          ...(userOnly ? [] : [{owner: {inq: orgMemberIds}}]),
        ],
      },
      fields: [
        'id',
        'name',
        'vizType',
        'datasetId',
        'public',
        'createdDate',
        'updatedDate',
        'isMappingValid',
        'isAIAssisted',
        'owner',
      ],
    });
    const datasets = await this.datasetRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [
          {owner: owner},
          {
            owner: {
              inq: orgMemberIds,
            },
          },
        ],
      },
    });
    const stories = await this.storyRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [{owner: owner}, {owner: {inq: orgMemberIds}}],
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
    return _.orderBy(
      [
        ...charts.map(chart => ({...chart, assetType: 'chart'})),
        ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
        ...stories.map(story => ({...story, assetType: 'story'})),
      ],
      orderField,
      orderDirection,
    );
  }

  @get('/assets/public')
  @response(200, {
    description: 'Array of Chart model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Chart, {includeRelations: true}),
        },
      },
    },
  })
  @intercept(cacheInterceptor())
  async findPublic(
    @param.filter(Chart || Dataset || Story)
    filter?: Filter<Chart | Dataset | Story>,
  ): Promise<any[]> {
    logger.info(`Fetching public assets`);
    const limit = Math.floor((filter?.limit || 0) / 3);
    const offset = Math.floor((filter?.offset || 0) / 3);
    const orderField = (filter?.order as unknown as string)?.split(' ')[0];
    const orderDirection = (filter?.order as unknown as string)?.split(
      ' ',
    )[1] as 'asc' | 'desc';

    const charts = await this.chartRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
      },
      fields: [
        'id',
        'name',
        'vizType',
        'datasetId',
        'public',
        'createdDate',
        'updatedDate',
        'isMappingValid',
        'isAIAssisted',
        'owner',
      ],
    });
    const datasets = await this.datasetRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
      },
    });
    const stories = await this.storyRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
      },
      fields: [
        'id',
        'name',
        'createdDate',
        'updatedDate',
        'showHeader',
        'backgroundColor',
        'title',
        'description',
        'heading',
        'public',
        'owner',
      ],
    });
    return _.orderBy(
      [
        ...charts.map(chart => ({...chart, assetType: 'chart'})),
        ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
        ...stories.map(story => ({...story, assetType: 'story'})),
      ],
      orderField,
      orderDirection,
    );
  }

  @get('/assets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(
    @param.where(Dataset || Story || Chart) where?: Where<Dataset>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<Count> {
    logger.info(`route </assets/count> -  get datasets count`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    const datasetsCount = await this.datasetRepository.count({
      ...where,
      or: [
        {owner: userId},
        ...(userOnly ? [] : [{owner: {inq: orgMemberIds}}]),
      ],
    });
    const chartsCount = await this.chartRepository.count({
      ...where,
      or: [
        {owner: userId},
        {
          owner: {
            inq: orgMemberIds,
          },
        },
      ],
    });
    const storiesCount = await this.storyRepository.count({
      ...where,
      or: [
        {owner: userId},
        {
          owner: {
            inq: orgMemberIds,
          },
        },
      ],
    });

    return {
      count: datasetsCount.count + chartsCount.count + storiesCount.count,
    };
  }

  @get('/assets/count/public')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(
    @param.where(Dataset || Story || Chart) where?: Where<Dataset>,
  ): Promise<Count> {
    logger.info(`route </assets/count/public> -  get datasets count`);
    const datasetsCount = await this.datasetRepository.count({
      ...where,
      or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
    });
    const chartsCount = await this.chartRepository.count({
      ...where,
      or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
    });
    const storiesCount = await this.storyRepository.count({
      ...where,
      or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
    });

    return {
      count: datasetsCount.count + chartsCount.count + storiesCount.count,
    };
  }
}
