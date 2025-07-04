import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, forceId: true}})
export class Chart extends Entity {
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
    type: 'string',
  })
  nameLower: string;

  @property({
    type: 'boolean',
    default: false,
  })
  public: boolean;

  @property({
    type: 'boolean',
    default: false,
  })
  baseline: boolean;

  @property({
    type: 'boolean',
    default: false,
  })
  isMappingValid: boolean;

  @property({
    type: 'boolean',
    default: false,
  })
  isAIAssisted: boolean;

  @property({
    type: 'string',
    required: true,
  })
  vizType: string;

  @property({
    type: 'string',
    required: true,
  })
  datasetId: string;

  @property({
    type: 'object',
    required: true,
  })
  mapping: object;

  @property({
    type: 'object',
    required: true,
  })
  vizOptions: object;

  @property({
    type: 'object',
  })
  appliedFilters: object;

  @property({
    type: 'array',
    itemType: 'string',
  })
  enabledFilterOptionGroups: string[];

  @property({
    type: 'string',
  })
  owner: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  createdDate: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  updatedDate: string;

  constructor(data?: Partial<Chart>) {
    super(data);
  }
}
