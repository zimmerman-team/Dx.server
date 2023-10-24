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
import _ from 'lodash';
import {Report} from '../models';
import {ReportRepository} from '../repositories';

export class ReportsController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(ReportRepository)
    public ReportRepository: ReportRepository,
  ) {}

  @post('/report')
  @response(200, {
    description: 'Report model instance',
    content: {'application/json': {schema: getModelSchemaRef(Report)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {
            title: 'NewReport',
            exclude: ['id'],
          }),
        },
      },
    })
    Report: Omit<Report, 'id'>,
  ): Promise<Report> {
    Report.owner = _.get(this.req, 'user.sub', 'anonymous');
    return this.ReportRepository.create(Report);
  }

  @get('/reports/count')
  @response(200, {
    description: 'Report model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Report) where?: Where<Report>): Promise<Count> {
    return this.ReportRepository.count({
      ...where,
      or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
    });
  }

  @get('/reports')
  @response(200, {
    description: 'Array of Report model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Report, {includeRelations: true}),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(@param.filter(Report) filter?: Filter<Report>): Promise<Report[]> {
    return this.ReportRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
      },
      fields: [
        'id',
        'name',
        'createdDate',
        'showHeader',
        'backgroundColor',
        'title',
        'subTitle',
      ],
    });
  }

  @patch('/report')
  @response(200, {
    description: 'Report PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {partial: true}),
        },
      },
    })
    Report: Report,
    @param.where(Report) where?: Where<Report>,
  ): Promise<Count> {
    return this.ReportRepository.updateAll(Report, where);
  }

  @get('/report/{id}')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: 'where'})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report> {
    const report = await this.ReportRepository.findById(id, filter);
    return report;
  }

  @post('/report/{id}/render')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async renderById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    const host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
    const result = await (
      await axios.post(`http://${host}:4400/render/report/${id}`, {...body})
    ).data;
    return result;
  }

  @patch('/report/{id}')
  @response(204, {
    description: 'Report PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {partial: true}),
        },
      },
    })
    report: Report,
  ): Promise<void> {
    await this.ReportRepository.updateById(id, {
      ...report,
      updatedDate: new Date().toISOString(),
    });
  }

  @put('/report/{id}')
  @response(204, {
    description: 'Report PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() Report: Report,
  ): Promise<void> {
    await this.ReportRepository.replaceById(id, Report);
  }

  @del('/report/{id}')
  @response(204, {
    description: 'Report DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.ReportRepository.deleteById(id);
  }

  @get('/report/duplicate/{id}')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicate(@param.path.string('id') id: string): Promise<Report> {
    const fReport = await this.ReportRepository.findById(id);
    fReport.owner = _.get(this.req, 'user.sub', 'anonymous');
    return this.ReportRepository.create({
      name: `${fReport.name} copy`,
      showHeader: fReport.showHeader,
      title: fReport.title,
      subTitle: fReport.subTitle,
      rows: fReport.rows,
      public: fReport.public,
      backgroundColor: fReport.backgroundColor,
      titleColor: fReport.titleColor,
      descriptionColor: fReport.descriptionColor,

      dateColor: fReport.dateColor,
    });
  }
}
