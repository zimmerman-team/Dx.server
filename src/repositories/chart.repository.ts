import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Chart} from '../models';

export class ChartRepository extends DefaultCrudRepository<
  Chart,
  typeof Chart.prototype.id
> {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(Chart, dataSource);

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
