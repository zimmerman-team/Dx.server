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
import partnerMappingFields from '../config/mapping/partner/index.json';
import urls from '../config/urls/index.json';
import {handleDataApiError} from '../utils/dataApiError';
import {getFilterString} from '../utils/filtering/partner/getFilterString';

const PARTNER_INFO_RESPONSE: ResponseObject = {
  description: 'Partner Information Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'PartnerInfoResponse',
        properties: {},
      },
    },
  },
};

export class PartnerController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/partner/detail')
  @response(200, PARTNER_INFO_RESPONSE)
  partnerDetail(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const partners = _.get(this.req.query, 'partners', '') as string;
    if (partners.length === 0) {
      return {
        data: {},
        message: '"partners" parameter is required.',
      };
    }
    const filterString = getFilterString(
      this.req.query,
      datasource,
      _.get(partnerMappingFields, datasource).url,
    );
    const url = `${_.get(urls, datasource).grantsNoCount}?${filterString}`;

    return axios
      .get(url)
      .then((resp: AxiosResponse) => {
        const rawData = _.get(resp.data, _.get(partnerMappingFields, datasource).dataPath, []);
        let partnerName = '';
        if (_.get(rawData, _.get(partnerMappingFields, datasource).partnerShortName, '')) {
          partnerName = _.get(
            rawData,
            _.get(partnerMappingFields, datasource).partnerShortName,
            '',
          );
        }
        if (_.get(rawData, _.get(partnerMappingFields, datasource).partnerLongName, '')) {
          partnerName += `${partnerName ? ' | ' : ''}${_.get(
            rawData,
            _.get(partnerMappingFields, datasource).partnerLongName,
            '',
          )}`;
        }
        return {
          data: {
            partnerName,
          },
        };
      })
      .catch(handleDataApiError);
  }
}
