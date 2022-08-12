import _ from 'lodash';
import filtering from '../../../../config/filtering/index.json';
import filteringMulticountries from '../../../../config/filtering/multicountries.json';
import {dataExplorerInQuery} from '../../../../utils/dataExplorerInQuery';

export function getGeoMultiCountriesFilterString(
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
    str += `${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).country, locations, true)}`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).component, components, true)}`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).status, statuses, true)}`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).partner, partners, true)}`;
  }

  const partnerSubTypes = _.filter(
    _.get(params, 'partnerSubTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerSubTypes.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).partner_sub_type, partnerSubTypes, true)}`;
  }

  const partnerTypes = _.filter(
    _.get(params, 'partnerTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerTypes.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringMulticountries, datasource).partner_type, partnerTypes, true)}`;
  }

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
