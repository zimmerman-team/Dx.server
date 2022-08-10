import {inject} from '@loopback/core';
import {
  get,
  Request,
  response,
  ResponseObject,
  RestBindings
} from '@loopback/rest';
import center from '@turf/center';
import {points, Position} from '@turf/helpers';
import axios, {AxiosResponse} from 'axios';
import _ from 'lodash';
import querystring from 'querystring';
import filtering from '../config/filtering/index.json';
import BudgetsFlowFieldsMapping from '../config/mapping/budgets/flow.json';
import BudgetsFlowDrilldownFieldsMapping from '../config/mapping/budgets/flowDrilldown.json';
import BudgetsGeomapFieldsMapping from '../config/mapping/budgets/geomap.json';
import BudgetsTimeCycleFieldsMapping from '../config/mapping/budgets/timeCycle.json';
import urls from '../config/urls/index.json';
import {BudgetsFlowData} from '../interfaces/budgetsFlow';
import {BudgetsTimeCycleData} from '../interfaces/budgetsTimeCycle';
import {BudgetsTreemapDataItem} from '../interfaces/budgetsTreemap';
import staticCountries from '../static-assets/countries.json';
import {handleDataApiError} from '../utils/dataApiError';
import {getDrilldownFilterString} from '../utils/filtering/budgets/getDrilldownFilterString';
import {getFilterString} from '../utils/filtering/budgets/getFilterString';
import {formatFinancialValue} from '../utils/formatFinancialValue';

const BUDGETS_FLOW_RESPONSE: ResponseObject = {
  description: 'Budgets Flow Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'BudgetsFlowResponse',
        properties: {
          totalBudget: {type: 'number'},
          data: {
            type: 'object',
            properties: {
              nodes: {
                type: 'array',
                item: {
                  type: 'object',
                  properties: {
                    id: {type: 'string'},
                    filterStr: {type: 'string'},
                  },
                },
              },
              links: {
                type: 'array',
                item: {
                  type: 'object',
                  properties: {
                    source: {type: 'string'},
                    target: {type: 'string'},
                    amount: {type: 'number'},
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
const BUDGETS_TIME_CYCLE_RESPONSE: ResponseObject = {
  description: 'Budgets Time Cycle Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'BudgetsTimeCycleResponse',
        properties: {
          data: {
            type: 'object',
          },
        },
      },
    },
  },
};

export class BudgetsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/budgets/flow')
  @response(200, BUDGETS_FLOW_RESPONSE)
  flow(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsFlowFieldsMapping, datasource).budgetsFlowAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(BudgetsFlowFieldsMapping, datasource).dataPath, []);
        let formattedRawData = [];
        if (_.get(rawData, `[0].${_.get(BudgetsFlowFieldsMapping, datasource).level1}`, null)) {
          formattedRawData = rawData.map((item: any) => ({
            amount: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).amount, 0),
            count: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).count, 0),
            level1: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).level1, ''),
            level2: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).level2, ''),
            costCategory: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).costCategory, '')
              .replace(/\(/g, '- ')
              .replace(/\)/g, ''),
            rawCostCategory: _.get(
              item,
              _.get(BudgetsFlowFieldsMapping, datasource).costCategory,
              '',
            ),
            component: _.get(item, _.get(BudgetsFlowFieldsMapping, datasource).component, ''),
          }));
        }
        const totalBudget = _.sumBy(formattedRawData, 'amount');

        const data: BudgetsFlowData = {nodes: [], links: []};

        // 4th column
        const costCategoryGroupBy = _.groupBy(formattedRawData, 'costCategory');
        Object.keys(costCategoryGroupBy).forEach(costCategory => {
          const groupedByTotalBudget = _.sumBy(
            costCategoryGroupBy[costCategory],
            'amount',
          );
          const groupedByComponents = _.groupBy(
            costCategoryGroupBy[costCategory],
            'component',
          );
          data.nodes.push({
            id: costCategory,
            filterStr: `budgetCategory/budgetCategoryName eq '${costCategoryGroupBy[costCategory][0].rawCostCategory}'`,
            components: _.sortBy(Object.keys(groupedByComponents)).map(
              componentKey => {
                const compValue = _.sumBy(
                  groupedByComponents[componentKey],
                  'amount',
                );
                const compCount = _.sumBy(
                  groupedByComponents[componentKey],
                  'count',
                );
                return {
                  id: componentKey,
                  color: _.get(
                    _.get(BudgetsFlowFieldsMapping, datasource).componentColors,
                    componentKey,
                    '',
                  ),
                  value: compValue,
                  count: compCount,
                  height: (compValue * 100) / groupedByTotalBudget,
                };
              },
            ),
          });
        });

        // 3rd column
        const level2GroupBy = _.groupBy(formattedRawData, 'level2');
        Object.keys(level2GroupBy).forEach(level2 => {
          const groupedByTotalBudget = _.sumBy(level2GroupBy[level2], 'amount');
          const groupedByComponents = _.groupBy(
            level2GroupBy[level2],
            'component',
          );
          data.nodes.push({
            id: level2,
            filterStr: `budgetCategory/budgetCategoryParent/budgetCategoryName eq '${level2}'`,
            components: _.sortBy(Object.keys(groupedByComponents)).map(
              componentKey => {
                const compValue = _.sumBy(
                  groupedByComponents[componentKey],
                  'amount',
                );
                const compCount = _.sumBy(
                  groupedByComponents[componentKey],
                  'count',
                );
                return {
                  id: componentKey,
                  color: _.get(
                    _.get(BudgetsFlowFieldsMapping, datasource).componentColors,
                    componentKey,
                    '',
                  ),
                  value: compValue,
                  count: compCount,
                  height: (compValue * 100) / groupedByTotalBudget,
                };
              },
            ),
          });
          level2GroupBy[level2].forEach(item => {
            const foundIndex = _.findIndex(
              data.links,
              l => l.source === level2 && l.target === item.costCategory,
            );
            if (foundIndex === -1) {
              if (level2 !== item.costCategory) {
                data.links.push({
                  source: level2,
                  target: item.costCategory,
                  value: item.amount,
                });
              }
            } else {
              data.links[foundIndex].value += item.amount;
            }
          });
        });

        // 2nd column
        const level1GroupBy = _.groupBy(formattedRawData, 'level1');
        Object.keys(level1GroupBy).forEach(level1 => {
          const groupedByTotalBudget = _.sumBy(level1GroupBy[level1], 'amount');
          const groupedByComponents = _.groupBy(
            level1GroupBy[level1],
            'component',
          );
          data.nodes.push({
            id: level1,
            filterStr: `budgetCategory/budgetCategoryParent/budgetCategoryParent/budgetCategoryName eq '${level1}'`,
            components: _.sortBy(Object.keys(groupedByComponents)).map(
              componentKey => {
                const compValue = _.sumBy(
                  groupedByComponents[componentKey],
                  'amount',
                );
                const compCount = _.sumBy(
                  groupedByComponents[componentKey],
                  'count',
                );
                return {
                  id: componentKey,
                  color: _.get(
                    _.get(BudgetsFlowFieldsMapping, datasource).componentColors,
                    componentKey,
                    '',
                  ),
                  value: compValue,
                  count: compCount,
                  height: (compValue * 100) / groupedByTotalBudget,
                };
              },
            ),
          });
          level1GroupBy[level1].forEach(item => {
            const foundIndex = _.findIndex(
              data.links,
              l => l.source === level1 && l.target === item.level2,
            );
            if (foundIndex === -1) {
              data.links.push({
                source: level1,
                target: item.level2,
                value: item.amount,
              });
            } else {
              data.links[foundIndex].value += item.amount;
            }
          });
          data.links.push({
            source: 'Budgets',
            target: level1,
            value: _.sumBy(level1GroupBy[level1], 'amount'),
          });
        });

        const groupedByComponents = _.groupBy(formattedRawData, 'component');

        // 1st column
        data.nodes.push({
          id: 'Budgets',
          filterStr: 'activityArea/activityAreaParent/activityAreaName ne null',
          components: _.sortBy(Object.keys(groupedByComponents)).map(
            componentKey => {
              const compValue = _.sumBy(
                groupedByComponents[componentKey],
                'amount',
              );
              const compCount = _.sumBy(
                groupedByComponents[componentKey],
                'count',
              );
              return {
                id: componentKey,
                color: _.get(
                  _.get(BudgetsFlowFieldsMapping, datasource).componentColors,
                  componentKey,
                  '',
                ),
                value: compValue,
                count: compCount,
                height: (compValue * 100) / totalBudget,
              };
            },
          ),
        });

        data.nodes = _.uniqBy(data.nodes, 'id');
        data.nodes = _.sortBy(data.nodes, 'id');
        data.links = _.sortBy(data.links, ['source', 'target']);

        return {
          ...data,
          totalBudget,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/budgets/time-cycle')
  @response(200, BUDGETS_TIME_CYCLE_RESPONSE)
  timeCycle(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsTimeCycleFieldsMapping, datasource).budgetsTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        let rawData = _.get(
          resp.data,
          _.get(BudgetsTimeCycleFieldsMapping, datasource).dataPath,
          [],
        );
        if (rawData.length > 0) {
          if (
            _.get(rawData[0], _.get(BudgetsTimeCycleFieldsMapping, datasource).year, '').length > 4
          ) {
            rawData = _.filter(
              rawData,
              (item: any) => item[_.get(BudgetsTimeCycleFieldsMapping, datasource).year],
            ).map((item: any) => ({
              ...item,
              [_.get(BudgetsTimeCycleFieldsMapping, datasource).year]: item[
                _.get(BudgetsTimeCycleFieldsMapping, datasource).year
              ].slice(0, 4),
            }));
          }
        }
        const returnData: BudgetsTimeCycleData = {data: []};
        const groupedYears = _.groupBy(
          rawData,
          _.get(BudgetsTimeCycleFieldsMapping, datasource).year,
        );
        Object.keys(groupedYears).forEach(yKey => {
          const instance = groupedYears[yKey];
          let components = {};
          const groupedYComponents = _.groupBy(
            instance,
            _.get(BudgetsTimeCycleFieldsMapping, datasource).component,
          );
          Object.keys(groupedYComponents).forEach(ycKey => {
            components = {
              ...components,
              [ycKey]: _.sumBy(
                groupedYComponents[ycKey],
                _.get(BudgetsTimeCycleFieldsMapping, datasource).amount,
              ),
              [`${ycKey}Color`]: _.get(
                _.get(BudgetsTimeCycleFieldsMapping, datasource).componentColors,
                ycKey,
                '#000',
              ),
            };
          });
          returnData.data.push({
            year: yKey,
            ...components,
            amount: _.sumBy(instance, _.get(BudgetsTimeCycleFieldsMapping, datasource).amount),
          });
        });
        return returnData;
      })
      .catch(handleDataApiError);
  }

  @get('/budgets/drilldown')
  @response(200, BUDGETS_FLOW_RESPONSE)
  flowDrilldown(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    if (!this.req.query.levelParam) {
      return {
        count: 0,
        data: [],
        message: '"levelParam" parameters are required.',
      };
    }
    const filterString = getDrilldownFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsFlowDrilldownFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
        const groupedDataByComponent = _.groupBy(
          _.get(resp.data, _.get(BudgetsFlowDrilldownFieldsMapping, datasource).dataPath, []),
          _.get(BudgetsFlowDrilldownFieldsMapping, datasource).component,
        );
        const data: BudgetsTreemapDataItem[] = [];
        Object.keys(groupedDataByComponent).forEach((component: string) => {
          const dataItems = groupedDataByComponent[component];
          const children: BudgetsTreemapDataItem[] = [];
          dataItems.forEach((item: any) => {
            children.push({
              name: _.get(item, _.get(BudgetsFlowDrilldownFieldsMapping, datasource).child, ''),
              value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
              formattedValue: formatFinancialValue(
                item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
              ),
              color: '#595C70',
              tooltip: {
                header: component,
                componentsStats: [
                  {
                    name: _.get(
                      item,
                      _.get(BudgetsFlowDrilldownFieldsMapping, datasource).child,
                      '',
                    ),
                    value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
                  },
                ],
                value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
              },
            });
          });
          const value = _.sumBy(children, 'value');
          data.push({
            name: component,
            color: '#DFE3E5',
            value,
            formattedValue: formatFinancialValue(value),
            _children: _.orderBy(children, 'value', 'desc'),
            tooltip: {
              header: component,
              value,
              componentsStats: [
                {
                  name: component,
                  value: _.sumBy(children, 'value'),
                },
              ],
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

  @get('/budgets/drilldown/2')
  @response(200, BUDGETS_FLOW_RESPONSE)
  flowDrilldownLevel2(): object {
    if (!this.req.query.levelParam || !this.req.query.activityAreaName) {
      return {
        count: 0,
        data: [],
        message: '"levelParam" and "activityAreaName" parameters are required.',
      };
    }
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getDrilldownFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsFlowDrilldownFieldsMapping, datasource).aggregation2,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(
          resp.data,
          _.get(BudgetsFlowDrilldownFieldsMapping, datasource).dataPath,
          [],
        );
        const totalValue = _.sumBy(
          rawData,
          _.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount,
        );
        const areaName = this.req.query.activityAreaName as string;
        const data: BudgetsTreemapDataItem[] = [
          {
            name: areaName,
            color: '#DFE3E5',
            value: totalValue,
            formattedValue: formatFinancialValue(totalValue),
            _children: _.orderBy(
              rawData.map((item: any) => ({
                name: _.get(item, _.get(BudgetsFlowDrilldownFieldsMapping, datasource).grant, ''),
                value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
                formattedValue: formatFinancialValue(
                  item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
                ),
                color: '#595C70',
                tooltip: {
                  header: areaName,
                  componentsStats: [
                    {
                      name: _.get(
                        item,
                        _.get(BudgetsFlowDrilldownFieldsMapping, datasource).grant,
                        '',
                      ),
                      value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
                    },
                  ],
                  value: item[_.get(BudgetsFlowDrilldownFieldsMapping, datasource).amount],
                },
              })),
              'value',
              'desc',
            ),
            tooltip: {
              header: areaName,
              value: totalValue,
              componentsStats: [
                {
                  name: areaName,
                  value: totalValue,
                },
              ],
            },
          },
        ];
        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/budgets/geomap')
  @response(200, BUDGETS_FLOW_RESPONSE)
  geomap(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsGeomapFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(_.get(urls, datasource).geojson)])
      .then(
        axios.spread((...responses) => {
          const geoJSONData = responses[1].data.features;
          const data: any = [];
          const groupedDataByLocation = _.groupBy(
            responses[0].data.value,
            _.get(BudgetsGeomapFieldsMapping, datasource).locationCode,
          );
          Object.keys(groupedDataByLocation).forEach((iso3: string) => {
            const dataItems = groupedDataByLocation[iso3];
            const locationComponents: any = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: _.get(item, _.get(BudgetsGeomapFieldsMapping, datasource).component, ''),
                value: item[_.get(BudgetsGeomapFieldsMapping, datasource).amount],
              });
            });
            data.push({
              code: iso3,
              components: locationComponents,
              value: _.sumBy(locationComponents, 'value'),
            });
          });
          const maxValue: number = _.max(data.map((d: any) => d.value)) ?? 0;
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
              if (
                (fItem.value < maxValue || fItem.value === maxValue) &&
                (fItem.value >= intervals[11] || fItem.value === intervals[11])
              ) {
                itemValue = 12;
              }
              if (
                (fItem.value < intervals[11] ||
                  fItem.value === intervals[11]) &&
                (fItem.value >= intervals[10] || fItem.value === intervals[10])
              ) {
                itemValue = 11;
              }
              if (
                (fItem.value < intervals[10] ||
                  fItem.value === intervals[10]) &&
                (fItem.value >= intervals[9] || fItem.value === intervals[9])
              ) {
                itemValue = 10;
              }
              if (
                (fItem.value < intervals[9] || fItem.value === intervals[9]) &&
                (fItem.value >= intervals[8] || fItem.value === intervals[8])
              ) {
                itemValue = 9;
              }
              if (
                (fItem.value < intervals[8] || fItem.value === intervals[8]) &&
                (fItem.value >= intervals[7] || fItem.value === intervals[7])
              ) {
                itemValue = 8;
              }
              if (
                (fItem.value < intervals[7] || fItem.value === intervals[7]) &&
                (fItem.value >= intervals[6] || fItem.value === intervals[6])
              ) {
                itemValue = 7;
              }
              if (
                (fItem.value < intervals[6] || fItem.value === intervals[6]) &&
                (fItem.value >= intervals[5] || fItem.value === intervals[5])
              ) {
                itemValue = 6;
              }
              if (
                (fItem.value < intervals[5] || fItem.value === intervals[5]) &&
                (fItem.value >= intervals[4] || fItem.value === intervals[4])
              ) {
                itemValue = 5;
              }
              if (
                (fItem.value < intervals[4] || fItem.value === intervals[4]) &&
                (fItem.value >= intervals[3] || fItem.value === intervals[3])
              ) {
                itemValue = 4;
              }
              if (
                (fItem.value < intervals[3] || fItem.value === intervals[3]) &&
                (fItem.value >= intervals[2] || fItem.value === intervals[2])
              ) {
                itemValue = 3;
              }
              if (
                (fItem.value < intervals[2] || fItem.value === intervals[2]) &&
                (fItem.value >= intervals[1] || fItem.value === intervals[1])
              ) {
                itemValue = 2;
              }
              if (
                (fItem.value < intervals[1] || fItem.value === intervals[1]) &&
                (fItem.value >= intervals[0] || fItem.value === intervals[0])
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
                    value: fItem.value,
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

  @get('/budgets/geomap/multicountries')
  @response(200, BUDGETS_FLOW_RESPONSE)
  geomapMulticountries(): object {

    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(BudgetsGeomapFieldsMapping, datasource).aggregationMulticountry,
      'grantAgreementImplementationPeriod/grantAgreement/multiCountry/multiCountryName ne null',
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).budgets}?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(_.get(urls, datasource).multicountriescountriesdata)])
      .then(
        axios.spread((...responses) => {
          const rawData = _.get(
            responses[0].data,
            _.get(BudgetsGeomapFieldsMapping, datasource).dataPath,
            [],
          );
          const mcGeoData = _.get(
            responses[1].data,
            _.get(BudgetsGeomapFieldsMapping, datasource).dataPath,
            [],
          );
          const data: any = [];
          const groupedByMulticountry = _.groupBy(
            rawData,
            _.get(BudgetsGeomapFieldsMapping, datasource).multicountry,
          );
          Object.keys(groupedByMulticountry).forEach((mc: string) => {
            const fMCGeoItem = _.find(
              mcGeoData,
              (mcGeoItem: any) =>
                _.get(
                  mcGeoItem,
                  _.get(BudgetsGeomapFieldsMapping, datasource).geodatamulticountry,
                  '',
                ) === mc,
            );
            let latitude = 0;
            let longitude = 0;
            if (fMCGeoItem) {
              const coordinates: Position[] = [];
              const composition = _.get(
                fMCGeoItem,
                _.get(BudgetsGeomapFieldsMapping, datasource).multiCountryComposition,
                [],
              );
              composition.forEach((item: any) => {
                const iso3 = _.get(
                  item,
                  _.get(BudgetsGeomapFieldsMapping, datasource).multiCountryCompositionItem,
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
                  _.get(BudgetsGeomapFieldsMapping, datasource).multicountryComponent,
                  '',
                ),
                value: _.get(item, _.get(BudgetsGeomapFieldsMapping, datasource).amount, 0),
              })),
              latitude: latitude,
              longitude: longitude,
              value: _.sumBy(
                groupedByMulticountry[mc],
                _.get(BudgetsGeomapFieldsMapping, datasource).amount,
              ),
            });
          });
          return {
            pins: data,
          };
        }),
      )
      .catch(handleDataApiError);
  }
}
