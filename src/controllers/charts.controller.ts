import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
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
import {execSync} from 'child_process';
import fs from 'fs-extra';
import _ from 'lodash';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {Chart} from '../models';
import {ChartRepository} from '../repositories';
import {getUsersOrganizationMembers} from '../utils/auth';

async function getChartsCount(
  chartRepository: ChartRepository,
  owner?: string,
  where?: Where<Chart>,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return chartRepository.count({
      ...where,
      or: [{owner: owner}, {owner: {inq: orgMemberIds}}],
    });
  }
  logger.info(`route </charts/count> Fetching chart count for owner- ${owner}`);
  return chartRepository.count({
    ...where,
    or: [{owner: owner}, {public: true}],
  });
}

async function getCharts(
  chartRepository: ChartRepository,
  owner?: string,
  filter?: Filter<Chart>,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return chartRepository.find({
      ...filter,
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
        'isMappingValid',
      ],
    });
  }
  return chartRepository.find({
    ...filter,
    where: {
      ...filter?.where,
      or: [{owner: owner}, {public: true}],
    },
    fields: [
      'id',
      'name',
      'vizType',
      'datasetId',
      'public',
      'createdDate',
      'isMappingValid',
    ],
  });
}

async function renderChart(
  chartRepository: ChartRepository,
  id: string,
  body: any,
  owner: string,
) {
  try {
    const orgMembers = await getUsersOrganizationMembers(owner);
    logger.info('fn <renderChart()> calling renderChart function');
    const chartData = id === 'new' ? {} : await chartRepository.findById(id);
    if (
      id !== 'new' &&
      !_.get(chartData, 'public') &&
      orgMembers
        .map((m: any) => m.user_id)
        .indexOf(_.get(chartData, 'owner', '')) === -1 &&
      _.get(chartData, 'owner', '') !== owner
    ) {
      return;
    }
    // save an object with ({...body}, chartData) with identifiers as body and chardata as json
    const ob = {
      body: {...body},
      chartData: chartData,
    };
    logger.debug(`fn <renderChart()> Writing chart data to file- ${id}.json`);
    fs.writeFileSync(
      `./src/utils/renderChart/dist/rendering/${id}.json`,
      JSON.stringify(ob, null, 4),
    );
    // execute the ./src/utiles/renderChart/dist/index.cjs with id as the parameter
    logger.debug(`fn <renderChart()> executing renderChart for chart- ${id}`);
    execSync(`node ./src/utils/renderChart/dist/index.cjs ${id}`, {
      timeout: 0,
      stdio: 'ignore',
    });
    // once the rendering is done, read the output file
    logger.debug(
      `fn <renderChart()> Reading rendered chart data from file- ${id}_rendered.json`,
    );
    const data = fs.readFileSync(
      `./src/utils/renderChart/dist/rendering/${id}_rendered.json`,
    );

    logger.debug(
      `fn <renderChart()> Reading rendered chart data from file- ${id}_rendered.json`,
    );
    logger.verbose(
      `fn <renderChart()> rendered chart data: ${data.toString()}`,
    );

    // clean temp files
    logger.debug(`fn <renderChart()> Cleaning temp files for chart- ${id}`);
    fs.removeSync(`./src/utils/renderChart/dist/rendering/${id}.json`);
    fs.removeSync(`./src/utils/renderChart/dist/rendering/${id}_rendered.json`);

    // return jsonified data
    logger.info(
      `fn <renderChart()> Chart with id: ${id} rendered data: ${JSON.parse(
        data.toString(),
      )}`,
    );
    return JSON.parse(data.toString());
  } catch (err) {
    logger.error(`fn <renderChart()> Error rendering chart with id: ${id}; `);
    console.error(err);
    return {error: 'Error rendering chart!'};
  }
}

export class ChartsController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(ChartRepository)
    public chartRepository: ChartRepository,
  ) {}

  /* create chart */
  @post('/chart')
  @response(200, {
    description: 'Chart model instance',
    content: {'application/json': {schema: getModelSchemaRef(Chart)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Chart, {
            title: 'NewChart',
            exclude: ['id'],
          }),
        },
      },
    })
    chart: Omit<Chart, 'id'>,
  ): Promise<Chart> {
    chart.owner = _.get(this.req, 'user.sub', 'anonymous');
    logger.info(`route </chart> Creating chart: ${chart.name}`);
    return this.chartRepository.create(chart);
  }

  /* get chart dataset sample data */
  @get('/chart/sample-data/{datasetId}')
  @response(200)
  async sampleData(@param.path.string('datasetId') datasetId: string) {
    let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
    if (process.env.ENV_TYPE !== 'prod')
      host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;
    logger.info(
      `route </chart/sample-data/{datasetId}> Fetching sample data for dataset ${datasetId}`,
    );
    return axios
      .get(`http://${host}:4004/sample-data/${datasetId}`)
      .then(res => {
        logger.info(
          `route </chart/sample-data/{datasetId}> Sample data fetched for dataset ${datasetId}`,
        );
        return {
          count: _.get(res, 'data.count', []),
          sample: _.get(res, 'data.sample', []),
          dataTypes: _.get(res, 'data.dataTypes', []),
          filterOptionGroups: _.get(res, 'data.filterOptionGroups', []),
          stats: _.get(res, 'data.stats', []),
        };
      })
      .catch(error => {
        console.log(error);
        logger.error(
          `route </chart/sample-data/{datasetId}> Error fetching sample data for dataset ${datasetId}; ${error}`,
        );
        return {
          data: [],
          error,
        };
      });
  }

  /* charts count */
  @get('/charts/count')
  @response(200, {
    description: 'Chart model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Chart) where?: Where<Chart>): Promise<Count> {
    logger.verbose(`route </charts/count> Fetching chart count`);
    return getChartsCount(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }
  @get('/charts/count/public')
  @response(200, {
    description: 'Chart model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(@param.where(Chart) where?: Where<Chart>): Promise<Count> {
    logger.info(`route </charts/count/public> Fetching public chart count`);
    return getChartsCount(this.chartRepository, 'anonymous', where);
  }

  /* get charts */
  @get('/charts')
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
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(@param.filter(Chart) filter?: Filter<Chart>): Promise<Chart[]> {
    logger.info(`route</charts> Fetching charts`);
    return getCharts(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  @get('/charts/public')
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
    @param.filter(Chart) filter?: Filter<Chart>,
  ): Promise<Chart[]> {
    logger.info(`Fetching public charts`);
    return getCharts(this.chartRepository, 'anonymous', filter);
  }

  /* patch charts */

  @patch('/chart')
  @response(200, {
    description: 'Chart PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Chart, {partial: true}),
        },
      },
    })
    chart: Chart,
    @param.where(Chart) where?: Where<Chart>,
  ): Promise<Count> {
    logger.info(
      `route</chart> Updating chart- ${chart.id} ; where: ${JSON.stringify(
        where,
      )}`,
    );
    return this.chartRepository.updateAll(chart, where);
  }

  /* get chart */
  @get('/chart/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Chart, {exclude: 'where'})
    filter?: FilterExcludingWhere<Chart>,
  ): Promise<Chart | {name: string; error: string}> {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    logger.info(`route</chart/{id}> Fetching chart- ${id}`);
    logger.debug(`Finding chart- ${id} with filter- ${JSON.stringify(filter)}`);
    const chart = await this.chartRepository.findById(id, filter);
    if (
      chart.public ||
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(chart, 'owner', '')) !== -1 ||
      _.get(chart, 'owner', '') === userId
    ) {
      logger.info(`route</chart/{id}> Chart- ${id} found`);
      return chart;
    } else {
      logger.error(`route</chart/{id}> Unauthorized access to chart- ${id}`);
      return {name: '', error: 'Unauthorized'};
    }
  }

  @get('/chart/public/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  async findPublicById(
    @param.path.string('id') id: string,
    @param.filter(Chart, {exclude: 'where'})
    filter?: FilterExcludingWhere<Chart>,
  ): Promise<Chart | {name: string; error: string}> {
    const chart = await this.chartRepository.findById(id, filter);
    if (chart.public || chart.owner === 'anonymous') {
      logger.info(`route</chart/public/{id}> Fetching public chart- ${id}`);
      return chart;
    } else {
      logger.error(
        `route</chart/public/{id}> Unauthorized access to public chart- ${id}`,
      );
      return {name: '', error: 'Unauthorized'};
    }
  }

  /* render chart */
  @post('/chart/{id}/render')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async renderById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    logger.info(`route</chart/{id}/render> Rendering chart- ${id}`);
    const chartData =
      id === 'new'
        ? {datasetId: body.rows[0][0].datasetId}
        : await this.chartRepository.findById(id);

    let parsed = null;

    try {
      const filePath =
        process.env.PARSED_DATA_FILES_PATH ||
        `../dx.backend/parsed-data-files/`;
      const parsedData = fs.readFileSync(
        `${filePath}${chartData.datasetId}.json`,
      );
      parsed = JSON.parse(parsedData.toString());
    } catch (err) {
      logger.error(
        `route</chart/{id}/render> Error fetching parsed data for dataset- ${chartData.datasetId}`,
      );
      console.error(err);
    }

    if (!parsed?.dataset) {
      logger.error(
        `route</chart/{id}/render> could not find parsed dataset with id- ${chartData.datasetId}`,
      );
      return {
        error: 'The data for this chart is no longer available.',
      };
    }

    return renderChart(
      this.chartRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }
  /* render chart; public */
  @post('/chart/{id}/render/public')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  async renderByIdPublic(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    logger.info(
      `route</chart/{id}/render/public> Rendering public chart- ${id}`,
    );
    return renderChart(this.chartRepository, id, body, 'anonymous');
  }

  /* patch chart */

  @patch('/chart/{id}')
  @response(204, {
    description: 'Chart PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Chart, {partial: true}),
        },
      },
    })
    chart: Chart,
  ): Promise<void> {
    await this.chartRepository.updateById(id, {
      ...chart,
      updatedDate: new Date().toISOString(),
    });
    logger.info(`route</chart/{id}> Updating chart- ${id}`);
  }

  /* put chart */
  @put('/chart/{id}')
  @response(204, {
    description: 'Chart PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() chart: Chart,
  ): Promise<void> {
    logger.info(`route</chart/{id}> Replacing chart- ${id}`);
    await this.chartRepository.replaceById(id, chart);
  }

  /* delete chart */
  @del('/chart/{id}')
  @response(204, {
    description: 'Chart DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    logger.info(`route</chart/{id}> Deleting chart- ${id}`);
    await this.chartRepository.deleteById(id);
  }

  /* duplicate chart */
  @get('/chart/duplicate/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicate(@param.path.string('id') id: string): Promise<Chart> {
    logger.info(`route </chart/duplicate/{id}> Duplicating chart- ${id}`);
    const fChart = await this.chartRepository.findById(id);
    return this.chartRepository.create({
      name: `${fChart.name} (Copy)`,
      public: false,
      vizType: fChart.vizType,
      datasetId: fChart.datasetId,
      mapping: fChart.mapping,
      vizOptions: fChart.vizOptions,
      appliedFilters: fChart.appliedFilters,
      enabledFilterOptionGroups: fChart.enabledFilterOptionGroups,
      owner: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }
}
