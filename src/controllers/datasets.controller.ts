import {inject} from '@loopback/core';
import {
  get,
  Request,
  response,
  ResponseObject,
  RestBindings
} from '@loopback/rest';
import _ from 'lodash';
import datasets from '../config/mapping/datasets.json';

const DATASETS_RESPONSE: ResponseObject = {
  description: 'Datasets Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'DatasetsResponse',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'string',
            }
          },
        },
      },
    },
  },
};

/**
 * A simple controller return the mapped datasets
 */
export class DatasetsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) { }

  @get('/mapped-datasets')
  @response(200, DATASETS_RESPONSE)
  mappeddatasets(): object {
    const datasource: any = this.req.query?.datasource ?? process.env.DEFAULT_DATASOURCE;
    let mappedDatasetsList: string[] = []
    const mappedDatasets = _.get(datasets, datasource);
    Object.keys(mappedDatasets).forEach((key) => {
      if (mappedDatasets[key]) mappedDatasetsList.push(key)
    });
    return {
      data: mappedDatasetsList,
    };
  }
}
