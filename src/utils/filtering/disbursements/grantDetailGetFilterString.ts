import _ from 'lodash';
import filteringGrantDetailDisbursements from '../../../config/filtering/grantDetailDisbursements.json';
import filteringGrantDetailTreemapDisbursements from '../../../config/filtering/grantDetailTreemapDisbursements.json';
import filtering from '../../../config/filtering/index.json';

export function grantDetailGetFilterString(
  params: any,
  datasource: string,
  aggregationString?: string,
) {
  let str = '';

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrantDetailDisbursements, datasource).grantId
      }${_.get(filtering, datasource).eq}${grantId}`;
  }

  const IPnumber = _.get(params, 'IPnumber', null);
  if (IPnumber) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrantDetailDisbursements, datasource).IPnumber
      }${_.get(filtering, datasource).eq}${IPnumber}`;
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

export function grantDetailTreemapGetFilterString(
  params: any,
  datasource: string,
  aggregationString?: string,
) {
  let str = '';

  const grantId = _.get(params, 'grantId', null);
  if (grantId) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrantDetailTreemapDisbursements, datasource).grantId
      }${_.get(filtering, datasource).eq}${grantId}`;
  }

  const IPnumber = _.get(params, 'IPnumber', null);
  if (IPnumber) {
    str += `${str.length > 0 ? ' AND ' : ''}${_.get(filteringGrantDetailTreemapDisbursements, datasource).IPnumber
      }${_.get(filtering, datasource).eq}${IPnumber}`;
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
