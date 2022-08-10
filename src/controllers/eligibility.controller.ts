import {inject} from '@loopback/core';
import {
  get,
  Request,
  response,
  ResponseObject,
  RestBindings
} from '@loopback/rest';
import axios, {AxiosResponse} from 'axios';
import _ from 'lodash';
import querystring from 'querystring';
import filtering from '../config/filtering/index.json';
import EligibilityFieldsMapping from '../config/mapping/eligibility/dotsChart.json';
import ScatterplotFieldsMapping from '../config/mapping/eligibility/scatterplot.json';
import EligibilityYearsFieldsMapping from '../config/mapping/eligibility/years.json';
import urls from '../config/urls/index.json';
import {EligibilityDotDataItem} from '../interfaces/eligibilityDot';
import {EligibilityScatterplotDataItem} from '../interfaces/eligibilityScatterplot';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/eligibility/getFilterString';

const ELIGIBILITY_RESPONSE: ResponseObject = {
  description: 'Eligibility Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'EligibilityResponse',
        properties: {
          count: {type: 'number'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {type: 'string'},
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      status: {type: 'string'},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
const ELIGIBILITY_COUNTRY_RESPONSE: ResponseObject = {
  description: 'Eligibility Country Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'EligibilityCountryResponse',
        properties: {
          count: {type: 'number'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      x: {type: 'string'},
                      y: {type: 'string'},
                      eligibility: {type: 'string'},
                      incomeLevel: {type: 'string'},
                      diseaseBurden: {type: 'string'},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export class EligibilityController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/eligibility')
  @response(200, ELIGIBILITY_RESPONSE)
  eligibility(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const aggregateByField =
      this.req.query.aggregateBy ??
      _.get(EligibilityFieldsMapping, datasource).aggregateByFields[0];
    const nonAggregateByField = (this.req.query.nonAggregateBy
      ? this.req.query.nonAggregateBy
      : this.req.query.aggregateBy ===
        _.get(EligibilityFieldsMapping, datasource).aggregateByFields[0]
        ? _.get(EligibilityFieldsMapping, datasource).aggregateByFields[1]
        : _.get(EligibilityFieldsMapping, datasource).aggregateByFields[0]
    ).toString();
    const filterString = getFilterString(this.req.query, datasource);
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).eligibility}?${params}${filterString}&${_.get(EligibilityFieldsMapping, datasource).defaultSelect}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const apiData = _.get(resp.data, _.get(EligibilityFieldsMapping, datasource).dataPath, []);
        const aggregatedData = _.groupBy(apiData, aggregateByField);
        const data: EligibilityDotDataItem[] = [];

        (_.orderBy(
          Object.keys(aggregatedData),
          undefined,
          'asc',
        ) as string[]).forEach((key: string) => {
          data.push({
            name: key,
            items: _.orderBy(
              aggregatedData[key],
              nonAggregateByField,
              'asc',
            ).map(item => ({
              name: _.get(item, nonAggregateByField, ''),
              status: _.get(
                _.get(EligibilityFieldsMapping, datasource),
                _.get(item, _.get(EligibilityFieldsMapping, datasource).status, '')
                  .toLowerCase()
                  .trim(),
                _.get(item, _.get(EligibilityFieldsMapping, datasource).status, ''),
              ),
            })),
          });
        });

        return {
          count: data.length,
          data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/eligibility/years')
  @response(200, ELIGIBILITY_RESPONSE)
  eligibilityYears(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = `${_.get(urls, datasource).eligibility}?${_.get(EligibilityYearsFieldsMapping, datasource).aggregation}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        return {
          data: _.get(
            resp.data,
            _.get(EligibilityYearsFieldsMapping, datasource).dataPath,
            [],
          ).map((item: any) =>
            _.get(item, _.get(EligibilityYearsFieldsMapping, datasource).year, ''),
          ),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/eligibility/country')
  @response(200, ELIGIBILITY_COUNTRY_RESPONSE)
  eligibilityCountry(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    if (_.get(this.req.query, 'locations', '').length === 0) {
      return {
        count: 0,
        data: [],
      };
    }
    const filterString = getFilterString(this.req.query, datasource);
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).eligibility}?${params}${filterString}&${_.get(ScatterplotFieldsMapping, datasource).defaultSelect}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const apiData = _.get(resp.data, _.get(ScatterplotFieldsMapping, datasource).dataPath, []);
        const aggregatedData = _.groupBy(
          apiData,
          _.get(ScatterplotFieldsMapping, datasource).aggregateByField,
        );
        const aggregatedDataByYear = _.groupBy(
          apiData,
          _.get(ScatterplotFieldsMapping, datasource).year,
        );
        const years: number[] = _.sortBy(
          _.uniq(
            Object.keys(_.groupBy(apiData, _.get(ScatterplotFieldsMapping, datasource).year)),
          ).map((key: string) => parseInt(key, 10)),
        );
        years.push(years[years.length - 1] + 1);
        years.unshift(years[0] - 1);
        const data: {id: string; data: EligibilityScatterplotDataItem[]}[] = [
          {
            id: 'dummy1',
            data: years.map((year: number) => ({
              x: year,
              diseaseBurden: 0,
              incomeLevel: 0,
              eligibility: 'Not Eligible',
              y: 'dummy1',
              invisible: true,
            })),
          },
        ];

        (_.orderBy(
          Object.keys(aggregatedData),
          undefined,
          'asc',
        ) as string[]).forEach((key: string) => {
          data.push({
            id: key,
            data: _.orderBy(
              aggregatedData[key],
              _.get(ScatterplotFieldsMapping, datasource).year,
              'asc',
            ).map(item => ({
              y: key,
              x: _.get(item, _.get(ScatterplotFieldsMapping, datasource).year, ''),
              eligibility: _.get(
                ScatterplotFieldsMapping,
                _.get(item, _.get(ScatterplotFieldsMapping, datasource).status, '')
                  .toLowerCase()
                  .trim(),
                _.get(item, _.get(ScatterplotFieldsMapping, datasource).status, ''),
              ),
              incomeLevel:
                _.get(item, _.get(ScatterplotFieldsMapping, datasource).incomeLevel, null) === null
                  ? 0
                  : _.findIndex(
                    _.get(ScatterplotFieldsMapping, datasource).incomeLevels,
                    (incomeLevel: string) =>
                      incomeLevel ===
                      _.get(
                        item,
                        _.get(ScatterplotFieldsMapping, datasource).incomeLevel,
                        'None',
                      ),
                  ),
              diseaseBurden:
                _.get(item, _.get(ScatterplotFieldsMapping, datasource).diseaseBurden, null) ===
                  null
                  ? 0
                  : _.findIndex(
                    _.get(ScatterplotFieldsMapping, datasource).diseaseBurdens,
                    (diseaseBurden: string) =>
                      diseaseBurden ===
                      _.get(
                        item,
                        _.get(ScatterplotFieldsMapping, datasource).diseaseBurden,
                        'None',
                      ),
                  ),
            })),
          });
        });

        data.forEach((item: any, index: number) => {
          years.forEach((year: number, yearindex: number) => {
            if (!_.find(item.data, {x: year})) {
              let fItemWithData = _.get(
                aggregatedDataByYear,
                `${year}[0]`,
                null,
              );
              if (yearindex === 0) {
                fItemWithData = _.get(
                  aggregatedDataByYear,
                  `${years[1]}[0]`,
                  null,
                );
              }
              const incomeLevel: number =
                _.get(
                  fItemWithData,
                  _.get(ScatterplotFieldsMapping, datasource).incomeLevel,
                  null,
                ) === null
                  ? 0
                  : _.findIndex(
                    _.get(ScatterplotFieldsMapping, datasource).incomeLevels,
                    (il: string) =>
                      il ===
                      _.get(
                        fItemWithData,
                        _.get(ScatterplotFieldsMapping, datasource).incomeLevel,
                        'None',
                      ),
                  );
              data[index].data.push({
                y: item.data[0].y,
                x: year,
                diseaseBurden: 0,
                incomeLevel,
                eligibility: 'Not Eligible',
                invisible: true,
              });
            }
          });
          data[index].data = _.orderBy(data[index].data, 'x', 'asc');
        });

        data.push({
          id: 'dummy2',
          data: years.map((year: number, index: number) => {
            let fItemWithData = _.get(aggregatedDataByYear, `${year}[0]`, null);
            if (index === 0) {
              fItemWithData = _.get(
                aggregatedDataByYear,
                `${years[1]}[0]`,
                null,
              );
            }
            const incomeLevel: number =
              _.get(
                fItemWithData,
                _.get(ScatterplotFieldsMapping, datasource).incomeLevel,
                null,
              ) === null
                ? 0
                : _.findIndex(
                  _.get(ScatterplotFieldsMapping, datasource).incomeLevels,
                  (il: string) =>
                    il ===
                    _.get(
                      fItemWithData,
                      _.get(ScatterplotFieldsMapping, datasource).incomeLevel,
                      'None',
                    ),
                );
            return {
              x: year,
              y: 'dummy2',
              diseaseBurden: 0,
              incomeLevel,
              eligibility: 'Not Eligible',
              invisible: true,
            };
          }),
        });

        return {
          count: data.length,
          data,
        };
      })
      .catch(handleDataApiError);
  }
}
