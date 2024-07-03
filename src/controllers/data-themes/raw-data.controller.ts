import {inject} from '@loopback/core';
import {get, param, Request, response, RestBindings} from '@loopback/rest';
import axios from 'axios';
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
import {getRawData} from '../../utils/data-themes/getRawData';
import {getRawDataWithMapper} from '../../utils/data-themes/getRawDataWithMapper';

export class DataThemesRawDataController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/data-themes/sample-data/{datasetId}')
  @response(200)
  async sampleData(@param.path.string('datasetId') datasetId: string) {
    let host = process.env.SSR_SUBDOMAIN ? 'dx-ssr' : 'localhost';
    if (process.env.ENV_TYPE !== "prod") host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;
    return axios
      .get(`http://${host}:4004/sample-data/${datasetId}`)
      .then(res => {
        return res.data.result;
      })
      .catch(e => {
        console.log(e);
        return {
          data: [],
          error: e.response.data.result,
        };
      });
  }

  @get('/data-themes/raw-data/investment-signed')
  @response(200)
  investmentSigned(@param.query.string('rows') rows: string): object {
    return getRawData(
      `${urls.vgrantPeriods}/?${investmentSigned.select}`,
      rows,
      investmentSigned,
    );
  }

  @get('/data-themes/raw-data/investment-committed')
  @response(200)
  investmentCommitted(@param.query.string('rows') rows: string): object {
    return getRawData(
      `${urls.vcommitments}/?${investmentCommitted.select}`,
      rows,
      investmentCommitted,
    );
  }

  @get('/data-themes/raw-data/investment-disbursed')
  @response(200)
  investmentDisbursed(@param.query.string('rows') rows: string): object {
    return getRawData(
      `${urls.disbursements}/?${investmentDisbursed.select}`,
      rows,
      investmentDisbursed,
    );
  }

  @get('/data-themes/raw-data/budgets')
  @response(200)
  budgets(@param.query.string('rows') rows: string): object {
    return getRawDataWithMapper(
      `${urls.budgets}/?${budgets.expand}`,
      rows,
      budgets,
    );
  }

  @get('/data-themes/raw-data/pledges-contributions')
  @response(200)
  pledgesContributions(@param.query.string('rows') rows: string): object {
    return getRawDataWithMapper(
      `${urls.pledgescontributions}/?${pledgesContributions.expand}`,
      rows,
      pledgesContributions,
    );
  }

  @get('/data-themes/raw-data/allocations')
  @response(200)
  allocations(@param.query.string('rows') rows: string): object {
    return getRawDataWithMapper(
      `${urls.allocations}/?${allocations.expand}`,
      rows,
      allocations,
    );
  }

  @get('/data-themes/raw-data/grants')
  @response(200)
  grants(@param.query.string('rows') rows: string): object {
    return getRawData(`${urls.grantsNoCount}/?${grants.select}`, rows, grants);
  }

  @get('/data-themes/raw-data/eligibility')
  @response(200)
  eligibility(@param.query.string('rows') rows: string): object {
    return getRawData(
      `${urls.eligibility}/?${eligibility.select}`,
      rows,
      eligibility,
    );
  }

  @get('/data-themes/raw-data/{datasetId}')
  @response(200)
  datasets(@param.query.string('rows') rows: string, @param.path.string('datasetId') id: string): object {
    return getRawData(
      process.env.ALTERNATIVE_DATASOURCE_BASE + id,
      rows,
      generic,
      false // disables data limiter
    );
  }
}
