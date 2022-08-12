import _ from 'lodash';
import filteringPledgesContributions from '../../../config/filtering/pledgescontributions.json';
import PledgesContributionsTimeCycleFieldsMapping from '../../../config/mapping/pledgescontributions/timeCycle.json';
import {dataExplorerInQuery} from '../../../utils/dataExplorerInQuery';

export function getFilterString(params: any, datasource: any, aggregationString?: string) {
  let str = '';

  const donors = _.filter(
    _.get(params, 'donors', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((donor: string) => `'${donor}'`);
  if (donors.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPledgesContributions, datasource).donors, donors, true)}`;
  } else {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPledgesContributions, datasource).donors, _.get(PledgesContributionsTimeCycleFieldsMapping, datasource).defaultDonorFilter)}`;
  }

  const donorCategories = _.filter(
    _.get(params, 'donorCategories', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((donorCat: string) => `'${donorCat}'`);
  if (donorCategories.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPledgesContributions, datasource).donorCategory, donorCategories, true)}`;
  }

  const periods = _.filter(
    _.get(params, 'periods', '').split(','),
    (period: string) => period.length > 0,
  ).map((period: string) => `'${period}'`);
  if (periods.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPledgesContributions, datasource).period, periods, true)}`;
  }

  if (_.get(params, 'levelParam', '').length > 0) {
    const lParam = _.get(params, 'levelParam', '').split('-');
    if (lParam.length === 1 || lParam.length > 2) {
      str += `${str.length > 0 ? ' and ' : ''}${_.get(
        lParam,
        '[0]',
        '',
      )}-${_.get(lParam, '[1]', '')}`;
    }
  }

  if (str.length > 0) {
    if (aggregationString) {
      str = aggregationString.replace('<filterString>', ` and ${str}`);
    }
  } else if (aggregationString) {
    str = aggregationString.replace('<filterString>', '');
  }

  return str;
}
