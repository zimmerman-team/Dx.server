import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Story} from '../models';

export class StoryRepository extends DefaultCrudRepository<
  Story,
  typeof Story.prototype.id
> {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(Story, dataSource);

    this.modelClass.observe('before save', this.beforeSave);
  }
  async beforeSave(ctx: any) {
    const {instance, data} = ctx;

    if (instance && instance.name) {
      instance.nameLower = instance.name.toLowerCase().trim();
    }

    if (data && data.name) {
      data.nameLower = data.name.toLowerCase().trim();
    }
  }
}
