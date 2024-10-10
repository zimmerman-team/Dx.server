import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Report} from '../models';

export class ReportRepository extends DefaultCrudRepository<
  Report,
  typeof Report.prototype.id
> {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(Report, dataSource);

    this.modelClass.observe('before save', this.beforeSave);
  }
  async beforeSave(ctx: any) {
    const {instance, data} = ctx;

    if (instance && instance.name) {
      instance.nameLower = instance.name.toLowerCase();
    }

    if (data && data.name) {
      data.nameLower = data.name.toLowerCase();
    }
  }
}
