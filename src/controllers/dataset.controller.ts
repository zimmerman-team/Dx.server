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
import axios, {AxiosResponse} from 'axios';
import {Dataset} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';

import {RequestHandler} from 'express-serve-static-core';
import _ from 'lodash';
import mcache from 'memory-cache';
import {UserProfile} from '../authentication-strategies/user-profile';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {getUsersOrganizationMembers} from '../utils/auth';

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
  ): Promise<Dataset> {
    dataset.owner = _.get(this.req, 'user.sub', 'anonymous');
    logger.info(`route </datasets> -  Dataset created`);
    return this.datasetRepository.create(dataset);
  }

  @get('/datasets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Dataset) where?: Where<Dataset>): Promise<Count> {
    logger.info(`route </datasets/count> -  get datasets count`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    if (userId && userId !== 'anonymous') {
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
      or: [{owner: userId}, {public: true}],
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
      or: [{public: true}, {owner: 'anonymous'}],
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
  ): Promise<Dataset[]> {
    logger.info(`route </datasets> -  get datasets`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    if (userId && userId !== 'anonymous') {
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
        or: [{owner: userId}, {public: true}],
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
        or: [{public: true}, {owner: 'anonymous'}],
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
  ): Promise<Dataset> {
    logger.info(`route </datasets/{id}> -  get dataset by id: ${id}`);
    return this.datasetRepository.findById(id, filter);
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
  ): Promise<void> {
    logger.info(`route </datasets/{id}> -  update dataset by id: ${id}`);
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
  ): Promise<void> {
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
  ): Promise<{chartsCount: number; reportsCount: number}> {
    logger.info(
      `route </datasets/{id}/charts-reports/count> -  get charts and reports count by dataset id: ${id}`,
    );

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
  async deleteById(@param.path.string('id') id: string): Promise<void> {
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
        .catch(_ => {
          logger.error(
            `route </datasets/{id}> -  Failed to remove the dataset ${id} from DX Backend`,
          );
          console.log(
            'Failed to remove the dataset from DX Backend',
            String(_),
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
  async duplicate(@param.path.string('id') id: string): Promise<Dataset> {
    logger.info(
      `route </dataset/duplicate/{id}> -  finding dataset by id: ${id}`,
    );
    const fDataset = await this.datasetRepository.findById(id);
    const newDatasetPromise = this.datasetRepository.create({
      name: `${fDataset.name} (Copy)`,
      public: false,
      category: fDataset.category,
      description: fDataset.description,
      source: fDataset.source,
      sourceUrl: fDataset.sourceUrl,
      owner: _.get(this.req, 'user.sub', 'anonymous'),
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
        console.log('DX Backend duplication failed', e);
        logger.error(
          `route </dataset/duplicate/{id}> -  DX Backend duplication failed`,
          e,
        );
        return {error: 'Error duplicating files'};
      });

    return newDatasetPromise;
  }

  @get('/dataset/google-drive/user-token')
  @response(200, {
    description: 'User Token',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async getUserToken(): Promise<string> {
    logger.info('route </dataset/google-drive/user-token> -  get user Token');
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const profile = await UserProfile.getUserProfile(userId);
    const token = profile.identities[0].access_token;
    logger.info(
      'route </dataset/google-drive/user-token> -  user Token',
      token,
    );
    return token;
  }

  //external sources search
  @get('/external-sources/search')
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @response(200, {
    description: 'Dataset external search instance',
  })
  async searchExternalSources(
    @param.query.string('q') q: string,
  ): Promise<any> {
    try {
      logger.info(
        'route </external-sources/search> -  Search external sources',
      );
      const response = await axios.post(
        `http://${host}:4004/external-sources/search`,
        {
          owner: _.get(this.req, 'user.sub', 'anonymous'),
          query: q,
        },
      );
      logger.info(
        'route </external-sources/search> -  Searched external sources',
      );
      return response.data;
    } catch (e) {
      console.log(e);
      logger.error('route </external-sources/search> -  Error', e);
    }
  }

  //external sources limited search
  @get('/external-sources/search-limited')
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @response(200, {
    description: 'Dataset external search instance',
  })
  async LimitedSearchExternalSources(
    @param.query.string('q') q: string,
    @param.query.string('limit') limit: string,
    @param.query.string('offset') offset: string,
  ): Promise<any> {
    try {
      const sources = ['Kaggle', 'World Bank', 'WHO', 'HDX'];
      const dayInMs = 1000 * 60 * 60 * 24;
      const promises: Promise<AxiosResponse<any, any>>[] = [];

      const updateCache = (data: any) => {
        mcache.put('external_sources_data', JSON.stringify(data), dayInMs);
      };

      sources.forEach(source => {
        promises.push(
          axios.post(`http://${host}:4004/external-sources/search-limited`, {
            owner: _.get(this.req, 'user.sub', 'anonymous'),
            query: q,
            source,
            limit: Number(limit),
            offset: Number(offset),
          }),
        );
      });
      const getData = async () => {
        const responses = await Promise.all(promises);

        const data = responses.reduce(
          (prev: any, curr) => [...prev, ...curr.data],
          [],
        );
        return data;
      };

      if (q === '') {
        // caching data for empty string searches
        const cachedData = mcache.get('external_sources_data');

        if (cachedData) {
          // Caching the data in a progressive fashion based on the limit and offset
          const data = JSON.parse(cachedData)[limit][offset];

          if (data) {
            return _.shuffle(data);
          } else {
            const data = await getData();
            const dataToCache = {
              ...JSON.parse(cachedData),
              [limit]: {
                ...JSON.parse(cachedData)[limit],
                [offset]: data,
              },
            };
            updateCache(dataToCache);
            return _.shuffle(data);
          }
        } else {
          const data = await getData();
          const dataToCache = {
            [limit]: {[offset]: data},
          };
          updateCache(dataToCache);
          return _.shuffle(data);
        }
      } else {
        const data = await getData();
        return _.shuffle(data);
      }
    } catch (e) {
      console.log(e);
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
      return response.data;
    } catch (e) {
      console.log(e);
      logger.error('route </external-sources/download> -  Error', e);
    }
  }
}
