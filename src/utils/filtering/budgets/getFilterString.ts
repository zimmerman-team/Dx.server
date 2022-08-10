import _ from 'lodash';
import filteringBudgets from '../../../config/filtering/budgets.json';
import filtering from '../../../config/filtering/index.json';

export function getFilterString(
  params: any,
  datasource: string,
  aggregationString?: string,
  extraFilterString?: string,
) {
  let str = extraFilterString ?? '';

  const locations = _.filter(
    _.get(params, 'locations', '').split(','),
    (loc: string) => loc.length > 0,
  ).map((loc: string) => `'${loc}'`);
  if (locations.length > 0) {
    str += `(${_.get(filteringBudgets, datasource).country}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}) OR ${_.get(filteringBudgets, datasource).multicountry}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}))`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).status}${_.get(filtering, datasource).in
      }(${statuses.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).partner}${_.get(filtering, datasource).in
      }(${partners.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partnerSubTypes = _.filter(
    _.get(params, 'partnerSubTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerSubTypes.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).partner_sub_type
      }${_.get(filtering, datasource).in}(${partnerSubTypes.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const partnerTypes = _.filter(
    _.get(params, 'partnerTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerTypes.length > 0) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).partner_type}${_.get(filtering, datasource).in
      }(${partnerTypes.join(_.get(filtering, datasource).multi_param_separator)})`;
  }

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).grantId}${_.get(filtering, datasource).eq
      }${grantId}`;
  }

  const IPnumber = _.get(params, 'IPnumber', null);
  if (IPnumber) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringBudgets, datasource).IPnumber}${_.get(filtering, datasource).eq
      }${IPnumber}`;
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
