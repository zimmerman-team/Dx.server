import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, forceId: false}})
export class Dataset extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

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
    type: 'string',
    required: true,
  })
  description: string;

  @property({
    type: 'boolean',
    required: true,
  })
  public: boolean;

  @property({
    type: 'boolean',
    default: false,
  })
  baseline: boolean;

  @property({
    type: 'string',
    required: true,
  })
  category: string;

  @property({
    type: 'string',
    required: true,
  })
  source: string;

  @property({
    type: 'string',
    required: false,
  })
  sourceUrl: string;

  @property({
    type: 'string',
  })
  owner: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  createdDate?: string;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  updatedDate?: string;

  constructor(data?: Partial<Dataset>) {
    super(data);
  }
}

export interface DatasetRelations {
  // describe navigational properties here
}

export type DatasetWithRelations = Dataset & DatasetRelations;
