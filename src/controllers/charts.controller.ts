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
  requestBody,
  response,
} from '@loopback/rest';
import axios from 'axios';
import {Chart} from '../models';
import {ChartRepository} from '../repositories';

export class ChartsController {
  constructor(
    @repository(ChartRepository)
    public chartRepository: ChartRepository,
  ) {}

  @post('/chart')
  @response(200, {
    description: 'Chart model instance',
    content: {'application/json': {schema: getModelSchemaRef(Chart)}},
  })
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
    return this.chartRepository.create(chart);
  }

  @get('/charts/count')
  @response(200, {
    description: 'Chart model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(@param.where(Chart) where?: Where<Chart>): Promise<Count> {
    return this.chartRepository.count(where);
  }

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
  async find(@param.filter(Chart) filter?: Filter<Chart>): Promise<Chart[]> {
    return this.chartRepository.find({
      ...filter,
      fields: ['id', 'name', 'vizType', 'datasetId', 'createdDate'],
    });
  }

  @patch('/chart')
  @response(200, {
    description: 'Chart PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
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
    return this.chartRepository.updateAll(chart, where);
  }

  @get('/chart/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Chart, {exclude: 'where'})
    filter?: FilterExcludingWhere<Chart>,
  ): Promise<Chart> {
    return this.chartRepository.findById(id, filter);
  }

  @post('/chart/{id}/render')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  async renderById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    const result = await (
      await axios.post(`http://localhost:4400/render/chart/${id}`, {...body})
    ).data;
    return result;
  }

  @patch('/chart/{id}')
  @response(204, {
    description: 'Chart PATCH success',
  })
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
    await this.chartRepository.updateById(id, chart);
  }

  @put('/chart/{id}')
  @response(204, {
    description: 'Chart PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() chart: Chart,
  ): Promise<void> {
    await this.chartRepository.replaceById(id, chart);
  }

  @del('/chart/{id}')
  @response(204, {
    description: 'Chart DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.chartRepository.deleteById(id);
  }

  @get('/chart/duplicate/{id}')
  @response(200, {
    description: 'Chart model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Chart, {includeRelations: true}),
      },
    },
  })
  async duplicate(@param.path.string('id') id: string): Promise<Chart> {
    const fChart = await this.chartRepository.findById(id);
    return this.chartRepository.create({
      name: `${fChart.name} copy`,
      public: fChart.public,
      vizType: fChart.vizType,
      datasetId: fChart.datasetId,
      mapping: fChart.mapping,
      vizOptions: fChart.vizOptions,
      appliedFilters: fChart.appliedFilters,
      enabledFilterOptionGroups: fChart.enabledFilterOptionGroups,
    });
  }
}
