import _ from 'lodash';
import filtering from '../../../config/filtering/index.json';
import filteringPF from '../../../config/filtering/performancerating.json';

export function getFilterString(params: any, datasource: string) {
  let str = '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${_.get(filteringPF, datasource).country}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}) OR ${_.get(filteringPF, datasource).multicountry}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}))`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringPF, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringPF, datasource).status}${_.get(filtering, datasource).in
      }(${statuses.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringPF, datasource).partner}${_.get(filtering, datasource).in
      }(${partners.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  if (str.length > 0) {
    str = `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}${str}&`;
  }

  return str;
}
