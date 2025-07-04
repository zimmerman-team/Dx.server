import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, forceId: true}})
export class Story extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
    required: false,
  })
  name: string;

  @property({
    type: 'string',
  })
  nameLower: string;

  @property({
    type: 'boolean',
    default: true,
  })
  showHeader: boolean;

  @property({
    type: 'string',
    required: false,
  })
  title: string;

  @property({
    type: 'object',
    required: false,
  })
  heading: object;
  @property({
    type: 'object',
    required: false,
  })
  description: object;

  @property({
    type: 'array',
    itemType: 'any',
  })
  rows: {
    items: any[]; // string: chart id, object: formatted text
    structure: string;
    contentWidths: {
      id: string;
      widths: number[];
    }[];
    contentHeights: {
      id: string;
      heights: number[];
    }[];
  }[];

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
    type: 'string',
    required: false,
    default: '#252c34',
  })
  backgroundColor: string;

  @property({
    type: 'string',
    required: false,
    default: '#ffffff',
  })
  titleColor: string;

  @property({
    type: 'string',
    required: false,
    default: '#ffffff',
  })
  descriptionColor: string;

  @property({
    type: 'string',
    required: false,
    default: '#ffffff',
  })
  dateColor: string;

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

  constructor(data?: Partial<Story>) {
    super(data);
  }
}
