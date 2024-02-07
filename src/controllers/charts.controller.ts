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
import {Chart} from '../models';
import {ChartRepository} from '../repositories';
import {LoggingBindings, WinstonLogger, logInvocation} from '@loopback/logging';
import {winstonLogger} from '../config/logger/winston-logger';

async function getChartsCount(
  chartRepository: ChartRepository,
  owner?: string,
  where?: Where<Chart>,
) {
  winstonLogger.info(`route </charts/count> Fetching chart count with winston`);
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
  return chartRepository.find({
    ...filter,
    where: {
      ...filter?.where,
      or: [{owner: owner}, {public: true}],
    },
    fields: ['id', 'name', 'vizType', 'datasetId', 'public', 'createdDate'],
  });
}

async function renderChart(
  logger: WinstonLogger,
  chartRepository: ChartRepository,
  id: string,
  body: any,
  owner: string,
) {
  try {
    const chartData = id === 'new' ? {} : await chartRepository.findById(id);
    if (
      id !== 'new' &&
      !_.get(chartData, 'public') &&
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
      stdio: 'pipe',
    });
    // once the rendering is done, read the output file
    logger.debug(
      `fn <renderChart()> Reading rendered chart data from file- ${id}_rendered.json`,
    );
    const data = fs.readFileSync(
      `./src/utils/renderChart/dist/rendering/${id}_rendered.json`,
    );

    // clean temp files
    logger.debug(`fn <renderChart()> Cleaning temp files for chart- ${id}`);
    fs.removeSync(`./src/utils/renderChart/dist/rendering/${id}.json`);
    fs.removeSync(`./src/utils/renderChart/dist/rendering/${id}_rendered.json`);

    // return jsonified data
    logger.info(`fn <renderChart()> Chart- ${id} rendered`);
    return JSON.parse(data.toString());
  } catch (err) {
    logger.error(`fn <renderChart()> Error rendering chart- ${id}; ${err}`);
    console.error(err);
    return {error: err};
  }
}

export class ChartsController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(ChartRepository)
    public chartRepository: ChartRepository,
  ) {}
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  /* create chart */
  @post('/chart')
  @logInvocation()
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
    this.logger.info(`route </chart> Creating chart: ${chart.name}`);
    return this.chartRepository.create(chart);
  }

  /* get chart dataset sample data */
  @get('/chart/sample-data/{datasetId}')
  @logInvocation()
  @response(200)
  async sampleData(@param.path.string('datasetId') datasetId: string) {
    let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
    if (process.env.ENV_TYPE !== 'prod')
      host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;
    this.logger.info(
      `route </chart/sample-data/{datasetId}> Fetching sample data for dataset ${datasetId}`,
    );
    return axios
      .get(`http://${host}:4004/sample-data/${datasetId}`)
      .then(res => {
        this.logger.info(
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
        this.logger.error(
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
  @logInvocation()
  @response(200, {
    description: 'Chart model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Chart) where?: Where<Chart>): Promise<Count> {
    this.logger.info(`route </charts/count> Fetching chart count`);
    return getChartsCount(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }
  @get('/charts/count/public')
  @logInvocation()
  @response(200, {
    description: 'Chart model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(@param.where(Chart) where?: Where<Chart>): Promise<Count> {
    this.logger.info(
      `route </charts/count/public> Fetching public chart count`,
    );
    return getChartsCount(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }

  /* get charts */
  @get('/charts')
  @logInvocation()
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
    this.logger.info(`route</charts> Fetching charts`);
    return getCharts(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  @get('/charts/public')
  @logInvocation()
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
    this.logger.info(`Fetching public charts`);
    return getCharts(
      this.chartRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  /* patch charts */

  @patch('/chart')
  @logInvocation()
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
    this.logger.info(
      `route</chart> Updating chart- ${chart.id} ; where: ${JSON.stringify(
        where,
      )}`,
    );
    return this.chartRepository.updateAll(chart, where);
  }

  /* get chart */
  @get('/chart/{id}')
  @logInvocation()
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
    this.logger.info(`route</chart/{id}> Fetching chart- ${id}`);
    this.logger.debug(
      `Finding chart- ${id} with filter- ${JSON.stringify(filter)}`,
    );
    const chart = await this.chartRepository.findById(id, filter);
    if (
      chart.public ||
      chart.owner === _.get(this.req, 'user.sub', 'anonymous')
    ) {
      this.logger.info(`route</chart/{id}> Chart- ${id} found`);
      return chart;
    } else {
      this.logger.error(
        `route</chart/{id}> Unauthorized access to chart- ${id}`,
      );
      return {name: '', error: 'Unauthorized'};
    }
  }

  @get('/chart/public/{id}')
  @logInvocation()
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
    if (chart.public) {
      this.logger.info(
        `route</chart/public/{id}> Fetching public chart- ${id}`,
      );
      return chart;
    } else {
      this.logger.error(
        `route</chart/public/{id}> Unauthorized access to public chart- ${id}`,
      );
      return {name: '', error: 'Unauthorized'};
    }
  }

  /* render chart */
  @post('/chart/{id}/render')
  @logInvocation()
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
    this.logger.info(`route</chart/{id}/render> Rendering chart- ${id}`);

    return renderChart(
      this.logger,
      this.chartRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }
  /* render chart; public */
  @post('/chart/{id}/render/public')
  @logInvocation()
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
    this.logger.info(
      `route</chart/{id}/render/public> Rendering public chart- ${id}`,
    );
    return renderChart(
      this.logger,
      this.chartRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }

  /* patch chart */

  @patch('/chart/{id}')
  @logInvocation()
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
    this.logger.info(`route</chart/{id}> Updating chart- ${id}`);
  }

  /* put chart */
  @put('/chart/{id}')
  @logInvocation()
  @response(204, {
    description: 'Chart PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() chart: Chart,
  ): Promise<void> {
    this.logger.info(`route</chart/{id}> Replacing chart- ${id}`);
    await this.chartRepository.replaceById(id, chart);
  }

  /* delete chart */
  @del('/chart/{id}')
  @logInvocation()
  @response(204, {
    description: 'Chart DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    this.logger.info(`route</chart/{id}> Deleting chart- ${id}`);
    await this.chartRepository.deleteById(id);
  }

  /* duplicate chart */
  @get('/chart/duplicate/{id}')
  @logInvocation()
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
    this.logger.info(`route </chart/duplicate/{id}> Duplicating chart- ${id}`);
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
