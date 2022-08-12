import _ from 'lodash';
import filteringAllocations from '../../../config/filtering/allocations.json';
import filtering from '../../../config/filtering/index.json';
import {dataExplorerInQuery} from '../../../utils/dataExplorerInQuery';

export function getFilterString(
  params: any,
  datasource: any,
  aggregationString?: string,
  extraFilterString?: string,
) {
  let str = extraFilterString ?? '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${dataExplorerInQuery(datasource, _.get(filteringAllocations, datasource).country, locations, true)
      } or ${dataExplorerInQuery(datasource, _.get(filteringAllocations, datasource).multicountry, locations, true)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringAllocations, datasource).component, components, true)}`;
  }

  const periods = _.filter(
    _.get(params, 'periods', '').split(','),
    (period: string) => period.length > 0,
  ).map((period: string) => period);
  if (periods.length > 0) {
    const startPeriods = periods.map((period: string) =>
      period.split('-')[0].trim(),
    );
    const endPeriods = periods.map((period: string) =>
      period.split('-')[1].trim(),
    );
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringAllocations, datasource).periodStart, startPeriods, true)}`;
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringAllocations, datasource).periodEnd, endPeriods, true)}`;
  }

  str += `${str.length > 0 && _.get(params, 'levelParam', '').length > 0 ? ' and ' : ''
    }${_.get(params, 'levelParam', '')}`;

  if (str.length > 0) {
    str = `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}${str}&`;
    if (aggregationString) {
      str = aggregationString.replace(
        '<filterString>',
        `${str
          .replace(
            `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}`,
            'filter(',
          )
          .replace('&', ')/')}`,
      );
    }
  } else if (aggregationString) {
    str = aggregationString.replace('<filterString>', '');
  }

  return str;
}
