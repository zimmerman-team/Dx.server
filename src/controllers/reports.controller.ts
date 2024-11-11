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
import {Report} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';
import {getUsersOrganizationMembers} from '../utils/auth';
import {getUserPlanData} from '../utils/planAccess';
import {handleDeleteCache} from '../utils/redis';

let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
if (process.env.ENV_TYPE !== 'prod')
  host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;

async function getReportsCount(
  reportRepository: ReportRepository,
  owner?: string,
  where?: Where<Report>,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return reportRepository.count({
      ...where,
      or: [{owner: owner}, {owner: {inq: orgMemberIds}}],
    });
  }
  return reportRepository.count({
    ...where,
    or: [{owner: owner}, {public: true}, {baseline: true}],
  });
}
//get reports
async function getReports(
  reportRepository: ReportRepository,
  owner?: string,
  filter?: Filter<Report>,
) {
  if (owner && owner !== 'anonymous') {
    const orgMembers = await getUsersOrganizationMembers(owner);
    const orgMemberIds = orgMembers.map((m: any) => m.user_id);
    return reportRepository.find({
      ...filter,
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
  }
  return reportRepository.find({
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

async function renderReport(
  chartRepository: ReportRepository,
  id: string,
  body: any,
  owner: string,
) {
  const report = await chartRepository.findById(id);
  const orgMembers = await getUsersOrganizationMembers(owner);
  if (
    !report ||
    (!report.public &&
      !report.baseline &&
      orgMembers
        .map((m: any) => m.user_id)
        .indexOf(_.get(report, 'owner', '')) === -1 &&
      _.get(report, 'owner', '') !== owner)
  ) {
    return;
  }
  const host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
  const result = await (
    await axios.post(`http://${host}:4400/render/report/${id}`, {...body})
  ).data;
  return result;
}

export class ReportsController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(ReportRepository)
    public ReportRepository: ReportRepository,

    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,

    @repository(ChartRepository)
    public chartRepository: ChartRepository,
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
  ): Promise<
    | {data: Report; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    logger.info(`route </report> creating a new report`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userReportsCount = await this.ReportRepository.count({
      owner: userId,
    });
    if (userReportsCount.count >= userPlan.reports.noOfReports) {
      return {
        error: `You have reached the <b>${userPlan.reports.noOfReports}</b> report limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }
    Report.owner = userId;
    await handleDeleteCache({
      asset: 'report',
      userId,
    });
    return {
      data: await this.ReportRepository.create(Report),
      planWarning:
        userPlan.name === 'Enterprise' || userPlan.name === 'Beta'
          ? null
          : `(<b>${userReportsCount.count + 1}</b>/${
              userPlan.reports.noOfReports
            }) reports left on the ${userPlan.name} plan. Upgrade to increase.`,
    };
  }

  @get('/reports/count')
  @response(200, {
    description: 'Report model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Report) where?: Where<Report>): Promise<Count> {
    logger.info(`route </reports/count> getting reports count`);
    return getReportsCount(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }

  @get('/reports/count/public')
  @response(200, {
    description: 'Report model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(
    @param.where(Report) where?: Where<Report>,
  ): Promise<Count> {
    logger.info(`route </reports/count/public> getting public reports count`);
    return getReportsCount(this.ReportRepository, 'anonymous', where);
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
  @intercept(cacheInterceptor({extraKey: 'reports', useUserId: true})) // caching per user
  async find(@param.filter(Report) filter?: Filter<Report>): Promise<Report[]> {
    if (filter?.order && filter.order.includes('name')) {
      // @ts-ignore
      filter.order = filter.order.replace('name', 'nameLower');
    }
    logger.info(`route </reports> getting reports`);
    return getReports(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  @get('/reports/public')
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
  @intercept(cacheInterceptor())
  async findPublic(
    @param.filter(Report) filter?: Filter<Report>,
  ): Promise<Report[]> {
    if (filter?.order && filter.order.includes('name')) {
      // @ts-ignore
      filter.order = filter.order.replace('name', 'nameLower');
    }

    logger.info(`route </reports/public> getting public reports`);
    return getReports(this.ReportRepository, 'anonymous', filter);
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
    logger.info(`route </report> updating all reports`);
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
  @intercept(
    cacheInterceptor({useFirstPathParam: true, cacheId: 'report-detail'}),
  )
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: 'where'})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report | {error: string}> {
    logger.info(`route </report/{id}> getting report by id ${id}`);
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const orgMembers = await getUsersOrganizationMembers(userId);
    const report = await this.ReportRepository.findById(id, filter);
    if (
      report.public ||
      report.baseline ||
      orgMembers
        .map((o: any) => o.user_id)
        .indexOf(_.get(report, 'owner', '')) !== -1 ||
      _.get(report, 'owner', '') === userId
    ) {
      return report;
    }
    logger.info(`route </report/{id}> unauthorized`);
    return {error: 'Unauthorized', name: report.name};
  }

  @get('/report/public/{id}')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @intercept(
    cacheInterceptor({
      useFirstPathParam: true,
      cacheId: 'public-report-detail',
    }),
  )
  async findPublicById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: 'where'})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report | {error: string}> {
    logger.info(
      `route </report/public/{id}> getting public report by id ${id}`,
    );
    const report = await this.ReportRepository.findById(id, filter);
    if (report.public || report.baseline || report.owner === 'anonymous') {
      logger.info(`route </report/public/{id}> report found`);
      return report;
    } else {
      logger.info(`route </report/public/{id}> unauthorized`);
      return {error: 'Unauthorized', name: report.name};
    }
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
    logger.info(`route </report/{id}/render> rendering report by id ${id}`);
    return renderReport(
      this.ReportRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }

  @post('/report/{id}/render/public')
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  async renderPublicById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    logger.info(
      `route </report/{id}/render/public> rendering public report by id ${id}`,
    );
    return renderReport(this.ReportRepository, id, body, 'anonymous');
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
  ): Promise<void | {error: string}> {
    logger.info(`route </report/{id}> updating report by id ${id}`);
    const dBreport = await this.ReportRepository.findById(id);
    if (dBreport.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    await this.ReportRepository.updateById(id, {
      ...report,
      updatedDate: new Date().toISOString(),
    });
    await handleDeleteCache({
      asset: 'report',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
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
  ): Promise<void | {error: string}> {
    logger.info(`route </report/{id}> updating report by id ${id}`);
    const dBreport = await this.ReportRepository.findById(id);
    if (dBreport.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    logger.info(`route </report/{id}> replacing report by id ${id}`);
    await this.ReportRepository.replaceById(id, Report);
    await handleDeleteCache({
      asset: 'report',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }

  @del('/report/{id}')
  @response(204, {
    description: 'Report DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(
    @param.path.string('id') id: string,
  ): Promise<void | {error: string}> {
    logger.info(`route </report/{id}> deleting report by id ${id}`);
    logger.info(`route </report/{id}> updating report by id ${id}`);
    const dBreport = await this.ReportRepository.findById(id);
    if (dBreport.owner !== _.get(this.req, 'user.sub')) {
      return {error: 'Unauthorized'};
    }
    await this.ReportRepository.deleteById(id);
    await handleDeleteCache({
      asset: 'report',
      assetId: id,
      userId: _.get(this.req, 'user.sub', 'anonymous'),
    });
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
  async duplicate(
    @param.path.string('id') id: string,
  ): Promise<
    | {data: Report; planWarning: string | null}
    | {error: string; errorType: string}
  > {
    logger.info(
      `route </report/duplicate/{id}> duplicating report by id ${id}`,
    );
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const userPlan = await getUserPlanData(userId);
    const userReportsCount = await this.ReportRepository.count({
      owner: userId,
    });
    if (userReportsCount.count >= userPlan.reports.noOfReports) {
      return {
        error: `You have reached the <b>${userPlan.reports.noOfReports}</b> report limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }
    const fReport = await this.ReportRepository.findById(id);
    // Duplicate Report
    const newReport = await this.ReportRepository.create({
      name: `${fReport.name} (Copy)`,
      showHeader: fReport.showHeader,
      title: fReport.title,
      description: fReport.description,
      heading: fReport.heading,
      rows: fReport.rows,
      public: false,
      baseline: false,
      backgroundColor: fReport.backgroundColor,
      titleColor: fReport.titleColor,
      descriptionColor: fReport.descriptionColor,
      dateColor: fReport.dateColor,
      owner: userId,
    });
    await handleDeleteCache({
      asset: 'report',
      userId,
    });
    return {
      data: newReport,
      planWarning:
        userPlan.name === 'Enterprise' || userPlan.name === 'Beta'
          ? null
          : `(<b>${userReportsCount.count + 1}</b>/${
              userPlan.reports.noOfReports
            }) reports left on the ${userPlan.name} plan. Upgrade to increase.`,
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
