import {BindingKey, inject} from "@loopback/core";
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  Where,
  repository
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef, param, patch, post, put, requestBody,
  response
} from '@loopback/rest';
import axios from 'axios';
import fs from 'fs';
import {Dataset} from '../models';
import {DatasetRepository} from '../repositories';

import {RequestHandler} from "express-serve-static-core";
type FileUploadHandler = RequestHandler;

const FILE_UPLOAD_SERVICE = BindingKey.create<FileUploadHandler>(
  "services.FileUpload"
);

export class DatasetController {
  constructor(
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,
    @inject(FILE_UPLOAD_SERVICE) private handler: FileUploadHandler
  ) { }

  @post('/datasets')
  @response(200, {
    description: 'Dataset model instance',
    // content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
    content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDataset',
            exclude: ['id'],
          }),
        },
      },
    })
    dataset: Omit<Dataset, 'id'>,
  ): Promise<Dataset> {
    return this.datasetRepository.create(dataset);
  }

  @get('/datasets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.count(where);
  }

  @get('/datasets')
  @response(200, {
    description: 'Array of Dataset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Dataset, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Dataset) filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    return this.datasetRepository.find(filter);
  }

  @patch('/datasets')
  @response(200, {
    description: 'Dataset PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.updateAll(dataset, where);
  }

  @get('/datasets/{id}')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'}) filter?: FilterExcludingWhere<Dataset>
  ): Promise<Dataset> {
    return this.datasetRepository.findById(id, filter);
  }

  @patch('/datasets/{id}')
  @response(204, {
    description: 'Dataset PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.updateById(id, dataset);
  }

  @put('/datasets/{id}')
  @response(204, {
    description: 'Dataset PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.replaceById(id, dataset);
  }

  @del('/datasets/{id}')
  @response(204, {
    description: 'Dataset DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    this.datasetRepository.findById(id).then(() => {
      // Step 1: remove the dataset from the DX backend if it exists.
      const host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
      axios.post(`${host}:4004/delete-dataset/dx${id}`)
        .then(_ => console.log("File removed from DX Backend"))
        .catch(_ => {
          console.log("Failed to remove the dataset from DX Backend");
        });
      // Step 2: remove the dataset from the SSR repository
      const ssrPath = process.env.DX_SSR_DIR + 'additionalDatasets.json';
      const additionalDatasets = require(ssrPath)
      additionalDatasets.forEach((item: any, i: number) => {
        if (item.id === id) {
          additionalDatasets.splice(i, 1);
          return;
        }
      });
      fs.writeFileSync(ssrPath, JSON.stringify(additionalDatasets));

      // delete the file from SSR (parsed-)data-files
      const parsedDF = `${process.env.DX_SSR_DIR}/parsed-data-files/${id}.json`;
      const dF = `${process.env.DX_SSR_DIR}/data-files/${id}.json`;
      fs.existsSync(parsedDF) && fs.unlinkSync(parsedDF);
      fs.existsSync(dF) && fs.unlinkSync(dF);
    });
    // Step 3: remove the dataset from the dataset database
    await this.datasetRepository.deleteById(id);
  };
}
