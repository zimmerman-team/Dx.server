import _ from 'lodash';
import filteringGrants from '../../../config/filtering/grants.json';
import filtering from '../../../config/filtering/index.json';

export function getFilterString(params: any, datasource: string, aggregationString?: string) {
  let str = '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${_.get(filteringGrants, datasource).country}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}) OR ${_.get(filteringGrants, datasource).multicountry}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}))`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).status}${_.get(filtering, datasource).in
      }(${statuses.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).partner}${_.get(filtering, datasource).in
      }(${partners.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partnerSubTypes = _.filter(
    _.get(params, 'partnerSubTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerSubTypes.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).partner_sub_type
      }${_.get(filtering, datasource).in}(${partnerSubTypes.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partnerTypes = _.filter(
    _.get(params, 'partnerTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerTypes.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).partner_type}${_.get(filtering, datasource).in
      }(${partnerTypes.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).grantId}${_.get(filtering, datasource).eq
      }${grantId}`;
  }

  const barPeriod = _.get(params, 'barPeriod', null);
  if (barPeriod) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).barPeriod}${_.get(filtering, datasource).eq
      }${barPeriod}`;
  }

  const search = _.get(params, 'q', '');
  if (search.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrants, datasource).search.replace(
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
