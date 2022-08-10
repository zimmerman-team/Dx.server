import {inject} from '@loopback/core';
import {
  get,
  Request,
  response,
  ResponseObject,
  RestBindings
} from '@loopback/rest';
import axios from 'axios';
import _ from 'lodash';
import filtering from '../config/filtering/index.json';
import locationMappingFields from '../config/mapping/location/index.json';
import urls from '../config/urls/index.json';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/grants/getFilterString';

const LOCATION_INFO_RESPONSE: ResponseObject = {
  description: 'Location Information Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'LocationInfoResponse',
        properties: {},
      },
    },
  },
};

export class LocationController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/location/detail')
  @response(200, LOCATION_INFO_RESPONSE)
  locationDetail(): object {
    const locations = _.get(this.req.query, 'locations', '') as string;
    if (locations.length === 0) {
      return {
        data: {},
        message: '"locations" parameter is required.',
      };
    }
    const location = locations.split(',')[0];
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const multicountriesUrl = `${_.get(urls, datasource).multicountries}?${_.get(locationMappingFields, datasource)[
      location.length > 3
        ? 'countriesFilterString'
        : 'multiCountriesFilterString'
    ].replace('<location>', location as string)}`;
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(locationMappingFields, datasource).locationFinancialAggregation,
    );
    const financialUrl = `${_.get(urls, datasource).grantsNoCount}?${filterString}`;
    const indicatorsUrl = `${_.get(urls, datasource).indicators}?${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator
      }${_.get(locationMappingFields, datasource).locationIndicatorsDefaultFilter} ${_.get(filtering, datasource).and_operator
      } ${_.get(locationMappingFields, datasource).locationIndicatorsLocationFilter.replace(
        '<location>',
        location as string,
      )}&${_.get(filtering, datasource).orderby}${_.get(filtering, datasource).param_assign_operator}${_.get(locationMappingFields, datasource).locationIndicatorsDefaultOrder
      }&${_.get(filtering, datasource).page_size}${_.get(filtering, datasource).param_assign_operator}${_.get(locationMappingFields, datasource).locationIndicatorsDefaultCap
      }`;
    const principalRecipientsFilterString = getFilterString(
      this.req.query,
      datasource,
      _.get(locationMappingFields, datasource).principalRecipientAggregation,
    );
    const principalRecipientsUrl = `${_.get(urls, datasource).grantsNoCount}?${principalRecipientsFilterString}`;

    return axios
      .all([
        axios.get(multicountriesUrl),
        axios.get(financialUrl),
        axios.get(indicatorsUrl),
        axios.get(principalRecipientsUrl),
      ])
      .then(
        axios.spread((...responses) => {
          const multicountriesResp = _.get(
            responses[0].data,
            _.get(locationMappingFields, datasource).multiCountriesDataPath,
            [],
          );
          const countriesResp = _.get(
            responses[0].data,
            _.get(locationMappingFields, datasource).countriesDataPath,
            [],
          );
          const locationFinancialResp = _.get(
            responses[1].data,
            _.get(locationMappingFields, datasource).locationFinancialDataPath,
            {
              locationName: '',
              multiCountryName: '',
              disbursed: 0,
              committed: 0,
              signed: 0,
              portfolioManager: '',
              portfolioManagerEmail: '',
              geoId: '',
              multiCountryId: '',
            },
          );
          const locationIndicatorsResp = _.get(
            responses[2].data,
            _.get(locationMappingFields, datasource).locationIndicatorsDataPath,
            [],
          );
          const principalRecipientsResp = _.get(
            responses[3].data,
            _.get(locationMappingFields, datasource).multiCountriesDataPath,
            [],
          );

          return {
            data: [
              {
                id: _.get(
                  locationFinancialResp,
                  location.length > 3
                    ? _.get(locationMappingFields, datasource).multiCountryId
                    : _.get(locationMappingFields, datasource).geoId,
                  '',
                ),
                locationName: _.get(
                  locationFinancialResp,
                  location.length > 3
                    ? _.get(locationMappingFields, datasource).multiCountryName
                    : _.get(locationMappingFields, datasource).locationName,
                  '',
                ),
                disbursed: _.get(
                  locationFinancialResp,
                  _.get(locationMappingFields, datasource).disbursed,
                  0,
                ),
                committed: _.get(
                  locationFinancialResp,
                  _.get(locationMappingFields, datasource).committed,
                  0,
                ),
                signed: _.get(
                  locationFinancialResp,
                  _.get(locationMappingFields, datasource).signed,
                  0,
                ),
                portfolioManager: _.get(
                  locationFinancialResp,
                  _.get(locationMappingFields, datasource).portfolioManager,
                  '',
                ),
                portfolioManagerEmail: _.get(
                  locationFinancialResp,
                  _.get(locationMappingFields, datasource).portfolioManagerEmail,
                  '',
                ),
                multicountries:
                  location.length > 3
                    ? []
                    : _.orderBy(
                      multicountriesResp.map((mc: any) => ({
                        name: _.get(
                          mc,
                          _.get(locationMappingFields, datasource).multiCountryName,
                          '',
                        ),
                        code: _.get(
                          mc,
                          _.get(locationMappingFields, datasource).multiCountryName,
                          '',
                        ).replace(/\//g, '|'),
                      })),
                      'name',
                      'asc',
                    ),
                countries:
                  location.length > 3
                    ? _.orderBy(
                      countriesResp.map((loc: any) => ({
                        name: _.get(
                          loc,
                          _.get(locationMappingFields, datasource).countryName,
                          '',
                        ),
                        code: _.get(
                          loc,
                          _.get(locationMappingFields, datasource).countryCode,
                          '',
                        ),
                      })),
                      'name',
                      'asc',
                    )
                    : [],
                indicators: locationIndicatorsResp.map((indicator: any) => ({
                  name: _.get(
                    indicator,
                    _.get(locationMappingFields, datasource).locationIndicatorName,
                    '',
                  ),
                  year: _.get(
                    indicator,
                    _.get(locationMappingFields, datasource).locationIndicatorYear,
                    '',
                  ),
                  value: _.get(
                    indicator,
                    _.get(locationMappingFields, datasource).locationIndicatorValue,
                    '',
                  ),
                })),
                principalRecipients: principalRecipientsResp.map((pr: any) => {
                  const fullName = _.get(
                    pr,
                    _.get(locationMappingFields, datasource).principalRecipientName,
                    '',
                  );
                  const shortName = _.get(
                    pr,
                    _.get(locationMappingFields, datasource).principalRecipientShortName,
                    '',
                  );
                  const id = _.get(
                    pr,
                    _.get(locationMappingFields, datasource).principalRecipientId,
                    '',
                  );

                  return {
                    code: id,
                    name: `${fullName}${shortName ? ` (${shortName})` : ''}`,
                  };
                }),
              },
            ],
          };
        }),
      )
      .catch(handleDataApiError);
  }
}
