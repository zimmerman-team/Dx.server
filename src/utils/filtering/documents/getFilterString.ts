import _ from 'lodash';
import filteringDocuments from '../../../config/filtering/documents.json';
import filtering from '../../../config/filtering/index.json';

export function getFilterString(params: any, datasource: any, defaultFilter?: string) {
  let str = defaultFilter ?? '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringDocuments, datasource).country}${_.get(filtering, datasource).in
      }(${locations.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringDocuments, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringDocuments, datasource).grantId}${_.get(filtering, datasource).eq
      }${grantId}`;
  }

  const multicountries = _.filter(
    _.get(params, 'multicountries', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (multicountries.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringDocuments, datasource).multicountry}${_.get(filtering, datasource).in
      }(${multicountries.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const search = _.get(params, 'q', '');
  if (search.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringDocuments, datasource).search.replace(
      /<value>/g,
      `'${search}'`,
    )}`;
  }

  if (str.length > 0) {
    str = `${_.get(filtering, datasource).filter_operator}${_.get(filtering, datasource).param_assign_operator}${str}&`;
  }

  return str;
}
