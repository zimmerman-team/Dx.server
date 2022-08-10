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
import AllocationsDrilldownFieldsMapping from '../config/mapping/allocations/drilldown.json';
import AllocationsGeomapFieldsMapping from '../config/mapping/allocations/geomap.json';
import AllocationsFieldsMapping from '../config/mapping/allocations/index.json';
import AllocationsPeriodsFieldsMapping from '../config/mapping/allocations/periods.json';
import urls from '../config/urls/index.json';
import {AllocationsTreemapDataItem} from '../interfaces/allocations';
import staticCountries from '../static-assets/countries.json';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/allocations/getFilterString';
import {formatFinancialValue} from '../utils/formatFinancialValue';

const ALLOCATIONS_RESPONSE: ResponseObject = {
  description: 'Allocations Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'AllocationsResponse',
        properties: {
          data: {
            type: 'object',
            properties: {
              total: {type: 'number'},
              values: {type: 'array', items: {type: 'number'}},
              keys: {type: 'array', items: {type: 'string'}},
              colors: {type: 'array', items: {type: 'string'}},
            },
          },
        },
      },
    },
  },
};

export class AllocationsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/allocations')
  @response(200, ALLOCATIONS_RESPONSE)
  allocations(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(AllocationsFieldsMapping, datasource).allocationsAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).allocations}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
        const rawData = _.orderBy(
          _.get(resp.data, _.get(AllocationsFieldsMapping, datasource).dataPath, []),
          _.get(AllocationsFieldsMapping, datasource).amount,
          'desc',
        );
        return {
          total: _.sumBy(rawData, 'amount'),
          values: rawData.map((item: any) =>
            _.get(item, _.get(AllocationsFieldsMapping, datasource).amount),
          ),
          keys: rawData.map((item: any) =>
            _.get(item, _.get(AllocationsFieldsMapping, datasource).component),
          ),
          colors: rawData.map((item: any) =>
            _.get(
              _.get(AllocationsFieldsMapping, datasource).componentColors,
              _.get(item, _.get(AllocationsFieldsMapping, datasource).component),
              '',
            ),
          ),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/allocations/periods')
  @response(200, ALLOCATIONS_RESPONSE)
  allocationsPeriods(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(AllocationsPeriodsFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).allocations}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        return {
          data: _.get(
            resp.data,
            _.get(AllocationsPeriodsFieldsMapping, datasource).dataPath,
            [],
          ).map(
            (item: any) =>
              `${_.get(
                item,
                _.get(AllocationsPeriodsFieldsMapping, datasource).periodStart,
                '',
              )} - ${_.get(
                item,
                _.get(AllocationsPeriodsFieldsMapping, datasource).periodEnd,
                '',
              )}`,
          ),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/allocations/drilldown')
  @response(200, ALLOCATIONS_RESPONSE)
  allocationsDrilldown(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(AllocationsDrilldownFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).allocations}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(
          resp.data,
          _.get(AllocationsDrilldownFieldsMapping, datasource).dataPath,
          [],
        );
        const data: AllocationsTreemapDataItem[] = [];
        const groupedByComponent = _.groupBy(
          rawData,
          _.get(AllocationsDrilldownFieldsMapping, datasource).component,
        );
        Object.keys(groupedByComponent).forEach((component: string) => {
          const value = _.sumBy(
            groupedByComponent[component],
            _.get(AllocationsDrilldownFieldsMapping, datasource).amount,
          );
          data.push({
            name: component,
            value,
            formattedValue: formatFinancialValue(value),
            color: '#DFE3E5',
            _children: _.orderBy(
              groupedByComponent[component].map((item: any) => ({
                name:
                  _.get(
                    item,
                    _.get(AllocationsDrilldownFieldsMapping, datasource).multicountry,
                    null,
                  ) ??
                  _.get(
                    item,
                    _.get(AllocationsDrilldownFieldsMapping, datasource).locationName,
                    '',
                  ),
                value: _.get(item, _.get(AllocationsDrilldownFieldsMapping, datasource).amount, 0),
                formattedValue: formatFinancialValue(
                  _.get(item, _.get(AllocationsDrilldownFieldsMapping, datasource).amount, 0),
                ),
                color: '#595C70',
                tooltip: {
                  header: component,
                  componentsStats: [
                    {
                      name:
                        _.get(
                          item,
                          _.get(AllocationsDrilldownFieldsMapping, datasource).multicountry,
                          null,
                        ) ??
                        _.get(
                          item,
                          _.get(AllocationsDrilldownFieldsMapping, datasource).locationName,
                          '',
                        ),
                      value: _.get(
                        item,
                        _.get(AllocationsDrilldownFieldsMapping, datasource).amount,
                        0,
                      ),
                    },
                  ],
                  value: _.get(
                    item,
                    _.get(AllocationsDrilldownFieldsMapping, datasource).amount,
                    0,
                  ),
                },
              })),
              'value',
              'desc',
            ),
            tooltip: {
              header: component,
              value,
              componentsStats: [
                {
                  name: component,
                  value,
                },
              ],
            },
          });
        });
        return {
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/allocations/geomap')
  @response(200, ALLOCATIONS_RESPONSE)
  geomap(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(AllocationsGeomapFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).allocations}?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(_.get(urls, datasource).geojson)])
      .then(
        axios.spread((...responses) => {
          const geoJSONData = responses[1].data.features;
          const data: any = [];
          const groupedDataByLocation = _.groupBy(
            responses[0].data.value,
            _.get(AllocationsGeomapFieldsMapping, datasource).locationCode,
          );
          Object.keys(groupedDataByLocation).forEach((iso3: string) => {
            const dataItems = groupedDataByLocation[iso3];
            const locationComponents: any = [];
            dataItems.forEach((item: any) => {
              locationComponents.push({
                name: _.get(item, _.get(AllocationsGeomapFieldsMapping, datasource).component, ''),
                value: item[_.get(AllocationsGeomapFieldsMapping, datasource).amount],
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

  @get('/allocations/geomap/multicountries')
  @response(200, ALLOCATIONS_RESPONSE)
  geomapMulticountries(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(AllocationsGeomapFieldsMapping, datasource).aggregationMulticountry,
      'multiCountryName ne null',
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).allocations}?${params}${filterString}`;

    return axios
      .all([axios.get(url), axios.get(_.get(urls, datasource).multicountriescountriesdata)])
      .then(
        axios.spread((...responses) => {
          const rawData = _.get(
            responses[0].data,
            _.get(AllocationsGeomapFieldsMapping, datasource).dataPath,
            [],
          );
          const mcGeoData = _.get(
            responses[1].data,
            _.get(AllocationsGeomapFieldsMapping, datasource).dataPath,
            [],
          );
          const data: any = [];
          const groupedByMulticountry = _.groupBy(
            rawData,
            _.get(AllocationsGeomapFieldsMapping, datasource).multicountry,
          );
          Object.keys(groupedByMulticountry).forEach((mc: string) => {
            const fMCGeoItem = _.find(
              mcGeoData,
              (mcGeoItem: any) =>
                _.get(
                  mcGeoItem,
                  _.get(AllocationsGeomapFieldsMapping, datasource).multicountry,
                  '',
                ) === mc,
            );
            let latitude = 0;
            let longitude = 0;
            if (fMCGeoItem) {
              const coordinates: Position[] = [];
              const composition = _.get(
                fMCGeoItem,
                _.get(AllocationsGeomapFieldsMapping, datasource).multiCountryComposition,
                [],
              );
              composition.forEach((item: any) => {
                const iso3 = _.get(
                  item,
                  _.get(AllocationsGeomapFieldsMapping, datasource).multiCountryCompositionItem,
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
                  _.get(AllocationsGeomapFieldsMapping, datasource).multicountryComponent,
                  '',
                ),
                value: _.get(item, _.get(AllocationsGeomapFieldsMapping, datasource).amount, 0),
              })),
              latitude: latitude,
              longitude: longitude,
              value: _.sumBy(
                groupedByMulticountry[mc],
                _.get(AllocationsGeomapFieldsMapping, datasource).amount,
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
