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
import PledgesContributionsGeoFieldsMapping from '../config/mapping/pledgescontributions/geo.json';
import PledgesContributionsTimeCycleFieldsMapping from '../config/mapping/pledgescontributions/timeCycle.json';
import PledgesContributionsTimeCycleDrilldownFieldsMapping from '../config/mapping/pledgescontributions/timeCycleDrilldown.json';
import urls from '../config/urls/index.json';
import {BudgetsTreemapDataItem} from '../interfaces/budgetsTreemap';
import {FilterGroupOption} from '../interfaces/filters';
import {PledgesContributionsTreemapDataItem} from '../interfaces/pledgesContributions';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/pledges-contributions/getFilterString';
import {formatFinancialValue} from '../utils/formatFinancialValue';
import {getD2HCoordinates} from '../utils/pledgescontributions/getD2HCoordinates';

const PLEDGES_AND_CONTRIBUTIONS_TIME_CYCLE_RESPONSE: ResponseObject = {
  description: 'Pledges and Contributions time-cycle Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'PledgesContributionsTimeCycleResponse',
        properties: {
          count: {type: 'number'},
          data: {
            type: 'array',
            properties: {
              year: {type: 'string'},
              pledge: {type: 'number'},
              contribution: {type: 'number'},
              pledgeColor: {type: 'string'},
              contributionColor: {type: 'string'},
            },
          },
        },
      },
    },
  },
};

export class PledgescontributionsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/pledges-contributions/time-cycle')
  @response(200, PLEDGES_AND_CONTRIBUTIONS_TIME_CYCLE_RESPONSE)
  timeCycle(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).pledgescontributionsTimeCycleAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).pledgescontributions}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(
          resp.data,
          _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).dataPath,
          [],
        );
        const groupByYear = _.groupBy(
          rawData,
          _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).year,
        );
        const data: Record<string, unknown>[] = [];

        _.orderBy(Object.keys(groupByYear), undefined, 'asc').forEach(
          (year: string) => {
            const pledge = _.find(
              groupByYear[year],
              (item: any) =>
                item[_.get(PledgesContributionsTimeCycleFieldsMapping, datasource).indicator] ===
                'Pledge',
            );
            const contribution = _.find(
              groupByYear[year],
              (item: any) =>
                item[_.get(PledgesContributionsTimeCycleFieldsMapping, datasource).indicator] ===
                'Contribution',
            );
            data.push({
              year,
              pledge: _.get(
                pledge,
                _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).amount,
                0,
              ),
              contribution: _.get(
                contribution,
                _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).amount,
                0,
              ),
              pledgeColor: '#BFCFEE',
              contributionColor: '#252C34',
            });
          },
        );

        return {
          count: data.length,
          data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/pledges-contributions/geomap')
  @response(200, PLEDGES_AND_CONTRIBUTIONS_TIME_CYCLE_RESPONSE)
  geomap(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(PledgesContributionsGeoFieldsMapping, datasource).pledgescontributionsGeoMapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const valueType = (
      this.req.query.valueType ?? _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
    ).toString();
    const url = `${_.get(urls, datasource).pledgescontributions}?${params}${filterString}`;

    return axios
      .all([
        axios.get(url),
        axios.get(
          _.get(PledgesContributionsGeoFieldsMapping, datasource).inAppDonorsFilterOptionsURL,
        ),
        axios.get(_.get(urls, datasource).geojson),
        axios.get(_.get(PledgesContributionsGeoFieldsMapping, datasource).d2hspatialshapesURL),
      ])
      .then(
        axios.spread((...responses) => {
          const geoJSONData = responses[2].data.features;
          const donorFilterOptions = responses[1].data.options;
          const D2HDonorCoordinateData: any[] = [];

          responses[3].data.value[0].members.forEach((member: any) => {
            member.donorSpatialShapes.forEach((shape: any) => {
              D2HDonorCoordinateData.push(shape);
            });
          });

          const rawData = _.get(
            responses[0].data,
            _.get(PledgesContributionsGeoFieldsMapping, datasource).dataPath,
            [],
          );
          const donorCountries = _.groupBy(
            rawData,
            _.get(PledgesContributionsGeoFieldsMapping, datasource).countryDonors,
          );
          const publicSectorCountries: any[] = [];
          const nonCountrySectorDonors: any[] = [];

          Object.keys(donorCountries).forEach((iso3: string) => {
            if (iso3 !== 'undefined') {
              const items: [any, ...any] = donorCountries[iso3];
              const pledges = _.filter(items, {
                [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                  _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge,
              });
              const contributions = _.filter(items, {
                [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                  _.get(PledgesContributionsGeoFieldsMapping, datasource).contribution,
              });
              publicSectorCountries.push({
                code: iso3,
                geoName: items[0].donor.geographicArea.geographicAreaName,
                id: items[0].donorId,
                amounts: [
                  valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                    ? {
                      label: 'Pledge',
                      value: _.sumBy(
                        pledges,
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                      ),
                    }
                    : {
                      label: 'Contribution',
                      value: _.sumBy(
                        contributions,
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                      ),
                    },
                ],
              });
            } else {
              const nonPublicDonors = _.groupBy(
                donorCountries[iso3],
                _.get(PledgesContributionsGeoFieldsMapping, datasource).nonCountryDonors,
              );
              Object.keys(nonPublicDonors).forEach(
                (donor: string, index: number) => {
                  const donorData = nonPublicDonors[donor][0];
                  const lat = _.get(
                    donorData,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).donorLat,
                    null,
                  );
                  const long = _.get(
                    donorData,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).donorLong,
                    null,
                  );
                  if (lat && long) {
                    const pledges = _.filter(nonPublicDonors[donor], {
                      [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge,
                    });
                    const contributions = _.filter(nonPublicDonors[donor], {
                      [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).contribution,
                    });
                    let subType = '';
                    donorFilterOptions.forEach((option: FilterGroupOption) => {
                      if (_.find(option.subOptions, {label: donor})) {
                        subType = option.label;
                      }
                    });
                    const multiCoordinates =
                      subType === 'Debt2Health'
                        ? getD2HCoordinates(donor, D2HDonorCoordinateData)
                        : null;
                    nonCountrySectorDonors.push({
                      code: donor,
                      geoName: donor,
                      id: _.get(
                        donorData,
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).donorId,
                      ),
                      latitude: parseFloat(
                        multiCoordinates ? multiCoordinates[0][0] : lat,
                      ),
                      longitude: parseFloat(
                        multiCoordinates ? multiCoordinates[0][1] : long,
                      ),
                      amounts: [
                        valueType ===
                          _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                          ? {
                            label: 'Pledge',
                            value: _.sumBy(
                              pledges,
                              _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                            ),
                          }
                          : {
                            label: 'Contribution',
                            value: _.sumBy(
                              contributions,
                              _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                            ),
                          },
                      ],
                      subType,
                      d2hCoordinates: multiCoordinates,
                      intId: index,
                    });
                  }
                },
              );
            }
          });

          const maxValue: number =
            _.max(
              publicSectorCountries.map((d: any) =>
                _.get(_.find(d.amounts, {label: valueType}), 'value', 0),
              ),
            ) ?? 0;
          let interval = 0;
          if (maxValue) {
            interval = maxValue / 13;
          }
          const intervals: number[] = [];
          for (let i = 0; i < 13; i++) {
            intervals.push(interval * i);
          }
          const features = geoJSONData.map((feature: any) => {
            const fItem = _.find(publicSectorCountries, {
              code: feature.id,
            });
            let itemValue = 0;
            if (fItem) {
              const fItemValue = _.get(
                _.find(fItem.amounts, {label: valueType}),
                'value',
                0,
              );
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
                iso_a3: feature.id,
                value: itemValue,
                data: fItem ? fItem : {},
              },
            };
          });

          return {
            maxValue,
            layers: features,
            pins: nonCountrySectorDonors,
          };
        }),
      )
      .catch(handleDataApiError);
  }

  @get('/pledges-contributions/time-cycle/drilldown')
  @response(200, PLEDGES_AND_CONTRIBUTIONS_TIME_CYCLE_RESPONSE)
  timeCycleDrilldown(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const valueType =
      (_.get(this.req.query, 'levelParam', '') as string)
        .split('-')
        .indexOf('pledge') > -1
        ? 'pledge'
        : 'contribution';
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).aggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).pledgescontributions}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.filter(
          _.get(
            resp.data,
            _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).dataPath,
            [],
          ),
          {
            [_.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).indicator]:
              _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource)[valueType],
          },
        );
        const levelComponent = _.get(
          rawData,
          `[0].${_.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).year}`,
          '',
        );
        const value = _.sumBy(
          rawData,
          _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).amount,
        );
        const data: PledgesContributionsTreemapDataItem[] = [
          {
            name: levelComponent,
            value,
            formattedValue: formatFinancialValue(value),
            color: '#DFE3E5',
            _children: _.orderBy(
              rawData.map((item: any) => ({
                name: _.get(
                  item,
                  _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).donor,
                  '',
                ),
                value: _.get(
                  item,
                  _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).amount,
                  0,
                ),
                formattedValue: formatFinancialValue(
                  _.get(
                    item,
                    _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).amount,
                    0,
                  ),
                ),
                color: '#595C70',
                tooltip: {
                  header: levelComponent,
                  componentsStats: [
                    {
                      name: _.get(
                        item,
                        _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).donor,
                        '',
                      ),
                      value: _.get(
                        item,
                        _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).amount,
                        0,
                      ),
                    },
                  ],
                  value: _.get(
                    item,
                    _.get(PledgesContributionsTimeCycleDrilldownFieldsMapping, datasource).amount,
                    0,
                  ),
                },
              })),
              'value',
              'desc',
            ),
            tooltip: {
              header: levelComponent,
              value,
              componentsStats: [
                {
                  name: levelComponent,
                  value,
                },
              ],
            },
          },
        ];
        return {
          data,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/pledges-contributions/treemap')
  @response(200, PLEDGES_AND_CONTRIBUTIONS_TIME_CYCLE_RESPONSE)
  treemap(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(PledgesContributionsGeoFieldsMapping, datasource).pledgescontributionsGeoMapAggregation,
    );
    const params = querystring.stringify(
      {},
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const valueType = (
      this.req.query.valueType ?? _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
    ).toString();
    const url = `${_.get(urls, datasource).pledgescontributions}?${params}${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(
          resp.data,
          _.get(PledgesContributionsGeoFieldsMapping, datasource).dataPath,
          [],
        );

        const donorCountries = _.groupBy(
          rawData,
          _.get(PledgesContributionsGeoFieldsMapping, datasource).countryDonors,
        );
        const publicSectorCountries: BudgetsTreemapDataItem[] = [];
        const nonCountrySectorDonors: BudgetsTreemapDataItem[] = [];

        Object.keys(donorCountries).forEach((iso3: string) => {
          if (iso3 !== 'undefined') {
            const items: [any, ...any] = donorCountries[iso3];
            const pledges = _.filter(items, {
              [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge,
            });
            const contributions = _.filter(items, {
              [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                _.get(PledgesContributionsGeoFieldsMapping, datasource).contribution,
            });
            publicSectorCountries.push({
              // code: items[0].donorId,
              name: items[0].donor.geographicArea.geographicAreaName,
              value:
                valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                  ? _.sumBy(
                    pledges,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                  )
                  : _.sumBy(
                    contributions,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                  ),
              formattedValue: formatFinancialValue(
                valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                  ? _.sumBy(
                    pledges,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                  )
                  : _.sumBy(
                    contributions,
                    _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                  ),
              ),
              color: '#DFE3E5',
              tooltip: {
                header: items[0].donor.geographicArea.geographicAreaName,
                componentsStats: [
                  {
                    name: valueType,
                    value:
                      valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                        ? _.sumBy(
                          pledges,
                          _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                        )
                        : _.sumBy(
                          contributions,
                          _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                        ),
                  },
                ],
                value:
                  valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                    ? _.sumBy(
                      pledges,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    )
                    : _.sumBy(
                      contributions,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    ),
              },
            });
          } else {
            const nonPublicDonors = _.groupBy(
              donorCountries[iso3],
              _.get(PledgesContributionsGeoFieldsMapping, datasource).nonCountryDonors,
            );
            Object.keys(nonPublicDonors).forEach((donor: string) => {
              // const donorData = nonPublicDonors[donor][0];

              const pledges = _.filter(nonPublicDonors[donor], {
                [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                  _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge,
              });
              const contributions = _.filter(nonPublicDonors[donor], {
                [_.get(PledgesContributionsGeoFieldsMapping, datasource).indicator]:
                  _.get(PledgesContributionsGeoFieldsMapping, datasource).contribution,
              });
              nonCountrySectorDonors.push({
                // code: _.get(
                //   donorData,
                //   _.get(PledgesContributionsGeoFieldsMapping, datasource).donorId,
                // ),
                name: donor,
                value:
                  valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                    ? _.sumBy(
                      pledges,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    )
                    : _.sumBy(
                      contributions,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    ),
                formattedValue: formatFinancialValue(
                  valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                    ? _.sumBy(
                      pledges,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    )
                    : _.sumBy(
                      contributions,
                      _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                    ),
                ),
                color: '#DFE3E5',
                tooltip: {
                  header: donor,
                  componentsStats: [
                    {
                      name: valueType,
                      value:
                        valueType ===
                          _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                          ? _.sumBy(
                            pledges,
                            _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                          )
                          : _.sumBy(
                            contributions,
                            _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                          ),
                    },
                  ],
                  value:
                    valueType === _.get(PledgesContributionsGeoFieldsMapping, datasource).pledge
                      ? _.sumBy(
                        pledges,
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                      )
                      : _.sumBy(
                        contributions,
                        _.get(PledgesContributionsGeoFieldsMapping, datasource).amount,
                      ),
                },
              });
            });
          }
        });

        const data = [...publicSectorCountries, ...nonCountrySectorDonors];

        return {
          count: data.length,
          data: _.orderBy(data, 'value', 'desc'),
        };
      })
      .catch(handleDataApiError);
  }
}
