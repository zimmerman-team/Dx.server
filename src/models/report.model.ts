import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, forceId: true}})
export class Report extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'boolean',
    default: true,
  })
  showHeader: boolean;

  @property({
    type: 'object',
    required: false,
  })
  title: object;

  @property({
    type: 'object',
    required: false,
  })
  subTitle: object;

  @property({
    type: 'array',
    itemType: 'any',
  })
  rows: any[][]; // string: chart id, object: formatted text

  @property({
    type: 'boolean',
    default: false,
  })
  public: boolean;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  createdDate: string;

  constructor(data?: Partial<Report>) {
    super(data);
  }
}
