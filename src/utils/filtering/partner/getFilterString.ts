import _ from 'lodash';
import filteringGrants from '../../../config/filtering/grants.json';
import filtering from '../../../config/filtering/index.json';
import {dataExplorerInQuery} from '../../../utils/dataExplorerInQuery';

export function getFilterString(params: any, datasource: any, aggregationString?: string) {
  let str = '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).country, locations, true)
      } or ${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).multicountry, locations, true)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).component, components, true)}`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).status, statuses, true)}`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).partner, partners, true)}`;
  }

  const partnerSubTypes = _.filter(
    _.get(params, 'partnerSubTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerSubTypes.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).partner_sub_type, partnerSubTypes, true)}`;
  }

  const partnerTypes = _.filter(
    _.get(params, 'partnerTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerTypes.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringGrants, datasource).partner_type, partnerTypes, true)}`;
  }

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringGrants, datasource).grantId}${_.get(filtering, datasource).eq
      }${grantId}`;
  }

  const barPeriod = _.get(params, 'barPeriod', null);
  if (barPeriod) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringGrants, datasource).barPeriod}${_.get(filtering, datasource).eq
      }${barPeriod}`;
  }

  const search = _.get(params, 'q', '');
  if (search.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringGrants, datasource).search.replace(
      '<value>',
      `'${search}'`,
    )}`;
  }

  if (str.length > 0) {
    if (aggregationString) {
      str = aggregationString.replace('<filterString>', str);
    }
  } else if (aggregationString) {
    str = aggregationString.replace('<filterString>', '');
  }

  return str;
}
