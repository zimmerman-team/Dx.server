import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
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
import {Chart, Dataset, Report} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';
import {getUsersOrganizationMembers} from '../utils/auth';

export class AssetController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,

    @repository(ChartRepository)
    public chartRepository: ChartRepository,

    @repository(ReportRepository)
    public reportRepository: ReportRepository,
  ) {}

  /* get assets */
  @get('/assets')
  @response(200, {
    description: 'Array of Chart model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Chart || Dataset || Report, {
            includeRelations: true,
          }),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(
    @param.filter(Chart || Dataset || Report)
    filter?: Filter<Chart | Dataset | Report>,
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
        or: [{owner: owner}, {owner: {inq: orgMemberIds}}],
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
    const reports = await this.reportRepository.find({
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
        'subTitle',
        'public',
        'owner',
      ],
    });
    return _.orderBy(
      [
        ...charts.map(chart => ({...chart, assetType: 'chart'})),
        ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
        ...reports.map(report => ({...report, assetType: 'report'})),
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
  async findPublic(
    @param.filter(Chart || Dataset || Report)
    filter?: Filter<Chart | Dataset | Report>,
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
    const reports = await this.reportRepository.find({
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
        'subTitle',
        'public',
        'owner',
      ],
    });
    return _.orderBy(
      [
        ...charts.map(chart => ({...chart, assetType: 'chart'})),
        ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
        ...reports.map(report => ({...report, assetType: 'report'})),
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
    @param.where(Dataset || Report || Chart) where?: Where<Dataset>,
  ): Promise<Count> {
    logger.info(`route </assets/count> -  get datasets count`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');

    const orgMembers = await getUsersOrganizationMembers(userId);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    const datasetsCount = await this.datasetRepository.count({
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
    const reportsCount = await this.reportRepository.count({
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
      count: datasetsCount.count + chartsCount.count + reportsCount.count,
    };
  }

  @get('/assets/count/public')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(
    @param.where(Dataset || Report || Chart) where?: Where<Dataset>,
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
    const reportsCount = await this.reportRepository.count({
      ...where,
      or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
    });

    return {
      count: datasetsCount.count + chartsCount.count + reportsCount.count,
    };
  }
}
