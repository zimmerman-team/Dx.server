import _ from 'lodash';
import filtering from '../../../config/filtering/index.json';
import filteringResults from '../../../config/filtering/results.json';

export function getFilterString(params: any, datasource: any, defaultFilter?: string) {
  let str = defaultFilter ?? '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).country}${_.get(filtering, datasource).in
      }(${locations.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const periods = _.filter(
    _.get(params, 'periods', '').split(','),
    (period: string) => period.length > 0,
  ).map((period: string) => period);
  if (periods.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).period}${_.get(filtering, datasource).in
      }(${periods.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const search = _.get(params, 'q', '');
  if (search.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).search.replace(
      '<value>',
      `'${search}'`,
    )}`;
  }

  if (str.length > 0) {
    if (!defaultFilter) {
      str = `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}${str}&`;
    }
  }

  return str;
}

export function getFilterStringForStats(
  params: any,
  datasource: any,
  aggregationString?: string,
) {
  let str = '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).country}${_.get(filtering, datasource).in
      }(${locations.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const periods = _.filter(
    _.get(params, 'periods', '').split(','),
    (period: string) => period.length > 0,
  ).map((period: string) => period);
  if (periods.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringResults, datasource).period}${_.get(filtering, datasource).in
      }(${periods.join(_.get(filtering, datasource).multi_param_separator)})`;
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
