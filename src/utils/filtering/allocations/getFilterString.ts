import _ from 'lodash';
import filteringAllocations from '../../../config/filtering/allocations.json';
import filtering from '../../../config/filtering/index.json';

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
    str += `(${_.get(filteringAllocations, datasource).country}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}) or ${_.get(filteringAllocations, datasource).multicountry}${_.get(filtering, datasource).in}(${locations.join(
      _.get(filtering, datasource).multi_param_separator,
    )}))`;
  }

  const components = _.filter(
    _.get(params, 'components', '').split(','),
    (comp: string) => comp.length > 0,
  ).map((comp: string) => `'${comp}'`);
  if (components.length > 0) {
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringAllocations, datasource).component}${_.get(filtering, datasource).in
      }(${components.join(_.get(filtering, datasource).multi_param_separator)})`;
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
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringAllocations, datasource).periodStart
      }${_.get(filtering, datasource).in}(${startPeriods.join(_.get(filtering, datasource).multi_param_separator)})`;
    str += `${str.length > 0 ? ' and ' : ''}${_.get(filteringAllocations, datasource).periodEnd}${_.get(filtering, datasource).in
      }(${endPeriods.join(_.get(filtering, datasource).multi_param_separator)})`;
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
