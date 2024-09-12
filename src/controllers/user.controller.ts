import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  Request,
  RestBindings,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import axios from 'axios';
import {ObjectId} from 'bson';
import _ from 'lodash';
import {UserProfile} from '../authentication-strategies/user-profile';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {Report} from '../models';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';
import {deleteIntercomUser, sendContactForm} from '../utils/intercom';
import {getUserPlanData} from '../utils/planAccess';

let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
if (process.env.ENV_TYPE !== 'prod')
  host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;

export class UserController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  @repository(DatasetRepository)
  public datasetRepository: DatasetRepository;

  @repository(ChartRepository)
  public chartRepository: ChartRepository;

  @repository(ReportRepository)
  public reportRepository: ReportRepository;

  @post('/users/duplicate-assets')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicateAssets(): Promise<{message: string}> {
    const userProfile = await UserProfile.getUserProfile(
      _.get(this.req, 'user.sub', 'anonymous'),
    );
    const loginsCount = _.get(userProfile, 'logins_count', 0);
    // To know if the user is logging in for the first time
    if (loginsCount === 1) {
      const datasetsIds: {ds_name: string; new_ds_name: string}[] = [];
      const chartsIds: {chart_id: string; new_chart_id: string}[] = [];

      const datasets = await this.datasetRepository.find({
        where: {baseline: true},
      });
      const reports = await this.reportRepository.find({
        where: {baseline: true},
      });
      const charts = await this.chartRepository.find({
        where: {baseline: true},
      });

      const userChartCount = await this.chartRepository.count({
        or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
      });
      const userReportCount = await this.reportRepository.count({
        or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
      });
      const userDatasetCount = await this.datasetRepository.count({
        or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
      });

      if (
        // Ensuring that assets have not been duplicated for the user before
        userChartCount.count === 0 &&
        userReportCount.count === 0 &&
        userDatasetCount.count === 0
      ) {
        // Duplicate Datasets
        await Promise.all(
          datasets.map(async dataset => {
            const newDataset = await this.datasetRepository.create({
              name: `${dataset.name} (Copy)`,
              public: false,
              baseline: false,
              category: dataset.category,
              description: dataset.description,
              source: dataset.source,
              sourceUrl: dataset.sourceUrl,
              owner: _.get(this.req, 'user.sub', 'anonymous'),
            });

            datasetsIds.push({
              ds_name: dataset.id ?? '',
              new_ds_name: newDataset.id ?? '',
            });
          }),
        );

        await axios
          .post(`http://${host}:4004/duplicate-datasets`, datasetsIds)
          .then(_ => {
            logger.info(
              `route <users/duplicate-assets> -  DX Backend duplication complete`,
            );
            console.log('DX Backend duplication complete');
          })
          .catch(e => {
            console.log('DX Backend duplication failed', e);
            logger.error(
              `route <users/duplicate-assets> -  DX Backend duplication failed`,
              e.response.data.result,
            );
            return {error: e.response.data.result};
          });

        // Duplicate  Charts
        await Promise.all(
          charts.map(async chart => {
            const newChart = await this.chartRepository.create({
              name: `${chart.name} (Copy)`,
              public: false,
              baseline: false,
              vizType: chart.vizType,
              datasetId:
                datasetsIds.find(d => d.ds_name === chart.datasetId)
                  ?.new_ds_name ?? chart.datasetId,
              mapping: chart.mapping,
              vizOptions: chart.vizOptions,
              appliedFilters: chart.appliedFilters,
              enabledFilterOptionGroups: chart.enabledFilterOptionGroups,
              owner: _.get(this.req, 'user.sub', 'anonymous'),
              isMappingValid: chart.isMappingValid ?? true,
              isAIAssisted: chart.isAIAssisted ?? false,
            });

            chartsIds.push({
              chart_id: chart.id ?? '',
              new_chart_id: newChart.id ?? '',
            });
          }),
        );

        // Duplicate Reports
        reports.forEach(report => {
          this.reportRepository.create({
            name: `${report.name} (Copy)`,
            showHeader: report.showHeader,
            title: report.title,
            subTitle: report.subTitle,
            rows: report.rows.map(row => {
              // Update the old chartIds to the new ones
              return {
                ...row,
                items: row.items.map(item => {
                  if (typeof item === 'string' && ObjectId.isValid(item)) {
                    return (
                      chartsIds.find(c => c.chart_id === item)?.new_chart_id ??
                      item
                    );
                  } else {
                    return item;
                  }
                }),
              };
            }),
            public: false,
            baseline: false,
            backgroundColor: report.backgroundColor,
            titleColor: report.titleColor,
            descriptionColor: report.descriptionColor,
            dateColor: report.dateColor,
            owner: _.get(this.req, 'user.sub', 'anonymous'),
          });
        });
      }

      return {message: 'success'};
    } else {
      return {message: 'User has already logged in before'};
    }
  }

  @post('/users/delete-account')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteAccount(): Promise<{message: string} | {error: string}> {
    logger.info(`route <users/delete-account> -  delete user`);
    try {
      const userId = _.get(this.req, 'user.sub');
      if (userId) {
        if (process.env.ENV_TYPE === 'prod') {
          // Intercom is only available in production
          const response = await deleteIntercomUser(userId);
          if (response.error) {
            return response;
          }
          logger.info(
            `route <users/delete-account> - Intercom User account deleted: ${response.data}`,
          );
        }

        await UserProfile.deleteUser(userId);
        const datasetIds = (
          await this.datasetRepository.find({where: {owner: userId}})
        ).map(d => d.id);

        await axios
          .post(`http://${host}:4004/delete-datasets`, datasetIds)
          .then(_ => {
            logger.info(
              `route <users/delete-account> -  DX Backend deletion complete`,
            );
            console.log('DX Backend deletion complete');
          })
          .catch(e => {
            console.log('DX Backend deletion failed', e);
            logger.error(
              `route <users/delete-account> -  DX Backend deletion failed`,
              e.response.data.result,
            );
            return {error: e.response.data.result};
          });

        await this.datasetRepository.deleteAll({owner: userId});
        await this.chartRepository.deleteAll({owner: userId});
        await this.reportRepository.deleteAll({owner: userId});

        return {message: 'success'};
      } else {
        return {error: 'User not found'};
      }
    } catch (error) {
      logger.error(
        `route <users/delete-account> -  Error deleting user account: ${error}`,
      );
      return {error: 'Error deleting user account'};
    }
  }

  @patch('/users/update-profile')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateProfile(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    userDetails: {
      name: string;
    },
  ): Promise<{name: string} | {error: string}> {
    try {
      const response = await UserProfile.updateUserProfile(
        _.get(this.req, 'user.sub', 'anonymous'),
        {name: userDetails.name},
      );
      return {name: response.name};
    } catch (error) {
      logger.error(
        `route <users/update-profile> -  Error updating user profile: ${error}`,
      );
      return {error: 'Error updating user profile'};
    }
  }

  @get('/users/profile/{id}')
  @response(200)
  async getUserDetails(
    @param.path.string('id') id: string,
  ): Promise<{username: any} | {error: string}> {
    try {
      const response = await UserProfile.getUserProfile(id);
      return {username: response.given_name};
    } catch (error) {
      logger.error(
        `route <users/profile/{id}> -  Error getting user profile: ${error}`,
      );
      return {error: 'Error getting user profile'};
    }
  }

  @get('/users/intercom-hash')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async getIntercomHash(): Promise<{hash: string} | {error: string}> {
    const userId = _.get(this.req, 'user.sub');
    if (userId) {
      const crypto = require('crypto');

      const secretKey = process.env.INTERCOM_SECRET_KEY; // an Identity Verification secret key (web)
      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(userId)
        .digest('hex');
      return {hash};
    }
    return {
      error: 'User not found',
    };
  }

  @get('/users/google-drive/user-token')
  @response(200, {
    description: 'User Token',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async getUserToken(): Promise<any> {
    logger.info('route </users/google-drive/user-token> -  get user Token');
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const profile = await UserProfile.getUserProfile(userId);
    const connection = profile.identities?.[0]?.connection;
    if (connection !== 'google-oauth2') {
      return {error: 'User is not signed in with a Google account'};
    }
    const token = profile.identities[0].access_token;

    const tokenDetails = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`,
    );
    return {
      access_token: token,
      token_details: tokenDetails.data,
    };
  }

  @get('/users/duplicate-landing-report/{id}')
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
    logger.info(
      `route </report/duplicate/{id}> duplicating report by id ${id}`,
    );
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const fReport = await this.reportRepository.findById(id);

    const userFReport = await this.reportRepository.findOne({
      where: {
        title: fReport.title,
        owner: userId,
        backgroundColor: fReport.backgroundColor,
      },
    });
    if (userFReport && fReport.owner !== userId) {
      return userFReport;
    }
    let reportChartIds: string[] = [];
    if (fReport.rows) {
      fReport.rows.forEach(row => {
        if (row.items) {
          row.items.forEach(item => {
            if (typeof item === 'string' && ObjectId.isValid(item)) {
              reportChartIds.push(item);
            }
          });
        }
      });
    }
    const chartsInReport = await this.chartRepository.find({
      where: {id: {inq: reportChartIds}},
    });

    const datasetsInReport = await this.datasetRepository.find({
      where: {id: {inq: chartsInReport.map(c => c.datasetId)}},
    });

    const datasetsIds: {ds_name: string; new_ds_name: string}[] = [];
    const chartsIds: {chart_id: string; new_chart_id: string}[] = [];

    // Duplicate Datasets
    await Promise.all(
      datasetsInReport.map(async dataset => {
        if (dataset.owner === userId) {
          return;
        }
        const newDataset = await this.datasetRepository.create({
          name: `${dataset.name}`,
          public: false,
          baseline: false,
          category: dataset.category,
          description: dataset.description,
          source: dataset.source,
          sourceUrl: dataset.sourceUrl,
          owner: userId,
        });

        datasetsIds.push({
          ds_name: dataset.id ?? '',
          new_ds_name: newDataset.id ?? '',
        });
      }),
    );
    await axios
      .post(`http://${host}:4004/duplicate-datasets`, datasetsIds)
      .then(_ => {
        logger.info(
          `route <users/duplicate-assets> -  DX Backend duplication complete`,
        );
        console.log('DX Backend duplication complete');
      })
      .catch(e => {
        console.log('DX Backend duplication failed', e);
        logger.error(
          `route <users/duplicate-assets> -  DX Backend duplication failed`,
          e.response.data.result,
        );
        return {error: e.response.data.result};
      });

    // Duplicate Charts
    await Promise.all(
      chartsInReport.map(async chart => {
        if (chart.owner === userId) {
          return;
        }
        const newChart = await this.chartRepository.create({
          name: `${chart.name}`,
          public: false,
          baseline: false,
          vizType: chart.vizType,
          datasetId:
            datasetsIds.find(d => d.ds_name === chart.datasetId)?.new_ds_name ??
            chart.datasetId,
          mapping: chart.mapping,
          vizOptions: chart.vizOptions,
          appliedFilters: chart.appliedFilters,
          enabledFilterOptionGroups: chart.enabledFilterOptionGroups,
          owner: userId,
          isMappingValid: chart.isMappingValid ?? true,
          isAIAssisted: chart.isAIAssisted ?? false,
        });

        chartsIds.push({
          chart_id: chart.id ?? '',
          new_chart_id: newChart.id ?? '',
        });
      }),
    );

    // Duplicate Report
    return this.reportRepository.create({
      name: `${fReport.name} (Copy)`,
      showHeader: fReport.showHeader,
      title: fReport.title,
      subTitle: fReport.subTitle,
      rows: fReport.rows.map(row => {
        // Update the old chartIds to the new ones
        return {
          ...row,
          items: row.items.map(item => {
            if (typeof item === 'string') {
              return (
                chartsIds.find(c => c.chart_id === item)?.new_chart_id ?? item
              );
            } else {
              return item;
            }
          }),
        };
      }),
      public: false,
      baseline: false,
      backgroundColor: fReport.backgroundColor,
      titleColor: fReport.titleColor,
      descriptionColor: fReport.descriptionColor,
      dateColor: fReport.dateColor,
      createdDate: fReport.createdDate,
      owner: userId,
    });
  }

  @post('/users/send-contact-form-to-intercom')
  @response(200)
  async sendContactFormToIntercom(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    formDetails: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      message: string;
    },
  ): Promise<{message: string} | {error: string}> {
    try {
      if (process.env.ENV_TYPE === 'prod') {
        // Intercom is only available in production
        const userData = {
          email: formDetails.email,
          name: formDetails.firstName + ' ' + formDetails.lastName,
        };
        const response = await sendContactForm(
          userData,
          formDetails.message,
          formDetails.company,
        );
        if (response.error) {
          return response;
        }
        logger.info(
          `route <users/send-contact-form-to-intercom> -  Contact form sent: ${JSON.stringify(
            response.data,
          )}`,
        );
      }
      return {
        message: `Sent! The team will reply as soon as they can You'll get replies here and to ${formDetails.email}.`,
      };
    } catch (error) {
      logger.error(
        `route <users/send-contact-form-to-intercom> -  Error sending contact form: ${error}`,
      );
      return {error: 'Error sending contact form'};
    }
  }

  @get('/users/plan-data')
  @response(200)
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async fetchUserPlanData() {
    const userId = _.get(this.req, 'user.sub', 'anonymous');
    const assetsCount = {
      datasets: (await this.datasetRepository.count({owner: userId})).count,
      charts: (await this.chartRepository.count({owner: userId})).count,
      reports: (await this.reportRepository.count({owner: userId})).count,
    };
    return {
      planData: await getUserPlanData(userId),
      assetsCount: assetsCount,
    };
  }
}
