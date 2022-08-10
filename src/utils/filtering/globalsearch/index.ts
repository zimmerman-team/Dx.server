import _ from 'lodash';
import filteringUtils from '../../../config/filtering/index.json';

export function buildGlobalSearchFilterString(
  fields: string[],
  template: string,
  keywords: string[],
  datasource: string,
): string {
  const strArray: string[] = [];

  keywords.forEach((keyword: string) => {
    const fieldStrArray: string[] = fields.map((field: string) =>
      template.replace('<field>', field).replace('<value>', `'${keyword}'`),
    );
    strArray.push(`(${fieldStrArray.join(` ${_.get(filteringUtils, datasource).or_operator} `)})`);
  });

  return strArray.join(` ${_.get(filteringUtils, datasource).and_operator} `);
}
