import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {post, Request, response, RestBindings} from '@loopback/rest';
import axios from 'axios';
import _ from 'lodash';
import {UserProfile} from '../authentication-strategies/user-profile';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {
  ChartRepository,
  DatasetRepository,
  ReportRepository,
} from '../repositories';

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
        where: {public: true},
      });
      const reports = await this.reportRepository.find({
        where: {public: true},
      });
      const charts = await this.chartRepository.find({
        where: {public: true},
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
                  if (typeof item === 'string') {
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
}
