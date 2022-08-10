import {inject} from '@loopback/core';
import {get, Request, response, RestBindings} from '@loopback/rest';
import axios, {AxiosResponse} from 'axios';
import _ from 'lodash';
import {mapTransform} from 'map-transform';
import allocations from '../../config/mapping/data-themes/raw-data/allocations.json';
import budgets from '../../config/mapping/data-themes/raw-data/budgets.json';
import eligibility from '../../config/mapping/data-themes/raw-data/eligibility.json';
import generic from '../../config/mapping/data-themes/raw-data/generic.json';
import grants from '../../config/mapping/data-themes/raw-data/grants.json';
import investmentCommitted from '../../config/mapping/data-themes/raw-data/investment-committed.json';
import investmentDisbursed from '../../config/mapping/data-themes/raw-data/investment-disbursed.json';
import investmentSigned from '../../config/mapping/data-themes/raw-data/investment-signed.json';
import pledgesContributions from '../../config/mapping/data-themes/raw-data/pledges-contributions.json';
import urls from '../../config/urls/index.json';
import {formatRawData} from '../../utils/data-themes/formatRawData';
import {getDatasetFilterOptions} from '../../utils/data-themes/getDatasetFilterOptions';
import {handleDataApiError} from '../../utils/dataApiError';

export class DataThemesRawDataController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/data-themes/raw-data/investment-signed')
  @response(200)
  investmentSigned(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    return axios
      .get(`${_.get(urls, datasource).vgrantPeriods}?${_.get(investmentSigned, datasource).select}&${_.get(generic, datasource).rows}`)
      .then((res: AxiosResponse) => {
        const data = _.get(res.data, _.get(investmentSigned, datasource).dataPath, []).map(
          formatRawData,
        );
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/investment-committed')
  @response(200)
  investmentCommitted(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    return axios
      .get(
        `${_.get(urls, datasource).vcommitments}?${_.get(investmentCommitted, datasource).select}&${_.get(generic, datasource).rows}`,
      )
      .then((res: AxiosResponse) => {
        const data = _.get(res.data, _.get(investmentCommitted, datasource).dataPath, []).map(
          formatRawData,
        );
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/investment-disbursed')
  @response(200)
  investmentDisbursed(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    return axios
      .get(
        `${_.get(urls, datasource).disbursements}?${_.get(investmentDisbursed, datasource).select}&${_.get(generic, datasource).rows}`,
      )
      .then((res: AxiosResponse) => {
        const data = _.get(res.data, _.get(investmentDisbursed, datasource).dataPath, []).map(
          formatRawData,
        );
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/budgets')
  @response(200)
  budgets(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(budgets, datasource).mapping);
    return axios
      .get(`${_.get(urls, datasource).budgets}?${_.get(budgets, datasource).expand}&${_.get(generic, datasource).rows}`)
      .then((res: AxiosResponse) => {
        const data = (mapper(res.data) as never[]).map(formatRawData);
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/pledges-contributions')
  @response(200)
  pledgesContributions(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(pledgesContributions, datasource).mapping);
    return axios
      .get(
        `${_.get(urls, datasource).pledgescontributions}?${_.get(pledgesContributions, datasource).expand}&${_.get(generic, datasource).rows}`,
      )
      .then((res: AxiosResponse) => {
        const data = (mapper(res.data) as never[]).map(formatRawData);
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/allocations')
  @response(200)
  allocations(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    const mapper = mapTransform(_.get(allocations, datasource).mapping);
    return axios
      .get(`${_.get(urls, datasource).allocations}?${_.get(allocations, datasource).expand}&${_.get(generic, datasource).rows}`)
      .then((res: AxiosResponse) => {
        const data = (mapper(res.data) as never[]).map(formatRawData);
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/grants')
  @response(200)
  grants(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    return axios
      .get(`${_.get(urls, datasource).grantsNoCount}?${_.get(grants, datasource).select}&${_.get(generic, datasource).rows}`)
      .then((res: AxiosResponse) => {
        const data = _.get(res.data, _.get(grants, datasource).dataPath, []).map(formatRawData);
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }

  @get('/data-themes/raw-data/eligibility')
  @response(200)
  eligibility(): object {
    const datasource: string = this.req.body?.datasource ?? process.env.DEFAULT_DATASOURCE;
    return axios
      .get(`${_.get(urls, datasource).eligibility}?${_.get(eligibility, datasource).select}&${_.get(generic, datasource).rows}`)
      .then((res: AxiosResponse) => {
        const data = _.get(res.data, _.get(eligibility, datasource).dataPath, []).map(
          formatRawData,
        );
        const filterOptions = getDatasetFilterOptions(data);
        return {
          data,
          filterOptions,
          count: data.length,
        };
      })
      .catch(handleDataApiError);
  }
}
