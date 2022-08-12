import _ from 'lodash';
import filtering from '../../../config/filtering/index.json';
import filteringPF from '../../../config/filtering/performancerating.json';
import {dataExplorerInQuery} from '../../../utils/dataExplorerInQuery';

export function getFilterString(params: any, datasource: any) {
  let str = '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${dataExplorerInQuery(datasource, _.get(filteringPF, datasource).country, locations, true)
      } or ${dataExplorerInQuery(datasource, _.get(filteringPF, datasource).multicountry, locations, true)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPF, datasource).component, components, true)}`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPF, datasource).status, statuses, true)}`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringPF, datasource).partner, partners, true)}`;
  }

  if (str.length > 0) {
    str = `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}${str}&`;
  }

  return str;
}
