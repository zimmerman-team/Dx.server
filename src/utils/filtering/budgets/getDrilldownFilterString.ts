import _ from 'lodash';
import filteringBudgets from '../../../config/filtering/budgets.json';
import filtering from '../../../config/filtering/index.json';
import {dataExplorerInQuery} from '../../../utils/dataExplorerInQuery';

export function getDrilldownFilterString(
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
    str += `(${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).country, locations, true)
      } or $${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).multicountry, locations, true)})`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).component, components, true)}`;
  }

  const statuses = _.filter(
    _.get(params, 'status', '').split(','),
    (stat: string) => stat.length > 0,
  ).map((stat: string) => `'${stat}'`);
  if (statuses.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).status, statuses, true)}`;
  }

  const partners = _.filter(
    _.get(params, 'partners', '').split(','),
    (partner: string) => partner.length > 0,
  ).map((partner: string) => `'${partner}'`);
  if (partners.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).partner, partners, true)}`;
  }

  const partnerTypes = _.filter(
    _.get(params, 'partnerTypes', '').split(','),
    (type: string) => type.length > 0,
  ).map((type: string) => `'${type}'`);
  if (partnerTypes.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${dataExplorerInQuery(datasource, _.get(filteringBudgets, datasource).partner_type, partnerTypes, true)}`;
  }

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringBudgets, datasource).grantId}${_.get(filtering, datasource).eq
      }${grantId}`;
  }

  const IPnumber = _.get(params, 'IPnumber', null);
  if (IPnumber) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringBudgets, datasource).IPnumber}${_.get(filtering, datasource).eq
      }${IPnumber}`;
  }

  const activityAreaName = _.get(params, 'activityAreaName', null);
  if (activityAreaName) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringBudgets, datasource).activityAreaName
      }${_.get(filtering, datasource).eq}'${activityAreaName}'`;
  }

  str += `${str.length > 0 ? ' and ' : ''}${_.get(params, 'levelParam', '')}`;

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
