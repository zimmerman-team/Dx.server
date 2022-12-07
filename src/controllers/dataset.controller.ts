import {BindingKey, inject} from "@loopback/core";
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef, param, patch, post, put, requestBody,
  response
} from '@loopback/rest';
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
      let path = process.env.DX_BACKEND_DIR + "api/db/data/" || "";
      const filesInData = fs.readdirSync(path);
      filesInData.forEach((file: string) => {
        if (file.includes(id)) fs.unlinkSync(path + file);
      });
      // Step 2: remove the dataset from the SSR repository
      path = process.env.DX_SSR_DIR + 'additionalDatasets.json';
      const additionalDatasets = require(path)
      additionalDatasets.forEach((item: any, i: number) => {
        if (item.id === id) {
          additionalDatasets.splice(i, 1);
          return;
        }
      });
      fs.writeFileSync(path, JSON.stringify(additionalDatasets));

      // delete the file from SSR (parsed-)data-files
      fs.unlinkSync(`${process.env.DX_SSR_DIR}/parsed-data-files/${id}.json`);
      fs.unlinkSync(`${process.env.DX_SSR_DIR}/data-files/${id}.json`);
      // delete the dataset entry from backend api/db/schema.cds
      const schemaFile = `${process.env.DX_BACKEND_DIR}api/db/schema.cds`;
      const schema = fs.readFileSync(schemaFile).toString();
      let newContent: string[] = [];
      let skip = false;
      schema.split('\n').forEach(line => {
        if (!skip && line.includes(`dx${id}`)) skip = true;
        if (!skip) newContent.push(line);
        if (skip && line === '}') skip = false;
      });
      fs.writeFileSync(schemaFile, newContent.join('\n'));

      // delete the dataset entry from backend api/srv/data-service.cds
      const serviceFile = `${process.env.DX_BACKEND_DIR}api/srv/data-service.cds`;
      const service = fs.readFileSync(serviceFile)
        .toString().split('\n')
        .map((str) => str.includes(`dx${id}`) ? "" : str).join('\n');
      console.log(service)
      fs.writeFileSync(serviceFile, service);
    }).catch((e) => {console.log(e)}); // do nothing if the dataset does not exist

    // Step 3: remove the dataset from the dataset database
    await this.datasetRepository.deleteById(id);
  }
}
