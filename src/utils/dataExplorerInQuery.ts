import _ from 'lodash';
import filtering from '../config/filtering/index.json';

// Due to limited support of odata 4.0.1 'in' query filter,
// we can convert the in statement to equivalent eq statement.
function inToEq(field: any, dataList: any) {
  let str = '(';
  // for each item in the dataList, add (field eq item) to the string
  dataList.forEach((item: any, index: number) => {
    if (index === 0) str += `${field} eq ${item}`;
    else str += ` or ${field} eq ${item}`;
  })
  return str += ')';
}

// the original odata 4.0.1 'in' query filter, datalist can be a list to be joined, or a string
function tgfIn(datasource: any, field: any, dataList: any, join?: boolean) {
  return `${field}${_.get(filtering, datasource).in}(${join ? dataList.join(_.get(filtering, datasource).multi_param_separator) : dataList})`
}

export function dataExplorerInQuery(datasource: any, field: any, dataList: any, join?: boolean) {
  return datasource === 'TGFOData'
    ? tgfIn(datasource, field, dataList, join)
    : inToEq(field, dataList);
}
