import {authenticate} from '@loopback/authentication';
import {BindingKey, inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  Where,
  repository,
} from '@loopback/repository';
import {
  Request,
  RestBindings,
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
import axios from 'axios';
import {Dataset} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';

import {RequestHandler} from 'express-serve-static-core';
import _ from 'lodash';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {getUsersOrganizationMembers} from '../utils/auth';
import {getUserPlanData} from '../utils/planAccess';

type FileUploadHandler = RequestHandler;

const FILE_UPLOAD_SERVICE = BindingKey.create<FileUploadHandler>(
  'services.FileUpload',
);
let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
if (process.env.ENV_TYPE !== 'prod')
  host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;

export class DatasetController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,

    @repository(ChartRepository)
    public chartRepository: ChartRepository,

    @repository(ReportRepository)
    public reportRepository: ReportRepository,

    @inject(FILE_UPLOAD_SERVICE) private handler: FileUploadHandler,
  ) {}

  @post('/datasets')
  @response(200, {
    description: 'Dataset model instance',
    // content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
    content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDataset',
          }),
        },
      },
    })
    dataset: Dataset,
  ): Promise<
    | {data: Dataset; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userDatasetsCount = await this.datasetRepository.count({
      owner: userId,
    });
    if (userDatasetsCount.count >= userPlan.datasets.noOfDatasets) {
      return {
        error: `You have reached the ${userPlan.datasets.noOfDatasets} dataset limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }

    dataset.owner = userId;
    logger.info(`route </datasets> -  Dataset created`);
    return {
      data: await this.datasetRepository.create(dataset),
      planWarning:
        userPlan.name === 'Enterprise'
          ? null
          : `(<b>${userDatasetsCount.count + 1}</b>/${
              userPlan.datasets.noOfDatasets
            }) datasets left on the ${
              userPlan.name
            } plan. Upgrade to increase.`,
    };
  }

  @get('/datasets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(
    @param.where(Dataset) where?: Where<Dataset>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<Count> {
    logger.info(`route </datasets/count> -  get datasets count`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    if (userId && userId !== 'anonymous') {
      if (userOnly) {
        return this.datasetRepository.count({
          ...where,
          owner: userId,
        });
      }
      const orgMembers = await getUsersOrganizationMembers(userId);
      const orgMemberIds = orgMembers.map((m: any) => m.user_id);
      return this.datasetRepository.count({
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
    }
    return this.datasetRepository.count({
      ...where,
      or: [{owner: userId}, {public: true}, {baseline: true}],
    });
  }

  @get('/datasets/count/public')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    logger.info(`route </datasets/count/public> -  get public datasets count`);
    return this.datasetRepository.count({
      ...where,
      or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
    });
  }

  @get('/datasets')
  @response(200, {
    description: 'Array of Dataset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Dataset, {includeRelations: true}),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(
    @param.filter(Dataset) filter?: Filter<Dataset>,
    @param.query.boolean('userOnly') userOnly?: boolean,
  ): Promise<Dataset[]> {
    logger.info(`route </datasets> -  get datasets`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    if (userId && userId !== 'anonymous') {
      if (userOnly) {
        return this.datasetRepository.find({
          ...filter,
          where: {
            ...filter?.where,
            owner: userId,
          },
        });
      }
      const orgMembers = await getUsersOrganizationMembers(userId);
      const orgMemberIds = orgMembers.map((m: any) => m.user_id);
      return this.datasetRepository.find({
        ...filter,
        where: {
          ...filter?.where,
          or: [
            {owner: userId},
            {
              owner: {
                inq: orgMemberIds,
              },
            },
          ],
        },
      });
    }
    return this.datasetRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        or: [{owner: userId}, {public: true}, {baseline: true}],
      },
    });
  }

  @get('/datasets/public')
  @response(200, {
    description: 'Array of Dataset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Dataset, {includeRelations: true}),
        },
      },
    },
  })
  async findPublic(
    @param.filter(Dataset) filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    logger.info(`route </datasets/public> -  get public datasets`);
    return this.datasetRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        or: [{public: true}, {owner: 'anonymous'}, {baseline: true}],
      },
    });
  }

  @patch('/datasets')
  @response(200, {
    description: 'Dataset PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    logger.info(`route </datasets> -  update all datasets`);
    return this.datasetRepository.updateAll(dataset, where);
  }

  @get('/datasets/{id}')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'})
    filter?: FilterExcludingWhere<Dataset>,
  ): Promise<Dataset | {error: string}> {
    logger.info(`route </datasets/{id}> -  get dataset by id: ${id}`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const dataset = await this.datasetRepository.findById(id, filter);
    if (
      dataset.public ||
      dataset.baseline ||
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(dataset, 'owner', '')) !== -1 ||
      _.get(dataset, 'owner', '') === userId
    ) {
      return dataset;
    }
    logger.info(`route </datasets/{id}> unauthorized`);
    return {name: dataset.name, error: 'Unauthorized'};
  }

  @get('/datasets/public/{id}')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  async findByIdPublic(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'})
    filter?: FilterExcludingWhere<Dataset>,
  ): Promise<Dataset | {error: string}> {
    logger.info(`route </datasets/{id}> -  get dataset by id: ${id}`);
    const dataset = await this.datasetRepository.findById(id, filter);
    if (dataset.public || dataset.baseline || dataset.owner === 'anonymous') {
      logger.info(`route </datasets/public/{id}> dataset found`);
      return dataset;
    } else {
      logger.info(`route </datasets/public/{id}> unauthorized`);
      return {name: dataset.name, error: 'Unauthorized'};
    }
  }

  @get('/datasets/{id}/data')
  @response(200, {
    description: 'Dataset content',
    content: {
      'application/json': {
        schema: [],
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async datasetContent(
    @param.path.string('id') id: string,
    @param.query.string('page') page: string,
    @param.query.string('pageSize') pageSize: string,
  ): Promise<any> {
    logger.info(
      `route </datasets/{id}/data> -  get dataset content by id: ${id}`,
    );
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const dataset = await this.datasetRepository.findById(id);
    if (
      !dataset.public &&
      !dataset.baseline &&
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(dataset, 'owner', '')) === -1 &&
      _.get(dataset, 'owner', '') !== userId
    ) {
      return {error: 'Unauthorized'};
    }

    return axios
      .get(
        `http://${host}:4004/dataset/${id}?page=${page}&page_size=${pageSize}`,
      )
      .then(res => {
        logger.info(
          `route </datasets/{id}/data> Data fetched for dataset ${id}`,
        );
        return res.data;
      })
      .catch(error => {
        console.log(error);
        logger.error(
          `route </datasets/{id}/data> Error fetching data for dataset ${id}; ${error}`,
        );
        return {
          data: [],
          error,
        };
      });
  }

  @get('/datasets/public/{id}/data')
  @response(200, {
    description: 'Dataset content',
    content: {
      'application/json': {
        schema: [],
      },
    },
  })
  async datasetContentPublic(
    @param.path.string('id') id: string,
    @param.query.string('page') page: string,
    @param.query.string('pageSize') pageSize: string,
  ): Promise<any> {
    logger.info(
      `route </datasets/{id}/data> -  get dataset content by id: ${id}`,
    );
    const dataset = await this.datasetRepository.findById(id);
    if (!dataset.public && !dataset.baseline && dataset.owner !== 'anonymous') {
      return {error: 'Unauthorized'};
    }
    return axios
      .get(
        `http://${host}:4004/dataset/${id}?page=${page}&page_size=${pageSize}`,
      )
      .then(res => {
        logger.info(
          `route </datasets/{id}/data> Data fetched for dataset ${id}`,
        );
        return res.data;
      })
      .catch(error => {
        console.log(error);
        logger.error(
          `route </datasets/{id}/data> Error fetching data for dataset ${id}; ${error}`,
        );
        return {
          data: [],
          error,
        };
      });
  }

  @patch('/datasets/{id}')
  @response(204, {
    description: 'Dataset PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
  ): Promise<void | {error: string}> {
    logger.info(`route </datasets/{id}> -  update dataset by id: ${id}`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const dbDataset = await this.datasetRepository.findById(id);
    if (dbDataset.owner !== userId) {
      return {error: 'Unauthorized'};
    }
    await this.datasetRepository.updateById(id, {
      ...dataset,
      updatedDate: new Date().toISOString(),
    });
  }

  @put('/datasets/{id}')
  @response(204, {
    description: 'Dataset PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() dataset: Dataset,
  ): Promise<void | {error: string}> {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const dbDataset = await this.datasetRepository.findById(id);
    if (dbDataset.owner !== userId) {
      return {error: 'Unauthorized'};
    }
    await this.datasetRepository.replaceById(id, dataset);
    logger.info(`route </datasets/{id}> -  Replaced Dataset by id: ${id}`);
  }
  @get('/datasets/{id}/charts-reports/count')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: {chartsCount: Number, reportsCount: Number},
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async getChartsReportsCount(
    @param.path.string('id') id: string,
  ): Promise<{chartsCount: number; reportsCount: number} | {error: string}> {
    logger.info(
      `route </datasets/{id}/charts-reports/count> -  get charts and reports count by dataset id: ${id}`,
    );

    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const dataset = await this.datasetRepository.findById(id);
    if (
      !dataset.public &&
      !dataset.baseline &&
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(dataset, 'owner', '')) === -1 &&
      _.get(dataset, 'owner', '') !== userId
    ) {
      return {error: 'Unauthorized'};
    }

    const chartIds = (
      await this.chartRepository.find({where: {datasetId: id}})
    ).map(c => c.id);
    return {
      chartsCount: (await this.chartRepository.count({datasetId: id})).count,
      reportsCount: (await this.reportRepository.execute?.(
        'Report',
        'countDocuments',
        {'rows.items': {$in: chartIds}},
      )) as unknown as number,
    };
  }

  @del('/datasets/{id}')
  @response(204, {
    description: 'Dataset DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(
    @param.path.string('id') id: string,
  ): Promise<void | {error: string}> {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const dbDataset = await this.datasetRepository.findById(id);
    if (dbDataset.owner !== userId) {
      return {error: 'Unauthorized'};
    }
    this.datasetRepository.findById(id).then(() => {
      // Trigger the dataset removal through the backend, cleaning up SSR and the backend
      let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
      if (process.env.ENV_TYPE !== 'prod')
        host = process.env.ENV_TYPE
          ? `dx-backend-${process.env.ENV_TYPE}`
          : host;
      axios
        .post(`http://${host}:4004/delete-dataset/dx${id}`)
        .then(_ => {
          logger.info(
            `route </datasets/{id}> -  File ${id} removed from DX Backend`,
          );
          console.log('File removed from DX Backend');
        })
        .catch(e => {
          logger.error(
            `route </datasets/{id}> -  Failed to remove the dataset ${id} from DX Backend`,
          );
          console.log(
            'Failed to remove the dataset from DX Backend',
            e.response.data.result,
          );
        });
    });
    await this.datasetRepository.deleteById(id);
    logger.info(
      `route </datasets/{id}> -  Deleting all charts that use dataset with id - ${id}`,
    );
    await this.chartRepository.deleteAll({datasetId: id});
    logger.info(`route </datasets/{id}> -  Dataset ${id} removed from db`);
  }

  @get('/dataset/duplicate/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicate(
    @param.path.string('id') id: string,
  ): Promise<
    | {data: Dataset; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    logger.info(
      `route </dataset/duplicate/{id}> -  finding dataset by id: ${id}`,
    );
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userDatasetsCount = await this.datasetRepository.count({
      owner: userId,
    });
    if (userDatasetsCount.count >= userPlan.datasets.noOfDatasets) {
      return {
        error: `You have reached the <b>${userPlan.datasets.noOfDatasets}</b> dataset limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }
    const fDataset = await this.datasetRepository.findById(id);
    const newDatasetPromise = this.datasetRepository.create({
      name: `${fDataset.name} (Copy)`,
      public: false,
      baseline: false,
      category: fDataset.category,
      description: fDataset.description,
      source: fDataset.source,
      sourceUrl: fDataset.sourceUrl,
      owner: userId,
    });

    const newDataset = await newDatasetPromise;
    logger.info(
      `route </dataset/duplicate/{id}> -  DX Backend duplication started`,
    );

    await axios
      .post(`http://${host}:4004/duplicate-dataset/${id}/${newDataset.id}`)
      .then(_ => {
        logger.info(
          `route </dataset/duplicate/{id}> -  DX Backend duplication complete`,
        );
        console.log('DX Backend duplication complete');
      })
      .catch(e => {
        console.log('DX Backend duplication failed', e.response.data.result);
        logger.error(
          `route </dataset/duplicate/{id}> -  DX Backend duplication failed`,
          e,
        );
        return {error: e.response.data.result};
      });

    return {
      data: newDataset,
      planWarning:
        userPlan.name === 'Enterprise'
          ? null
          : `(<b>${userDatasetsCount.count + 1}</b>/${
              userPlan.datasets.noOfDatasets
            }) datasets left on the ${
              userPlan.name
            } plan. Upgrade to increase.`,
    };
  }

  //external sources search
  @get('/external-sources/search')
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @response(200, {
    description: 'Dataset external search instance',
  })
  async searchExternalSources(
    @param.query.string('q') q: string,
    @param.query.string('source') source: string,
    @param.query.string('limit') limit: string,
    @param.query.string('offset') offset: string,
  ): Promise<any> {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    let _limit = limit;
    let _offset = offset;
    if (userPlan.name === 'Free') {
      _limit = '12';
      _offset = '0';
    }
    try {
      logger.info(
        'route </external-sources/search> -  Search external sources',
      );
      const response = await axios.post(
        `http://${host}:4004/external-sources/search-limited`,
        {
          owner: _.get(this.req, 'user.sub', 'anonymous'),
          query: q,
          source,
          limit: Number(_limit),
          offset: Number(_offset),
        },
      );
      logger.info(
        'route </external-sources/search> -  Searched external sources',
      );
      if (userPlan.name === 'Free') {
        return {
          result: response.data.result.slice(0, 12),
          planWarning: `The free plan displays only the first <b>12</b> results. Upgrade to increase.`,
        };
      }
      return {result: response.data.result};
    } catch (e) {
      console.log(e.response.data.result);
      logger.error(
        'route </external-sources/search> -  Error',
        e.response.data.result,
      );
      return {error: e.response.data.result};
    }
  }

  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @post('/external-sources/download')
  @response(200, {
    description: 'Dataset external search instance',
  })
  async downloadExternalSources(
    @requestBody()
    externalSource: {
      description: string;
      category: string;
      source: string;
      url: string;
      name: string;
      public: boolean;
      owner: string;
      authId: string;
      datePublished: string;
      id: string;
    },
  ): Promise<any> {
    try {
      logger.info(
        'route </external-sources/download> -  Download external sources',
      );
      const response = await axios.post(
        `http://${host}:4004/external-sources/download`,
        {
          externalSource: {
            ...externalSource,
            updatedDate: new Date().toISOString(),
            createdDate: new Date().toISOString(),
          },
        },
      );
      logger.info(
        'route </external-sources/download> -  Downloaded external sources',
      );
      return response.data.result;
    } catch (e) {
      console.log(e);
      logger.error('route </external-sources/download> -  Error', e);
      return {error: e.response.data.result};
    }
  }
}
