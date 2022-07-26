import {inject} from '@loopback/core';
import {
  get,
  Request,
  response,
  ResponseObject,
  RestBindings,
} from '@loopback/rest';
import center from '@turf/center';
import {points, Position} from '@turf/helpers';
import axios, {AxiosResponse} from 'axios';
import _ from 'lodash';
import querystring from 'querystring';
import filteringGrants from '../config/filtering/grants.json';
import filtering from '../config/filtering/index.json';
import GeomapFieldsMapping from '../config/mapping/disbursements/geomap.json';
import GrantCommittedTimeCycleFieldsMapping from '../config/mapping/disbursements/grantCommittedTimeCycle.json';
import GrantDetailTimeCycleFieldsMapping from '../config/mapping/disbursements/grantDetailTimeCycle.json';
import GrantDetailTreemapFieldsMapping from '../config/mapping/disbursements/grantDetailTreemap.json';
import TimeCycleFieldsMapping from '../config/mapping/disbursements/timeCycle.json';
import TimeCycleDrilldownFieldsMapping from '../config/mapping/disbursements/timeCycleDrilldown.json';
import TreemapFieldsMapping from '../config/mapping/disbursements/treemap.json';
import urls from '../config/urls/index.json';
import {BudgetsTreemapDataItem} from '../interfaces/budgetsTreemap';
import {DisbursementsTreemapDataItem} from '../interfaces/disbursementsTreemap';
import staticCountries from '../static-assets/countries.json';
import {handleDataApiError} from '../utils/dataApiError';
import {
  grantDetailGetFilterString,
  grantDetailTreemapGetFilterString,
} from '../utils/filtering/disbursements/grantDetailGetFilterString';
import {getGeoMultiCountriesFilterString} from '../utils/filtering/disbursements/multicountries/getFilterString';
import {getFilterString} from '../utils/filtering/grants/getFilterString';
import {formatFinancialValue} from '../utils/formatFinancialValue';

const DISBURSEMENTS_TIME_CYCLE_RESPONSE: ResponseObject = {
  description: 'Disbursements Time Cycle Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'DisbursementsTimeCycleResponse',
        properties: {
          count: {type: 'integer'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                year: {type: 'string'},
                disbursed: {type: 'number'},
                cumulative: {type: 'number'},
                disbursedChildren: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      color: {type: 'string'},
                      value: {type: 'number'},
                    },
                  },
                },
                cumulativeChildren: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      color: {type: 'string'},
                      value: {type: 'number'},
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
const DISBURSEMENTS_TREEMAP_RESPONSE: ResponseObject = {
  description: 'Disbursements Treemap Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'DisbursementsTreemapResponse',
        properties: {
          count: {type: 'integer'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {type: 'string'},
                value: {type: 'number'},
                color: {type: 'string'},
                formattedValue: {type: 'string'},
                tooltip: {
                  type: 'object',
                  properties: {
                    header: {type: 'string'},
                    componentsStats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: {type: 'string'},
                          count: {type: 'number'},
                          investment: {type: 'number'},
                        },
                      },
                    },
                    totalInvestments: {
                      type: 'object',
                      properties: {
                        committed: {type: 'number'},
                        disbursed: {type: 'number'},
                        signed: {type: 'number'},
                      },
                    },
                    percValue: {type: 'string'},
                  },
                },
                _children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {type: 'string'},
                      value: {type: 'number'},
                      color: {type: 'string'},
                      formattedValue: {type: 'string'},
                      tooltip: {
                        type: 'object',
                        properties: {
                          header: {type: 'string'},
                          componentsStats: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                name: {type: 'string'},
                                count: {type: 'number'},
                                investment: {type: 'number'},
                              },
                            },
                          },
                          totalInvestments: {
                            type: 'object',
                            properties: {
                              committed: {type: 'number'},
                              disbursed: {type: 'number'},
                              signed: {type: 'number'},
                            },
                          },
                          percValue: {type: 'string'},
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
    },
  },
};

export class DisbursementsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  // Time/Cycle

  @get('/disbursements/time-cycle')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycle(): object {
    const filterString = getFilterString(
      this.req.query,
      TimeCycleFieldsMapping.disbursementsTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.disbursements}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let apiData = _.get(resp.data, TimeCycleFieldsMapping.dataPath, []);
        if (apiData.length > 0) {
          if (_.get(apiData[0], TimeCycleFieldsMapping.year, '').length > 4) {
            apiData = _.filter(
              apiData,
              (item: any) => item[TimeCycleFieldsMapping.year],
            ).map((item: any) => ({
              ...item,
              [TimeCycleFieldsMapping.year]: item[
                TimeCycleFieldsMapping.year
              ].slice(0, 4),
            }));
          }
        }
        const groupedDataByYear = _.groupBy(
          apiData,
          TimeCycleFieldsMapping.year,
        );
        const data: any = [];
        Object.keys(groupedDataByYear).forEach((year: string) => {
          const dataItems = groupedDataByYear[year];
          const yearComponents: any = [];
          _.orderBy(dataItems, TimeCycleFieldsMapping.year, 'asc').forEach(
            (item: any) => {
              const value = parseInt(
                _.get(item, TimeCycleFieldsMapping.disbursed, 0),
                10,
              );
              if (value) {
                const name = _.get(item, TimeCycleFieldsMapping.component, '');
                const prevYearComponent = _.get(
                  data,
                  `[${data.length - 1}].cumulativeChildren`,
                  [],
                );
                yearComponents.push({
                  name,
                  disbursed: value,
                  cumulative:
                    _.get(_.find(prevYearComponent, {name}), 'value', 0) +
                    value,
                });
              }
            },
          );
          const disbursed = _.sumBy(yearComponents, 'disbursed');
          const cumulative = _.sumBy(yearComponents, 'cumulative');
          if (disbursed > 0) {
            data.push({
              year,
              disbursed,
              cumulative,
              disbursedChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.disbursed,
                }),
              ),
              cumulativeChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.cumulative,
                }),
              ),
            });
          }
        });
        return {
          count: data.length,
          data: data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/signed/time-cycle')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycleSigned(): object {
    const filterString = getFilterString(
      this.req.query,
      TimeCycleFieldsMapping.signedTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.vgrantPeriods}/?${params}${filterString
      .replace('filter', '$filter=')
      .replace(')/', ')')}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let apiData = _.get(resp.data, TimeCycleFieldsMapping.dataPath, []);
        if (apiData.length > 0) {
          apiData = _.filter(
            apiData,
            (item: any) => item[TimeCycleFieldsMapping.signedYear],
          ).map((item: any) => ({
            ...item,
            [TimeCycleFieldsMapping.signedYear]: item[
              TimeCycleFieldsMapping.signedYear
            ].slice(0, 4),
          }));
        }
        const groupedDataByYear = _.groupBy(
          apiData,
          TimeCycleFieldsMapping.signedYear,
        );
        const data: any = [];
        Object.keys(groupedDataByYear).forEach((year: string) => {
          const dataItems = groupedDataByYear[year];
          const groupedYearCompsData = _.groupBy(
            dataItems,
            TimeCycleFieldsMapping.component,
          );
          const groupedYearComps = Object.keys(groupedYearCompsData).map(
            (component: string) => ({
              [TimeCycleFieldsMapping.component]: component,
              [TimeCycleFieldsMapping.signed]: _.sumBy(
                groupedYearCompsData[component],
                TimeCycleFieldsMapping.signed,
              ),
            }),
          );
          const yearComponents: any = [];
          groupedYearComps.forEach((item: any) => {
            const value = parseInt(
              _.get(item, TimeCycleFieldsMapping.signed, 0),
              10,
            );
            if (value) {
              const name = _.get(item, TimeCycleFieldsMapping.component, '');
              const prevYearComponent = _.get(
                data,
                `[${data.length - 1}].cumulativeChildren`,
                [],
              );
              yearComponents.push({
                name,
                disbursed: value,
                cumulative:
                  _.get(_.find(prevYearComponent, {name}), 'value', 0) + value,
              });
            }
          });
          const disbursed = _.sumBy(yearComponents, 'disbursed');
          const cumulative = _.sumBy(yearComponents, 'cumulative');
          if (disbursed > 0) {
            data.push({
              year,
              disbursed,
              cumulative,
              disbursedChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.disbursed,
                }),
              ),
              cumulativeChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.cumulative,
                }),
              ),
            });
          }
        });
        return {
          count: data.length,
          data: data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/commitment/time-cycle')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycleCommitment(): object {
    const filterString = getFilterString(
      this.req.query,
      TimeCycleFieldsMapping.commitmentTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.vcommitments}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let apiData = _.get(resp.data, TimeCycleFieldsMapping.dataPath, []);
        if (apiData.length > 0) {
          if (
            _.get(apiData[0], TimeCycleFieldsMapping.committedYear, '').length >
            4
          ) {
            apiData = _.filter(
              apiData,
              (item: any) => item[TimeCycleFieldsMapping.committedYear],
            ).map((item: any) => ({
              ...item,
              [TimeCycleFieldsMapping.committedYear]: item[
                TimeCycleFieldsMapping.committedYear
              ].slice(0, 4),
            }));
          }
        }
        const groupedDataByYear = _.groupBy(
          apiData,
          TimeCycleFieldsMapping.committedYear,
        );
        const data: any = [];
        Object.keys(groupedDataByYear).forEach((year: string) => {
          const dataItems = groupedDataByYear[year];
          const yearComponents: any = [];
          _.orderBy(
            dataItems,
            TimeCycleFieldsMapping.committedYear,
            'asc',
          ).forEach((item: any) => {
            const value = parseInt(
              _.get(item, TimeCycleFieldsMapping.committed, 0),
              10,
            );
            if (value) {
              const name = _.get(item, TimeCycleFieldsMapping.component, '');
              const prevYearComponent = _.get(
                data,
                `[${data.length - 1}].cumulativeChildren`,
                [],
              );
              yearComponents.push({
                name,
                disbursed: value,
                cumulative:
                  _.get(_.find(prevYearComponent, {name}), 'value', 0) + value,
              });
            }
          });
          const disbursed = _.sumBy(yearComponents, 'disbursed');
          const cumulative = _.sumBy(yearComponents, 'cumulative');
          if (disbursed > 0) {
            data.push({
              year,
              disbursed,
              cumulative,
              disbursedChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.disbursed,
                }),
              ),
              cumulativeChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.cumulative,
                }),
              ),
            });
          }
        });
        return {
          count: data.length,
          data: data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/disbursements/time-cycle/drilldown')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycleDrilldown(): object {
    const filterString = getFilterString(
      this.req.query,
      TimeCycleDrilldownFieldsMapping.disbursementsTimeCycleDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.disbursements}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const apiData = _.get(
          resp.data,
          TimeCycleDrilldownFieldsMapping.dataPath,
          [],
        );
        const groupedDataByComponent = _.groupBy(
          apiData,
          TimeCycleDrilldownFieldsMapping.component,
        );
        const data: BudgetsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: BudgetsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: item[TimeCycleDrilldownFieldsMapping.locationName],
              value: item[TimeCycleDrilldownFieldsMapping.disbursed],
              formattedValue: formatFinancialValue(
                item[TimeCycleDrilldownFieldsMapping.disbursed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: item[TimeCycleDrilldownFieldsMapping.locationName],
                    value: item[TimeCycleDrilldownFieldsMapping.disbursed],
                  },
                ],
                value: item[TimeCycleDrilldownFieldsMapping.disbursed],
              },
            });
          });
          const disbursed = _.sumBy(componentLocations, 'value');
          data.push({
            name: component,
            color: '#DFE3E5',
            value: disbursed,
            formattedValue: formatFinancialValue(disbursed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  value: _.sumBy(componentLocations, 'value'),
                },
              ],
              value: _.sumBy(componentLocations, 'value'),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/signed/time-cycle/drilldown')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycleDrilldownSigned(): object {
    const query = {
      ...this.req.query,
      signedBarPeriod: this.req.query.barPeriod,
    };
    // @ts-ignore
    delete query.barPeriod;
    const filterString = getFilterString(
      query,
      TimeCycleDrilldownFieldsMapping.signedTimeCycleDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.vgrantPeriods}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const apiData = _.get(
          resp.data,
          TimeCycleDrilldownFieldsMapping.dataPath,
          [],
        );
        const groupedDataByComponent = _.groupBy(
          apiData,
          TimeCycleDrilldownFieldsMapping.component,
        );
        const data: BudgetsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: BudgetsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: item[TimeCycleDrilldownFieldsMapping.locationName],
              value: item[TimeCycleDrilldownFieldsMapping.signed],
              formattedValue: formatFinancialValue(
                item[TimeCycleDrilldownFieldsMapping.signed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: item[TimeCycleDrilldownFieldsMapping.locationName],
                    value: item[TimeCycleDrilldownFieldsMapping.signed],
                  },
                ],
                value: item[TimeCycleDrilldownFieldsMapping.signed],
              },
            });
          });
          const signed = _.sumBy(componentLocations, 'value');
          data.push({
            name: component,
            color: '#DFE3E5',
            value: signed,
            formattedValue: formatFinancialValue(signed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  value: _.sumBy(componentLocations, 'value'),
                },
              ],
              value: _.sumBy(componentLocations, 'value'),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/commitment/time-cycle/drilldown')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  timeCycleDrilldownCommitment(): object {
    const query = {
      ...this.req.query,
      committedBarPeriod: this.req.query.barPeriod,
    };
    // @ts-ignore
    delete query.barPeriod;
    const filterString = getFilterString(
      query,
      TimeCycleDrilldownFieldsMapping.commitmentTimeCycleDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.vcommitments}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const apiData = _.get(
          resp.data,
          TimeCycleDrilldownFieldsMapping.dataPath,
          [],
        );
        const groupedDataByComponent = _.groupBy(
          apiData,
          TimeCycleDrilldownFieldsMapping.component,
        );
        const data: BudgetsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: BudgetsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: item[TimeCycleDrilldownFieldsMapping.locationName],
              value: item[TimeCycleDrilldownFieldsMapping.committed],
              formattedValue: formatFinancialValue(
                item[TimeCycleDrilldownFieldsMapping.committed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: item[TimeCycleDrilldownFieldsMapping.locationName],
                    value: item[TimeCycleDrilldownFieldsMapping.committed],
                  },
                ],
                value: item[TimeCycleDrilldownFieldsMapping.committed],
              },
            });
          });
          const committed = _.sumBy(componentLocations, 'value');
          data.push({
            name: component,
            color: '#DFE3E5',
            value: committed,
            formattedValue: formatFinancialValue(committed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  value: _.sumBy(componentLocations, 'value'),
                },
              ],
              value: _.sumBy(componentLocations, 'value'),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  // Treemap

  @get('/disbursements/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemap(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let locationName = item[TreemapFieldsMapping.locationName];
            let locationCode = item[TreemapFieldsMapping.locationCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              locationName = item[TreemapFieldsMapping.multicountry];
              locationCode = item[TreemapFieldsMapping.multicountry];
            }
            componentLocations.push({
              name: locationName,
              code: locationCode,
              value: item[TreemapFieldsMapping.disbursed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.disbursed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: locationName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.disbursed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const disbursed = _.sumBy(componentLocations, 'value');
          const committed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.committed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: disbursed,
            formattedValue: formatFinancialValue(disbursed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed: _.sumBy(
                  componentLocations,
                  'tooltip.totalInvestments.signed',
                ),
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/signed/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemapSigned(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let locationName = item[TreemapFieldsMapping.locationName];
            let locationCode = item[TreemapFieldsMapping.locationCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              locationName = item[TreemapFieldsMapping.multicountry];
              locationCode = item[TreemapFieldsMapping.multicountry];
            }
            componentLocations.push({
              name: locationName,
              code: locationCode,
              value: item[TreemapFieldsMapping.signed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.signed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: locationName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.signed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const signed = _.sumBy(componentLocations, 'value');
          const committed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.committed',
          );
          const disbursed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: signed,
            formattedValue: formatFinancialValue(signed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed,
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/commitment/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemapCommitment(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let locationName = item[TreemapFieldsMapping.locationName];
            let locationCode = item[TreemapFieldsMapping.locationCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              locationName = item[TreemapFieldsMapping.multicountry];
              locationCode = item[TreemapFieldsMapping.multicountry];
            }
            componentLocations.push({
              name: locationName,
              code: locationCode,
              value: item[TreemapFieldsMapping.committed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.committed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: locationName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.committed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const committed = _.sumBy(componentLocations, 'value');
          const signed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.signed',
          );
          const disbursed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: committed,
            formattedValue: formatFinancialValue(committed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed,
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/disbursements/treemap/drilldown')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemapDrilldown(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByCountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.locationName,
        );
        const groupedDataByMulticountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.multicountry,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        const countryKeys = Object.keys(groupedDataByCountry);
        const multicountryKeys = _.filter(
          Object.keys(groupedDataByMulticountry),
          (key: string) => key !== 'null',
        );
        if (multicountryKeys.length === 0) {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.disbursed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.disbursed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.disbursed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const disbursed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: disbursed,
              formattedValue: formatFinancialValue(disbursed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed: _.sumBy(
                    locationComponents,
                    'tooltip.totalInvestments.signed',
                  ),
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else if (countryKeys.length === 1 && multicountryKeys.length > 0) {
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.disbursed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.disbursed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.disbursed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const disbursed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: disbursed,
              formattedValue: formatFinancialValue(disbursed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed: _.sumBy(
                    locationComponents,
                    'tooltip.totalInvestments.signed',
                  ),
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.disbursed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.disbursed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.disbursed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const disbursed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: disbursed,
              formattedValue: formatFinancialValue(disbursed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed: _.sumBy(
                    locationComponents,
                    'tooltip.totalInvestments.signed',
                  ),
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.disbursed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.disbursed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.disbursed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const disbursed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: disbursed,
              formattedValue: formatFinancialValue(disbursed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed: _.sumBy(
                    locationComponents,
                    'tooltip.totalInvestments.signed',
                  ),
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        }
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/signed/treemap/drilldown')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemapDrilldownSigned(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByCountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.locationName,
        );
        const groupedDataByMulticountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.multicountry,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        const countryKeys = Object.keys(groupedDataByCountry);
        const multicountryKeys = _.filter(
          Object.keys(groupedDataByMulticountry),
          (key: string) => key !== 'null',
        );
        if (multicountryKeys.length === 0) {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.signed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.signed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.signed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const signed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: signed,
              formattedValue: formatFinancialValue(signed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else if (countryKeys.length === 1 && multicountryKeys.length > 0) {
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.signed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.signed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.signed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const signed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: signed,
              formattedValue: formatFinancialValue(signed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.signed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.signed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.signed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const signed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: signed,
              formattedValue: formatFinancialValue(signed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.signed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.signed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.signed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const signed = _.sumBy(locationComponents, 'value');
            const committed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: signed,
              formattedValue: formatFinancialValue(signed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        }
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/commitment/treemap/drilldown')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  treemapDrilldownCommitment(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.disbursementsTreemapDrilldownAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByCountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.locationName,
        );
        const groupedDataByMulticountry = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.multicountry,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        const countryKeys = Object.keys(groupedDataByCountry);
        const multicountryKeys = _.filter(
          Object.keys(groupedDataByMulticountry),
          (key: string) => key !== 'null',
        );
        if (multicountryKeys.length === 0) {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.committed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.committed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.committed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const committed = _.sumBy(locationComponents, 'value');
            const signed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: committed,
              formattedValue: formatFinancialValue(committed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else if (countryKeys.length === 1 && multicountryKeys.length > 0) {
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.committed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.committed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.committed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const committed = _.sumBy(locationComponents, 'value');
            const signed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: committed,
              formattedValue: formatFinancialValue(committed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        } else {
          countryKeys.forEach((location: string) => {
            const dataItems = groupedDataByCountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.committed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.committed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.committed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const committed = _.sumBy(locationComponents, 'value');
            const signed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: committed,
              formattedValue: formatFinancialValue(committed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
          multicountryKeys.forEach((location: string) => {
            const dataItems = groupedDataByMulticountry[location];
            const locationComponents: DisbursementsTreemapDataItem[] = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[TreemapFieldsMapping.component],
                value: item[TreemapFieldsMapping.committed],
                formattedValue: formatFinancialValue(
                  item[TreemapFieldsMapping.committed],
                ),
                color: '#595C70',
                tooltip: {
                  header: location,
                  componentsStats: [
                    {
                      name: item[TreemapFieldsMapping.component],
                      count: item.count,
                      investment: item[TreemapFieldsMapping.committed],
                    },
                  ],
                  totalInvestments: {
                    committed: item[TreemapFieldsMapping.committed],
                    disbursed: item[TreemapFieldsMapping.disbursed],
                    signed: item[TreemapFieldsMapping.signed],
                  },
                  percValue: (
                    (item[TreemapFieldsMapping.disbursed] * 100) /
                    item[TreemapFieldsMapping.committed]
                  ).toString(),
                },
              });
            });
            const committed = _.sumBy(locationComponents, 'value');
            const signed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.committed',
            );
            const disbursed = _.sumBy(
              locationComponents,
              'tooltip.totalInvestments.disbursed',
            );
            data.push({
              name: location,
              color: '#DFE3E5',
              value: committed,
              formattedValue: formatFinancialValue(committed),
              _children: _.orderBy(locationComponents, 'value', 'desc'),
              tooltip: {
                header: location,
                componentsStats: [
                  {
                    name: location,
                    count: _.sumBy(
                      locationComponents,
                      'tooltip.componentsStats[0].count',
                    ),
                    investment: _.sumBy(locationComponents, 'value'),
                  },
                ],
                totalInvestments: {
                  committed,
                  disbursed,
                  signed,
                },
                percValue: ((disbursed * 100) / committed).toString(),
              },
            });
          });
        }
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  // Geomap

  @get('/disbursements/geomap')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  geomap(): object {
    let aggregationField = GeomapFieldsMapping.disbursed;
    if (
      this.req.query.aggregationField &&
      typeof this.req.query.aggregationField === 'string' &&
      _.get(GeomapFieldsMapping, this.req.query.aggregationField, null)
    ) {
      aggregationField = _.get(
        GeomapFieldsMapping,
        this.req.query.aggregationField,
        GeomapFieldsMapping.disbursed,
      );
    }
    const filterString = getFilterString(
      this.req.query,
      GeomapFieldsMapping.disbursementsGeomapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(urls.geojson)])
      .then(
        axios.spread((...responses) => {
          const geoJSONData = responses[1].data.features;
          // const geoJSONData = geojson.features;
          const groupedDataByLocation = _.groupBy(
            responses[0].data.value,
            GeomapFieldsMapping.locationCode,
          );
          const data: any = [];
          Object.keys(groupedDataByLocation).forEach((iso3: string) => {
            const dataItems = groupedDataByLocation[iso3];
            const locationComponents: any = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: item[GeomapFieldsMapping.component],
                activitiesCount: item.count,
                value: item[aggregationField],
              });
            });
            const disbursed = _.sumBy(dataItems, GeomapFieldsMapping.disbursed);
            const committed = _.sumBy(dataItems, GeomapFieldsMapping.committed);
            const signed = _.sumBy(dataItems, GeomapFieldsMapping.signed);
            data.push({
              code: iso3,
              components: locationComponents,
              disbursed,
              committed,
              signed,
            });
          });
          const maxValue: number =
            _.max(data.map((d: any) => d[aggregationField])) ?? 0;
          let interval = 0;
          if (maxValue) {
            interval = maxValue / 13;
          }
          const intervals: number[] = [];
          for (let i = 0; i < 13; i++) {
            intervals.push(interval * i);
          }
          const features = geoJSONData.map((feature: any) => {
            const fItem = _.find(data, {code: feature.id});
            let itemValue = 0;
            if (fItem) {
              const fItemValue = fItem[aggregationField];
              if (
                (fItemValue < maxValue || fItemValue === maxValue) &&
                (fItemValue >= intervals[11] || fItemValue === intervals[11])
              ) {
                itemValue = 12;
              }
              if (
                (fItemValue < intervals[11] || fItemValue === intervals[11]) &&
                (fItemValue >= intervals[10] || fItemValue === intervals[10])
              ) {
                itemValue = 11;
              }
              if (
                (fItemValue < intervals[10] || fItemValue === intervals[10]) &&
                (fItemValue >= intervals[9] || fItemValue === intervals[9])
              ) {
                itemValue = 10;
              }
              if (
                (fItemValue < intervals[9] || fItemValue === intervals[9]) &&
                (fItemValue >= intervals[8] || fItemValue === intervals[8])
              ) {
                itemValue = 9;
              }
              if (
                (fItemValue < intervals[8] || fItemValue === intervals[8]) &&
                (fItemValue >= intervals[7] || fItemValue === intervals[7])
              ) {
                itemValue = 8;
              }
              if (
                (fItemValue < intervals[7] || fItemValue === intervals[7]) &&
                (fItemValue >= intervals[6] || fItemValue === intervals[6])
              ) {
                itemValue = 7;
              }
              if (
                (fItemValue < intervals[6] || fItemValue === intervals[6]) &&
                (fItemValue >= intervals[5] || fItemValue === intervals[5])
              ) {
                itemValue = 6;
              }
              if (
                (fItemValue < intervals[5] || fItemValue === intervals[5]) &&
                (fItemValue >= intervals[4] || fItemValue === intervals[4])
              ) {
                itemValue = 5;
              }
              if (
                (fItemValue < intervals[4] || fItemValue === intervals[4]) &&
                (fItemValue >= intervals[3] || fItemValue === intervals[3])
              ) {
                itemValue = 4;
              }
              if (
                (fItemValue < intervals[3] || fItemValue === intervals[3]) &&
                (fItemValue >= intervals[2] || fItemValue === intervals[2])
              ) {
                itemValue = 3;
              }
              if (
                (fItemValue < intervals[2] || fItemValue === intervals[2]) &&
                (fItemValue >= intervals[1] || fItemValue === intervals[1])
              ) {
                itemValue = 2;
              }
              if (
                (fItemValue < intervals[1] || fItemValue === intervals[1]) &&
                (fItemValue >= intervals[0] || fItemValue === intervals[0])
              ) {
                itemValue = 1;
              }
            }
            return {
              ...feature,
              properties: {
                ...feature.properties,
                value: itemValue,
                iso_a3: feature.id,
                data: fItem
                  ? {
                      components: fItem.components,
                      disbursed: fItem.disbursed,
                      committed: fItem.committed,
                      signed: fItem.signed,
                    }
                  : {},
              },
            };
          });
          return {
            count: features.length,
            data: features,
            maxValue,
          };
        }),
      )
      .catch(handleDataApiError);
  }

  @get('/disbursements/geomap/multicountries')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  geomapMulticountries(): object {
    let aggregationField = GeomapFieldsMapping.disbursed;
    if (
      this.req.query.aggregationField &&
      typeof this.req.query.aggregationField === 'string' &&
      _.get(GeomapFieldsMapping, this.req.query.aggregationField, null)
    ) {
      aggregationField = _.get(
        GeomapFieldsMapping,
        this.req.query.aggregationField,
        GeomapFieldsMapping.disbursed,
      );
    }
    const filterString = getGeoMultiCountriesFilterString(
      this.req.query,
      GeomapFieldsMapping.disbursementsMulticountryGeomapAggregation,
      'GrantAgreement/MultiCountryId ne null',
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantPeriods}/?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(urls.multicountriescountriesdata)])
      .then(
        axios.spread((...responses) => {
          const rawData = _.get(
            responses[0].data,
            GeomapFieldsMapping.dataPath,
            [],
          );
          const mcGeoData = _.get(
            responses[1].data,
            GeomapFieldsMapping.dataPath,
            [],
          );
          const data: any = [];
          const groupedByMulticountry = _.groupBy(
            rawData,
            GeomapFieldsMapping.multicountry,
          );
          Object.keys(groupedByMulticountry).forEach((mc: string) => {
            const fMCGeoItem = _.find(
              mcGeoData,
              (mcGeoItem: any) =>
                _.get(
                  mcGeoItem,
                  GeomapFieldsMapping.geoDataMulticountry,
                  '',
                ) === mc,
            );
            let latitude = 0;
            let longitude = 0;
            if (fMCGeoItem) {
              const coordinates: Position[] = [];
              const composition = _.get(
                fMCGeoItem,
                GeomapFieldsMapping.multiCountryComposition,
                [],
              );
              composition.forEach((item: any) => {
                const iso3 = _.get(
                  item,
                  GeomapFieldsMapping.multiCountryCompositionItem,
                  '',
                );
                const fCountry = _.find(staticCountries, {iso3: iso3});
                if (fCountry) {
                  coordinates.push([fCountry.longitude, fCountry.latitude]);
                }
              });
              if (coordinates.length > 0) {
                const lonlat = center(points(coordinates));
                longitude = lonlat.geometry.coordinates[0];
                latitude = lonlat.geometry.coordinates[1];
              }
            }
            data.push({
              id: mc,
              code: mc.replace(/\//g, '|'),
              geoName: mc,
              components: groupedByMulticountry[mc].map((item: any) => ({
                name: _.get(
                  item,
                  GeomapFieldsMapping.multicountryComponent,
                  '',
                ),
                activitiesCount: _.get(item, GeomapFieldsMapping.count, 0),
                value: _.get(item, aggregationField, 0),
              })),
              disbursed: _.sumBy(
                groupedByMulticountry[mc],
                GeomapFieldsMapping.disbursed,
              ),
              committed: _.sumBy(
                groupedByMulticountry[mc],
                GeomapFieldsMapping.committed,
              ),
              signed: _.sumBy(
                groupedByMulticountry[mc],
                GeomapFieldsMapping.signed,
              ),
              latitude: latitude,
              longitude: longitude,
            });
          });
          return {
            pins: data,
          };
        }),
      )
      .catch(handleDataApiError);
  }

  // Location page

  @get('/location/disbursements/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  locationDetailTreemap(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.locationDisbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentGrants: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let grantName = item[TreemapFieldsMapping.grantName];
            let grantCode = item[TreemapFieldsMapping.grantCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              grantName = item[TreemapFieldsMapping.multicountry];
              grantCode = item[TreemapFieldsMapping.multicountry];
            }
            componentGrants.push({
              name: `${grantName} | ${grantCode}`,
              code: grantCode,
              value: item[TreemapFieldsMapping.disbursed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.disbursed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: grantName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.disbursed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const disbursed = _.sumBy(componentGrants, 'value');
          const committed = _.sumBy(
            componentGrants,
            'tooltip.totalInvestments.committed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: disbursed,
            formattedValue: formatFinancialValue(disbursed),
            _children: _.orderBy(componentGrants, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentGrants,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentGrants, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed: _.sumBy(
                  componentGrants,
                  'tooltip.totalInvestments.signed',
                ),
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/location/signed/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  locationDetailTreemapSigned(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.locationDisbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentGrants: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let grantName = item[TreemapFieldsMapping.grantName];
            let grantCode = item[TreemapFieldsMapping.grantCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              grantName = item[TreemapFieldsMapping.multicountry];
              grantCode = item[TreemapFieldsMapping.multicountry];
            }
            componentGrants.push({
              name: `${grantName} | ${grantCode}`,
              code: grantCode,
              value: item[TreemapFieldsMapping.signed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.signed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: grantName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.signed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const signed = _.sumBy(componentGrants, 'value');
          const committed = _.sumBy(
            componentGrants,
            'tooltip.totalInvestments.committed',
          );
          const disbursed = _.sumBy(
            componentGrants,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: signed,
            formattedValue: formatFinancialValue(signed),
            _children: _.orderBy(componentGrants, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentGrants,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentGrants, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed,
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/location/commitment/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  locationDetailTreemapCommitment(): object {
    const filterString = getFilterString(
      this.req.query,
      TreemapFieldsMapping.locationDisbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantsNoCount}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, TreemapFieldsMapping.dataPath, []),
          TreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentGrants: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            let grantName = item[TreemapFieldsMapping.grantName];
            let grantCode = item[TreemapFieldsMapping.grantCode];
            if (item[TreemapFieldsMapping.multicountry] !== null) {
              grantName = item[TreemapFieldsMapping.multicountry];
              grantCode = item[TreemapFieldsMapping.multicountry];
            }
            componentGrants.push({
              name: `${grantName} | ${grantCode}`,
              code: grantCode,
              value: item[TreemapFieldsMapping.committed],
              formattedValue: formatFinancialValue(
                item[TreemapFieldsMapping.committed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: grantName,
                    count: item.count,
                    investment: item[TreemapFieldsMapping.committed],
                  },
                ],
                totalInvestments: {
                  committed: item[TreemapFieldsMapping.committed],
                  disbursed: item[TreemapFieldsMapping.disbursed],
                  signed: item[TreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[TreemapFieldsMapping.disbursed] * 100) /
                  item[TreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const committed = _.sumBy(componentGrants, 'value');
          const signed = _.sumBy(
            componentGrants,
            'tooltip.totalInvestments.signed',
          );
          const disbursed = _.sumBy(
            componentGrants,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: committed,
            formattedValue: formatFinancialValue(committed),
            _children: _.orderBy(componentGrants, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentGrants,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentGrants, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed,
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  // Grant page

  @get('/grant/disbursements/time-cycle')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  grantDetailTimeCycle(): object {
    const filterString = grantDetailGetFilterString(
      this.req.query,
      GrantDetailTimeCycleFieldsMapping.disbursementsTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantDetailDisbursements}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let apiData = _.get(
          resp.data,
          GrantDetailTimeCycleFieldsMapping.dataPath,
          [],
        );
        if (apiData.length > 0) {
          if (
            _.get(apiData[0], GrantDetailTimeCycleFieldsMapping.year, '')
              .length > 4
          ) {
            apiData = _.filter(
              apiData,
              (item: any) => item[GrantDetailTimeCycleFieldsMapping.year],
            ).map((item: any) => ({
              ...item,
              [GrantDetailTimeCycleFieldsMapping.year]: item[
                GrantDetailTimeCycleFieldsMapping.year
              ].slice(0, 4),
            }));
          }
        }
        const groupedDataByYear = _.groupBy(
          apiData,
          GrantDetailTimeCycleFieldsMapping.year,
        );
        const data: any = [];
        Object.keys(groupedDataByYear).forEach((year: string) => {
          const dataItems = groupedDataByYear[year];
          const yearComponents: any = [];
          _.orderBy(
            dataItems,
            GrantDetailTimeCycleFieldsMapping.year,
            'asc',
          ).forEach((item: any) => {
            const value = parseInt(
              _.get(item, GrantDetailTimeCycleFieldsMapping.disbursed, 0),
              10,
            );
            if (value) {
              const name = _.get(
                item,
                GrantDetailTimeCycleFieldsMapping.component,
                '',
              );
              const prevYearComponent = _.get(
                data,
                `[${data.length - 1}].cumulativeChildren`,
                [],
              );
              yearComponents.push({
                name,
                disbursed: value,
                cumulative:
                  _.get(_.find(prevYearComponent, {name}), 'value', 0) + value,
              });
            }
          });
          const disbursed = _.sumBy(yearComponents, 'disbursed');
          const cumulative = _.sumBy(yearComponents, 'cumulative');
          if (disbursed > 0) {
            data.push({
              year,
              disbursed,
              cumulative,
              disbursedChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    GrantDetailTimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.disbursed,
                }),
              ),
              cumulativeChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    GrantDetailTimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.cumulative,
                }),
              ),
            });
          }
        });
        return {
          count: data.length,
          data: data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/commitment/time-cycle')
  @response(200, DISBURSEMENTS_TIME_CYCLE_RESPONSE)
  grantDetailTimeCycleCommitment(): object {
    const filterString = getFilterString(
      this.req.query,
      GrantCommittedTimeCycleFieldsMapping.aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.commitments}/?${params}${filterString
      .replace(
        filteringGrants.IPnumber,
        GrantCommittedTimeCycleFieldsMapping.IPnumber,
      )
      .replace(
        filteringGrants.grantId,
        GrantCommittedTimeCycleFieldsMapping.grantId,
      )}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let apiData = _.get(resp.data, TimeCycleFieldsMapping.dataPath, []);
        if (apiData.length > 0) {
          if (
            _.get(apiData[0], TimeCycleFieldsMapping.committedYear, '').length >
            4
          ) {
            apiData = _.filter(
              apiData,
              (item: any) => item[TimeCycleFieldsMapping.committedYear],
            ).map((item: any) => ({
              ...item,
              [TimeCycleFieldsMapping.committedYear]: item[
                TimeCycleFieldsMapping.committedYear
              ].slice(0, 4),
            }));
          }
        }
        const groupedDataByYear = _.groupBy(
          apiData,
          TimeCycleFieldsMapping.committedYear,
        );
        const data: any = [];
        Object.keys(groupedDataByYear).forEach((year: string) => {
          const dataItems = groupedDataByYear[year];
          const yearComponents: any = [];
          _.orderBy(
            dataItems,
            TimeCycleFieldsMapping.committedYear,
            'asc',
          ).forEach((item: any) => {
            const value = parseInt(
              _.get(item, TimeCycleFieldsMapping.committed, 0),
              10,
            );
            if (value) {
              const name = _.get(item, TimeCycleFieldsMapping.component, '');
              const prevYearComponent = _.get(
                data,
                `[${data.length - 1}].cumulativeChildren`,
                [],
              );
              yearComponents.push({
                name,
                disbursed: value,
                cumulative:
                  _.get(_.find(prevYearComponent, {name}), 'value', 0) + value,
              });
            }
          });
          const disbursed = _.sumBy(yearComponents, 'disbursed');
          const cumulative = _.sumBy(yearComponents, 'cumulative');
          if (disbursed > 0) {
            data.push({
              year,
              disbursed,
              cumulative,
              disbursedChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.disbursed,
                }),
              ),
              cumulativeChildren: _.orderBy(yearComponents, 'name', 'asc').map(
                (yc: any) => ({
                  name: yc.name,
                  color: _.get(
                    TimeCycleFieldsMapping.componentColors,
                    yc.name,
                    '',
                  ),
                  value: yc.cumulative,
                }),
              ),
            });
          }
        });
        return {
          count: data.length,
          data: data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/disbursements/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  grantDetailTreemap(): object {
    const filterString = grantDetailTreemapGetFilterString(
      this.req.query,
      GrantDetailTreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantDetailGrants}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, GrantDetailTreemapFieldsMapping.dataPath, []),
          GrantDetailTreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: _.get(
                item,
                GrantDetailTreemapFieldsMapping.locationName,
                '',
              ),
              value: item[GrantDetailTreemapFieldsMapping.disbursed],
              formattedValue: formatFinancialValue(
                item[GrantDetailTreemapFieldsMapping.disbursed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: _.get(
                      item,
                      GrantDetailTreemapFieldsMapping.locationName,
                      '',
                    ),
                    count: item.count,
                    investment: item[GrantDetailTreemapFieldsMapping.disbursed],
                  },
                ],
                totalInvestments: {
                  committed: item[GrantDetailTreemapFieldsMapping.committed],
                  disbursed: item[GrantDetailTreemapFieldsMapping.disbursed],
                  signed: item[GrantDetailTreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[GrantDetailTreemapFieldsMapping.disbursed] * 100) /
                  item[GrantDetailTreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const disbursed = _.sumBy(componentLocations, 'value');
          const committed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.committed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: disbursed,
            formattedValue: formatFinancialValue(disbursed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed: _.sumBy(
                  componentLocations,
                  'tooltip.totalInvestments.signed',
                ),
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/signed/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  grantDetailTreemapSigned(): object {
    const filterString = grantDetailTreemapGetFilterString(
      this.req.query,
      GrantDetailTreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantDetailGrants}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, GrantDetailTreemapFieldsMapping.dataPath, []),
          GrantDetailTreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: _.get(
                item,
                GrantDetailTreemapFieldsMapping.locationName,
                '',
              ),
              value: item[GrantDetailTreemapFieldsMapping.signed],
              formattedValue: formatFinancialValue(
                item[GrantDetailTreemapFieldsMapping.signed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: _.get(
                      item,
                      GrantDetailTreemapFieldsMapping.locationName,
                      '',
                    ),
                    count: item.count,
                    investment: item[GrantDetailTreemapFieldsMapping.signed],
                  },
                ],
                totalInvestments: {
                  committed: item[GrantDetailTreemapFieldsMapping.committed],
                  disbursed: item[GrantDetailTreemapFieldsMapping.disbursed],
                  signed: item[GrantDetailTreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[GrantDetailTreemapFieldsMapping.disbursed] * 100) /
                  item[GrantDetailTreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const signed = _.sumBy(componentLocations, 'value');
          const committed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.committed',
          );
          const disbursed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: signed,
            formattedValue: formatFinancialValue(signed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed: _.sumBy(
                  componentLocations,
                  'tooltip.totalInvestments.signed',
                ),
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/commitment/treemap')
  @response(200, DISBURSEMENTS_TREEMAP_RESPONSE)
  grantDetailTreemapCommitment(): object {
    const filterString = grantDetailTreemapGetFilterString(
      this.req.query,
      GrantDetailTreemapFieldsMapping.disbursementsTreemapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      filtering.param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${urls.grantDetailGrants}/?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, GrantDetailTreemapFieldsMapping.dataPath, []),
          GrantDetailTreemapFieldsMapping.component,
        );
        const data: DisbursementsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const componentLocations: DisbursementsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            componentLocations.push({
              name: _.get(
                item,
                GrantDetailTreemapFieldsMapping.locationName,
                '',
              ),
              value: item[GrantDetailTreemapFieldsMapping.committed],
              formattedValue: formatFinancialValue(
                item[GrantDetailTreemapFieldsMapping.committed],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: _.get(
                      item,
                      GrantDetailTreemapFieldsMapping.locationName,
                      '',
                    ),
                    count: item.count,
                    investment: item[GrantDetailTreemapFieldsMapping.committed],
                  },
                ],
                totalInvestments: {
                  committed: item[GrantDetailTreemapFieldsMapping.committed],
                  disbursed: item[GrantDetailTreemapFieldsMapping.disbursed],
                  signed: item[GrantDetailTreemapFieldsMapping.signed],
                },
                percValue: (
                  (item[GrantDetailTreemapFieldsMapping.disbursed] * 100) /
                  item[GrantDetailTreemapFieldsMapping.committed]
                ).toString(),
              },
            });
          });
          const committed = _.sumBy(componentLocations, 'value');
          const signed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.signed',
          );
          const disbursed = _.sumBy(
            componentLocations,
            'tooltip.totalInvestments.disbursed',
          );
          data.push({
            name: component,
            color: '#DFE3E5',
            value: committed,
            formattedValue: formatFinancialValue(committed),
            _children: _.orderBy(componentLocations, 'value', 'desc'),
            tooltip: {
              header: component,
              componentsStats: [
                {
                  name: component,
                  count: _.sumBy(
                    componentLocations,
                    'tooltip.componentsStats[0].count',
                  ),
                  investment: _.sumBy(componentLocations, 'value'),
                },
              ],
              totalInvestments: {
                committed,
                disbursed,
                signed: _.sumBy(
                  componentLocations,
                  'tooltip.totalInvestments.signed',
                ),
              },
              percValue: ((disbursed * 100) / committed).toString(),
            },
          });
        });
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }
}