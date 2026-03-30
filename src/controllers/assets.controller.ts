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
  HttpErrors,
  Request,
  RestBindings,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import axios from 'axios';
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
import {addOwnerNameToAssets, handleDeleteCache} from '../utils/redis';

type AssetType = 'chart' | 'dataset' | 'story';
type AssetDeleteItem = {assetType: AssetType; id: string};
type DeleteAssetsRequest = {
  assets?: AssetDeleteItem[];
  deleteAllCharts?: boolean;
  deleteAllDatasets?: boolean;
  deleteAllStories?: boolean;
};

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
    @param.query.string('filterValue') filterValue?: string,
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

    const ownerFilter = {
      myAssets: [{owner: owner}],
      dataxplorerAssets: [{baseline: true}],
      allAssets: [
        {owner: owner},
        {baseline: true},
        {owner: {inq: orgMemberIds}},
      ],
    }[filterValue ?? 'myAssets'];

    const charts = await this.chartRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [...(ownerFilter ?? [])],
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
        or: [...(ownerFilter ?? [])],
      },
    });
    const stories = await this.storyRepository.find({
      ...filter,
      limit,
      offset,
      where: {
        ...filter?.where,
        or: [...(ownerFilter ?? [])],
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
    return addOwnerNameToAssets(
      _.orderBy(
        [
          ...charts.map(chart => ({...chart, assetType: 'chart'})),
          ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
          ...stories.map(story => ({...story, assetType: 'story'})),
        ],
        orderField,
        orderDirection,
      ),
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
        'baseline',
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
        'baseline',
      ],
    });
    return addOwnerNameToAssets(
      _.orderBy(
        [
          ...charts.map(chart => ({...chart, assetType: 'chart'})),
          ...datasets.map(dataset => ({...dataset, assetType: 'dataset'})),
          ...stories.map(story => ({...story, assetType: 'story'})),
        ],
        orderField,
        orderDirection,
      ),
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
    @param.query.string('filterValue') filterValue?: string,
  ): Promise<Count> {
    logger.info(`route </assets/count> -  get datasets count`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);

    const ownerFilter = {
      myAssets: [{owner: userId}],
      dataxplorerAssets: [{baseline: true}],
      allAssets: [
        {owner: userId},
        {baseline: true},
        {owner: {inq: orgMemberIds}},
      ],
    }[filterValue ?? 'myAssets'];

    const datasetsCount = await this.datasetRepository.count({
      ...where,
      or: [...(ownerFilter ?? [])],
    });
    const chartsCount = await this.chartRepository.count({
      ...where,
      or: [...(ownerFilter ?? [])],
    });
    const storiesCount = await this.storyRepository.count({
      ...where,
      or: [...(ownerFilter ?? [])],
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

  @post('/assets/delete')
  @response(200, {
    description: 'Asset successfully deleted.',
    content: {'application/json': {schema: {type: 'object'}}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteAssets(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              assets: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['assetType', 'id'],
                  properties: {
                    assetType: {
                      type: 'string',
                      enum: ['chart', 'dataset', 'story'],
                    },
                    id: {type: 'string'},
                  },
                },
              },
              deleteAllCharts: {type: 'boolean'},
              deleteAllDatasets: {type: 'boolean'},
              deleteAllStories: {type: 'boolean'},
            },
          },
        },
      },
    })
    body: DeleteAssetsRequest,
  ): Promise<{
    deleted: Record<AssetType, number>;
    skipped: {notFound: AssetDeleteItem[]; unauthorized: AssetDeleteItem[]};
  }> {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const assets = Array.isArray(body?.assets) ? body.assets : [];
    const deleteAll = {
      chart: Boolean(body?.deleteAllCharts),
      dataset: Boolean(body?.deleteAllDatasets),
      story: Boolean(body?.deleteAllStories),
    };

    if (
      !assets.length &&
      !deleteAll.chart &&
      !deleteAll.dataset &&
      !deleteAll.story
    ) {
      throw new HttpErrors.BadRequest(
        'Provide assets[] and/or deleteAll flags (chart, dataset, story).',
      );
    }

    const deleted: Record<AssetType, number> = {chart: 0, dataset: 0, story: 0};
    const skipped: {
      notFound: AssetDeleteItem[];
      unauthorized: AssetDeleteItem[];
    } = {notFound: [], unauthorized: []};

    const chartIds = _.uniq(
      assets
        .filter(a => a.assetType === 'chart')
        .map(a => a.id)
        .filter(Boolean),
    );
    const storyIds = _.uniq(
      assets
        .filter(a => a.assetType === 'story')
        .map(a => a.id)
        .filter(Boolean),
    );
    const datasetIds = _.uniq(
      assets
        .filter(a => a.assetType === 'dataset')
        .map(a => a.id)
        .filter(Boolean),
    );

    if (deleteAll.chart) {
      const chartsCount = await this.chartRepository.count({owner: userId});
      await this.chartRepository.deleteAll({owner: userId});
      await handleDeleteCache({asset: 'chart', userId});
      deleted.chart += chartsCount.count;
    }

    if (deleteAll.story) {
      const storiesCount = await this.storyRepository.count({owner: userId});
      await this.storyRepository.deleteAll({owner: userId});
      await handleDeleteCache({asset: 'story', userId});
      deleted.story += storiesCount.count;
    }

    if (deleteAll.dataset) {
      const ownedDatasets = await this.datasetRepository.find({
        where: {owner: userId},
        fields: ['id'],
      });
      const ownedDatasetIds = ownedDatasets
        .map(d => d.id)
        .filter(Boolean) as string[];
      if (ownedDatasetIds.length) {
        for (const datasetId of ownedDatasetIds) {
          await this.deleteDatasetFromBackendService(datasetId);
        }
        await this.datasetRepository.deleteAll({owner: userId});
        await this.chartRepository.deleteAll({
          datasetId: {inq: ownedDatasetIds},
        });
        await handleDeleteCache({asset: 'dataset', userId});
        await handleDeleteCache({asset: 'chart', userId});
      }
      deleted.dataset += ownedDatasetIds.length;
    }

    for (const id of chartIds) {
      try {
        const chart = await this.chartRepository.findById(id);
        if (chart.owner !== userId) {
          skipped.unauthorized.push({assetType: 'chart', id});
          continue;
        }
        await this.chartRepository.deleteById(id);
        await handleDeleteCache({asset: 'chart', assetId: id, userId});
        deleted.chart += 1;
      } catch {
        skipped.notFound.push({assetType: 'chart', id});
      }
    }

    for (const id of storyIds) {
      try {
        const story = await this.storyRepository.findById(id);
        if (story.owner !== userId) {
          skipped.unauthorized.push({assetType: 'story', id});
          continue;
        }
        await this.storyRepository.deleteById(id);
        await handleDeleteCache({asset: 'story', assetId: id, userId});
        deleted.story += 1;
      } catch {
        skipped.notFound.push({assetType: 'story', id});
      }
    }

    for (const id of datasetIds) {
      try {
        const dataset = await this.datasetRepository.findById(id);
        if (dataset.owner !== userId) {
          skipped.unauthorized.push({assetType: 'dataset', id});
          continue;
        }
        await this.deleteDatasetFromBackendService(id);
        await this.datasetRepository.deleteById(id);
        await this.chartRepository.deleteAll({datasetId: id});
        await handleDeleteCache({asset: 'dataset', assetId: id, userId});
        await handleDeleteCache({asset: 'chart', userId});
        deleted.dataset += 1;
      } catch {
        skipped.notFound.push({assetType: 'dataset', id});
      }
    }

    logger.info(
      `route </assets> deleted assets for user ${userId}: ${JSON.stringify({
        deleted,
        skipped,
      })}`,
    );
    return {deleted, skipped};
  }

  private async deleteDatasetFromBackendService(id: string): Promise<void> {
    try {
      const backendHost = this.getBackendHost();
      await axios.post(`http://${backendHost}:4004/delete-dataset/dx${id}`);
      logger.info(`Dataset ${id} successfully removed from DX Backend`);
    } catch (error) {
      logger.error(`Failed to remove dataset ${id} from DX Backend:`, error);
    }
  }

  private getBackendHost(): string {
    if (process.env.BACKEND_SUBDOMAIN) {
      return 'dx-backend';
    }

    if (process.env.ENV_TYPE && process.env.ENV_TYPE !== 'prod') {
      return `dx-backend-${process.env.ENV_TYPE}`;
    }

    return 'localhost';
  }
}
