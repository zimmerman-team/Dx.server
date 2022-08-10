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
import mappingComponents from '../config/mapping/filteroptions/components.json';
import mappingDonors from '../config/mapping/filteroptions/donors.json';
import mappingLocations from '../config/mapping/filteroptions/locations.json';
import mappingMulticountries from '../config/mapping/filteroptions/multicountries.json';
import mappingPartnertypes from '../config/mapping/filteroptions/partnertypes.json';
import mappingReplenishmentperiods from '../config/mapping/filteroptions/replenishmentperiods.json';
import mappingStatus from '../config/mapping/filteroptions/status.json';
import urls from '../config/urls/index.json';
import {FilterGroupOption} from '../interfaces/filters';
import {handleDataApiError} from '../utils/dataApiError';

const FILTER_OPTIONS_RESPONSE: ResponseObject = {
  description: 'Filter Options Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'FilterOptionsResponse',
        properties: {
          count: {type: 'integer'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: {type: 'string'},
                value: {type: 'string'},
                subOptions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: {type: 'string'},
                      value: {type: 'string'},
                      subOptions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: {type: 'string'},
                            value: {type: 'string'},
                            subOptions: {
                              type: 'array',
                              items: {},
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
    },
  },
};

export class FilteroptionsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/filter-options/locations')
  @response(200, FILTER_OPTIONS_RESPONSE)
  locations(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionslocations;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(mappingLocations, datasource).dataPath, []);
        const data: FilterGroupOption[] = [];

        rawData.forEach((item1: any) => {
          const subOptions = _.get(item1, _.get(mappingLocations, datasource).children, []);
          data.push({
            label: _.get(item1, _.get(mappingLocations, datasource).label, ''),
            value: _.get(item1, _.get(mappingLocations, datasource).value, ''),
            subOptions:
              subOptions && subOptions.length > 0
                ? _.orderBy(
                  subOptions.map((item2: any) => {
                    const item2SubOptions = _.get(
                      item2,
                      _.get(mappingLocations, datasource).children,
                      [],
                    );
                    return {
                      label: _.get(item2, _.get(mappingLocations, datasource).label, ''),
                      value: _.get(item2, _.get(mappingLocations, datasource).value, ''),
                      subOptions:
                        item2SubOptions && item2SubOptions.length > 0
                          ? _.orderBy(
                            item2SubOptions.map((item3: any) => {
                              const item3SubOptions = _.get(
                                item3,
                                _.get(mappingLocations, datasource).children,
                                [],
                              );
                              return {
                                label: _.get(
                                  item3,
                                  _.get(mappingLocations, datasource).label,
                                  '',
                                ),
                                value: _.get(
                                  item3,
                                  _.get(mappingLocations, datasource).value,
                                  '',
                                ),
                                subOptions:
                                  item3SubOptions &&
                                    item3SubOptions.length > 0
                                    ? _.orderBy(
                                      item3SubOptions.map(
                                        (item4: any) => {
                                          return {
                                            label: _.get(
                                              item4,
                                              _.get(mappingLocations, datasource).label,
                                              '',
                                            ),
                                            value: _.get(
                                              item4,
                                              _.get(mappingLocations, datasource).value,
                                              '',
                                            ),
                                          };
                                        },
                                      ),
                                      'label',
                                      'asc',
                                    )
                                    : undefined,
                              };
                            }),
                            'label',
                            'asc',
                          )
                          : undefined,
                    };
                  }),
                  'label',
                  'asc',
                )
                : undefined,
          });
        });

        if (_.get(urls, datasource).filteroptionsmulticountries) {
          return axios
            .get(_.get(urls, datasource).filteroptionsmulticountries)
            .then((resp2: AxiosResponse) => {
              const mcRawData = _.get(
                resp2.data,
                _.get(mappingMulticountries, datasource).dataPath,
                [],
              );

              mcRawData.forEach((item: any) => {
                data.forEach((region: FilterGroupOption) => {
                  const fRegion = _.find(region.subOptions, {
                    value: _.get(item, _.get(mappingMulticountries, datasource).regionCode),
                  });
                  if (fRegion) {
                    region.subOptions?.push({
                      label: _.get(item, _.get(mappingMulticountries, datasource).label, ''),
                      value: _.get(item, _.get(mappingMulticountries, datasource).value, ''),
                    });
                  } else {
                    region.subOptions?.forEach(
                      (subRegion: FilterGroupOption) => {
                        const fSubRegion = _.find(subRegion.subOptions, {
                          value: _.get(item, _.get(mappingMulticountries, datasource).regionCode),
                        });
                        if (fSubRegion) {
                          subRegion.subOptions?.push({
                            label: _.get(item, _.get(mappingMulticountries, datasource).label, ''),
                            value: _.get(item, _.get(mappingMulticountries, datasource).value, ''),
                          });
                        }
                      },
                    );
                  }
                });
              });

              return {
                name: 'Locations',
                options: _.orderBy(data, 'label', 'asc'),
              };
            })
            .catch(handleDataApiError);
        } else {
          return {
            name: 'Locations',
            options: _.orderBy(data, 'label', 'asc'),
          };
        }
      })
      .catch(handleDataApiError);
  }

  @get('/filter-options/components')
  @response(200, FILTER_OPTIONS_RESPONSE)
  components(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionscomponents;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(mappingComponents, datasource).dataPath, []);

        return {
          name: 'Components',
          options: rawData.map((item: any) => ({
            label: _.get(item, _.get(mappingComponents, datasource).label, ''),
            value: _.get(item, _.get(mappingComponents, datasource).value, ''),
          })),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/filter-options/partner-types')
  @response(200, FILTER_OPTIONS_RESPONSE)
  partnerTypes(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionspartnertypes;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(mappingPartnertypes, datasource).dataPath, []);

        const groupedByPartnerType = _.groupBy(
          rawData,
          _.get(mappingPartnertypes, datasource).partnerType,
        );

        const options: FilterGroupOption[] = [];

        Object.keys(groupedByPartnerType).forEach((partnerType: string) => {
          const groupedBySubPartnerType = _.groupBy(
            groupedByPartnerType[partnerType],
            _.get(mappingPartnertypes, datasource).partnerSubType,
          );
          const subOptions: FilterGroupOption[] = [];
          Object.keys(groupedBySubPartnerType).forEach(
            (subPartnerType: string) => {
              subOptions.push({
                label:
                  subPartnerType && subPartnerType !== 'null'
                    ? subPartnerType
                    : 'Not Classified',
                value: _.get(
                  groupedBySubPartnerType[subPartnerType][0],
                  _.get(mappingPartnertypes, datasource).partnerSubTypeId,
                  '',
                ),
                subOptions: _.orderBy(
                  groupedBySubPartnerType[subPartnerType].map(
                    (partner: any) => ({
                      label: _.get(partner, _.get(mappingPartnertypes, datasource).partner, ''),
                      value: _.get(partner, _.get(mappingPartnertypes, datasource).partnerId, ''),
                    }),
                  ),
                  'label',
                  'asc',
                ),
              });
            },
          );
          options.push({
            label:
              partnerType && partnerType !== 'null'
                ? partnerType
                : 'Not Classified',
            value: _.get(
              groupedByPartnerType[partnerType][0],
              _.get(mappingPartnertypes, datasource).partnerTypeId,
              '',
            ),
            subOptions: _.orderBy(subOptions, 'label', 'asc'),
          });
        });

        return {
          name: 'Partner types',
          options: _.orderBy(options, 'label', 'asc'),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/filter-options/status')
  @response(200, FILTER_OPTIONS_RESPONSE)
  status(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionsstatus;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(mappingStatus, datasource).dataPath, []);

        return {
          name: 'Grant status',
          options: _.orderBy(
            rawData.map((item: any) => ({
              label: _.get(item, _.get(mappingStatus, datasource).label, ''),
              value: _.get(item, _.get(mappingStatus, datasource).value, ''),
            })),
            'label',
            'asc',
          ),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/filter-options/replenishment-periods')
  @response(200, FILTER_OPTIONS_RESPONSE)
  replenishmentPeriods(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionsreplenishmentperiods;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(
          resp.data,
          _.get(mappingReplenishmentperiods, datasource).dataPath,
          [],
        );

        return {
          name: 'Replenishment periods',
          options: _.orderBy(
            rawData.map((item: any) => ({
              label: _.get(item, _.get(mappingReplenishmentperiods, datasource).label, ''),
              value: _.get(item, _.get(mappingReplenishmentperiods, datasource).value, ''),
            })),
            'label',
            'asc',
          ),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/filter-options/donors')
  @response(200, FILTER_OPTIONS_RESPONSE)
  donors(): object {
    const keyword = (this.req.query.q ?? '').toString().trim();
    const keywords = keyword.split(' ');
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const url = _.get(urls, datasource).filteroptionsdonors;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(mappingDonors, datasource).dataPath, []);
        const options: FilterGroupOption[] = [];

        rawData.forEach((item: any) => {
          const type: FilterGroupOption = {
            label: _.get(item, _.get(mappingDonors, datasource).label, ''),
            value: _.get(item, _.get(mappingDonors, datasource).value, ''),
            subOptions: [],
          };

          _.get(item, _.get(mappingDonors, datasource).children, []).forEach((child: any) => {
            if (_.get(child, _.get(mappingDonors, datasource).children, []).length > 0) {
              _.get(child, _.get(mappingDonors, datasource).children, []).forEach(
                (gchild: any) => {
                  type.subOptions?.push({
                    label: _.get(gchild, _.get(mappingDonors, datasource).label, ''),
                    value: _.get(gchild, _.get(mappingDonors, datasource).value, ''),
                  });
                },
              );
            } else {
              type.subOptions?.push({
                label: _.get(child, _.get(mappingDonors, datasource).label, ''),
                value: _.get(child, _.get(mappingDonors, datasource).value, ''),
              });
            }
          });

          type.subOptions = _.orderBy(type.subOptions, 'label', 'asc');

          if (keyword.length > 0) {
            type.subOptions = _.filter(type.subOptions, (option: any) => {
              let allKeywordsFound = true;
              keywords.forEach((key: string) => {
                if (
                  option.label.toLowerCase().indexOf(key.toLowerCase()) === -1
                ) {
                  allKeywordsFound = false;
                }
              });
              return allKeywordsFound;
            }) as FilterGroupOption[];
          }

          options.push(type);
        });

        return {
          name: 'Donors',
          options: _.orderBy(options, 'label', 'asc'),
        };
      })
      .catch(handleDataApiError);
  }
}
