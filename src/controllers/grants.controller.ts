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
import {mapTransform} from 'map-transform';
import querystring from 'querystring';
import filtering from '../config/filtering/index.json';
import {getPage} from '../config/filtering/utils';
import grantDetailMap from '../config/mapping/grants/grantDetail.json';
import grantDetailUtils from '../config/mapping/grants/grantDetail.utils.json';
import grantPeriodInfoMap from '../config/mapping/grants/grantPeriodInfo.json';
import grantPeriodsMap from '../config/mapping/grants/grantPeriods.json';
import GrantsRadialMapping from '../config/mapping/grants/grantsRadial.json';
import grantsMap from '../config/mapping/grants/index.json';
import grantsUtils from '../config/mapping/grants/utils.json';
import urls from '../config/urls/index.json';
import {
  GrantDetailInformation,
  GrantDetailPeriod,
  GrantDetailPeriodInformation
} from '../interfaces/grantDetail';
import {GrantListItemModel} from '../interfaces/grantList';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/grants/getFilterString';
import {getFilterString as getFilterStringPF} from '../utils/filtering/performancerating/getFilterString';

const GRANTS_RESPONSE: ResponseObject = {
  description: 'Grants Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'GrantsResponse',
        properties: {
          count: {type: 'integer'},
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                title: {type: 'string'},
                status: {type: 'string'},
                component: {type: 'string'},
                geoLocation: {type: 'string'},
                rating: {type: 'string'},
                disbursed: {type: 'number'},
                committed: {type: 'number'},
                signed: {type: 'number'},
              },
            },
          },
        },
      },
    },
  },
};

export class GrantsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/grants')
  @response(200, GRANTS_RESPONSE)
  grants(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(grantsMap, datasource));
    const page = (this.req.query.page ?? '1').toString();
    const pageSize = (this.req.query.pageSize ?? '10').toString();
    const orderBy = this.req.query.orderBy ?? _.get(grantsUtils, datasource).defaultOrderBy;
    const filterString = getFilterString(this.req.query, datasource);
    const params = querystring.stringify(
      {
        ...getPage(_.get(filtering, datasource).page, parseInt(page, 10), parseInt(pageSize, 10)),
        [_.get(filtering, datasource).page_size]: pageSize,
      },
      '&',
      _.get(filtering, datasource).param_assign_operator,
      {
        encodeURIComponent: (str: string) => str,
      },
    );
    const url = `${_.get(urls, datasource).grants}${filterString}${_.get(filtering, datasource).orderby}${_.get(filtering, datasource).param_assign_operator
      }${orderBy}${parseInt(pageSize, 10) > 0 ? `&${params}` : ''}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const res: GrantListItemModel[] = mapper(resp.data) as never[];
        return {
          count: resp.data[_.get(grantsUtils, datasource).countPath],
          data: res,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/detail')
  @response(200, GRANTS_RESPONSE)
  grantDetail(): object {
    const grantNumber = _.get(this.req.query, 'grantNumber', null);
    if (!grantNumber) {
      return {
        data: {},
        message: '"grantNumber" parameter is required.',
      };
    }
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(grantDetailMap, datasource));
    const url = `${_.get(urls, datasource).grantsNoCount}?$top=1&$filter=${_.get(grantDetailUtils, datasource).grantNumber} eq '${grantNumber}'`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const res: GrantDetailInformation[] = mapper(resp.data) as never[];
        return {
          data: res,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/periods')
  @response(200, GRANTS_RESPONSE)
  grantDetailPeriods(): object {
    const grantNumber = _.get(this.req.query, 'grantNumber', null);
    if (!grantNumber) {
      return {
        data: {},
        message: '"grantNumber" parameter is required.',
      };
    }
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(grantPeriodsMap, datasource));
    const url = `${_.get(urls, datasource).grantPeriods}?${_.get(grantDetailUtils, datasource).defaultSelectFields}${_.get(grantDetailUtils, datasource).defaultSort}$filter=${_.get(grantDetailUtils, datasource).periodGrantNumber} eq '${grantNumber}'`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const res: GrantDetailPeriod[] = mapper(resp.data) as never[];
        return {
          data: res.map((period: GrantDetailPeriod) => ({
            ...period,
            startDate: period.startDate.split('T')[0],
            endDate: period.endDate.split('T')[0],
          })),
        };
      })
      .catch(handleDataApiError);
  }

  @get('/grant/period/info')
  @response(200, GRANTS_RESPONSE)
  grantDetailPeriodInfo(): object {
    const grantNumber = _.get(this.req.query, 'grantNumber', null);
    const IPnumber = _.get(this.req.query, 'IPnumber', null);
    if (!grantNumber && !IPnumber) {
      return {
        data: [],
        message: '"grantId" and "IPnumber" parameters is required.',
      };
    }
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(grantPeriodInfoMap, datasource));
    const financialUrl = `${_.get(urls, datasource).grantPeriods}?${_.get(grantDetailUtils, datasource).periodInfoSelectFields}$filter=${_.get(grantDetailUtils, datasource).periodGrantNumber} eq '${grantNumber}' and ${_.get(grantDetailUtils, datasource).periodNumber} eq ${IPnumber}`;
    const ratingUrl = `${_.get(urls, datasource).performancerating}?${_.get(grantDetailUtils, datasource).periodInfoRatingSelectFields}${_.get(grantDetailUtils, datasource).periodInfoRatingPageSize}${_.get(grantDetailUtils, datasource).periodInfoRatingExpand}${_.get(grantDetailUtils, datasource).periodInfoRatingSort}$filter=${_.get(grantDetailUtils, datasource).periodInfoRatingGrantNumber} eq '${grantNumber}' and ${_.get(grantDetailUtils, datasource).periodInfoRatingPeriodNumber} eq ${IPnumber}${_.get(grantDetailUtils, datasource).periodInfoRatingExtraFilter}`;

    return axios
      .all([axios.get(financialUrl), axios.get(ratingUrl)])
      .then(
        axios.spread((...responses) => {
          const respData = [
            {
              ..._.get(
                responses[0].data,
                _.get(grantDetailUtils, datasource).periodInfoDataPath,
                {},
              ),
              ..._.get(
                responses[1].data,
                _.get(grantDetailUtils, datasource).periodInfoDataPath,
                {},
              ),
            },
          ];
          const res: GrantDetailPeriodInformation[] = mapper(
            respData,
          ) as never[];
          return {
            data: res,
          };
        }),
      )
      .catch(handleDataApiError);
  }

  @get('/grants/radial')
  @response(200, GRANTS_RESPONSE)
  grantsRadial(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const filterString = getFilterString(this.req.query, datasource);
    const filterStringPF = getFilterStringPF(this.req.query, datasource);
    const grantsUrl = `${_.get(urls, datasource).grantsNoCount}?${filterString}${_.get(GrantsRadialMapping, datasource).grantAgreementsSelect}`;
    const periodsUrl = `${_.get(urls, datasource).vgrantPeriods}?${filterString}${_.get(GrantsRadialMapping, datasource).implementationPeriodsSelect}`;
    const ipRatingUrl = `${_.get(urls, datasource).performancerating}?${filterStringPF}${_.get(GrantsRadialMapping, datasource).ipRatingDefaultExpand}${_.get(GrantsRadialMapping, datasource).ipRatingDefaultOrderBy}`;

    return axios
      .all([
        axios.get(periodsUrl),
        axios.get(grantsUrl),
        axios.get(ipRatingUrl),
      ])
      .then(
        axios.spread((...responses) => {
          const periodsData = _.get(
            responses[0].data,
            _.get(GrantsRadialMapping, datasource).dataPath,
            [],
          );
          const grantsData = _.get(
            responses[1].data,
            _.get(GrantsRadialMapping, datasource).dataPath,
            [],
          );
          const ipRatingData = _.get(
            responses[2].data,
            _.get(GrantsRadialMapping, datasource).dataPath,
            [],
          );
          const groupedGrants = _.groupBy(
            periodsData,
            _.get(GrantsRadialMapping, datasource).name,
          );
          const results: any[] = [];
          Object.keys(groupedGrants).forEach(grant => {
            const items = groupedGrants[grant];
            const fGrant = _.find(grantsData, {
              grantAgreementNumber: grant,
            });
            results.push({
              title: _.get(fGrant, _.get(GrantsRadialMapping, datasource).title, ''),
              name: _.get(items[0], _.get(GrantsRadialMapping, datasource).name, ''),
              years: [
                parseInt(
                  _.get(items[0], _.get(GrantsRadialMapping, datasource).start, '').slice(0, 4),
                  10,
                ),
                parseInt(
                  _.get(items[0], _.get(GrantsRadialMapping, datasource).end, '').slice(0, 4),
                  10,
                ),
              ],
              value: _.sumBy(items, _.get(GrantsRadialMapping, datasource).value),
              component: _.get(items[0], _.get(GrantsRadialMapping, datasource).component, ''),
              status: _.get(items[0], _.get(GrantsRadialMapping, datasource).status, ''),
              rating: _.get(fGrant, _.get(GrantsRadialMapping, datasource).rating, 'None'),
              implementationPeriods: _.sortBy(
                items.map(item => {
                  const fRatingData = _.find(
                    ipRatingData,
                    (ipRatingDataItem: any) => {
                      return (
                        _.get(
                          ipRatingDataItem,
                          _.get(GrantsRadialMapping, datasource).ipRatingGrantNumber,
                          null,
                        ) === _.get(items[0], _.get(GrantsRadialMapping, datasource).name, '') &&
                        _.get(
                          ipRatingDataItem,
                          _.get(GrantsRadialMapping, datasource).ipRatingPeriodNumber,
                          null,
                        ) === _.get(item, _.get(GrantsRadialMapping, datasource).ipNumber, '') &&
                        _.get(
                          ipRatingDataItem,
                          _.get(GrantsRadialMapping, datasource).ipRatingValue,
                          null,
                        ) !== null
                      );
                    },
                  );
                  return {
                    name: _.get(item, _.get(GrantsRadialMapping, datasource).ipNumber, ''),
                    years: [
                      parseInt(
                        _.get(item, _.get(GrantsRadialMapping, datasource).ipStart, '').slice(
                          0,
                          4,
                        ),
                        10,
                      ),
                      parseInt(
                        _.get(item, _.get(GrantsRadialMapping, datasource).ipEnd, '').slice(0, 4),
                        10,
                      ),
                    ],
                    value: _.get(item, _.get(GrantsRadialMapping, datasource).value, ''),
                    status: _.get(item, _.get(GrantsRadialMapping, datasource).ipStatus, ''),
                    rating: _.get(
                      fRatingData,
                      _.get(GrantsRadialMapping, datasource).ipRatingValue,
                      'None',
                    ),
                  };
                }),
                'name',
              ),
            });
          });
          return {
            data: results,
          };
        }),
      )
      .catch(handleDataApiError);
  }
}
