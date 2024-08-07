// Copyright IBM Corp. and LoopBack contributors 2020. All Rights Reserved.
// Node module: @loopback/example-file-transfer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  post,
  Request,
  requestBody,
  Response,
  RestBindings,
} from '@loopback/rest';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
// @ts-ignore keep this import for production node
import axios from 'axios';
import _ from 'lodash';
import {DatasetRepository} from '../repositories';
import {getUserPlanData} from '../utils/planAccess';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
}

let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
if (process.env.ENV_TYPE !== 'prod')
  host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;

/**
 * A controller to handle file uploads using multipart/form-data media type
 */
export class FileUploadController {
  /**
   * Constructor
   * @param handler - Inject an express request handler to deal with the request
   */
  constructor(
    @inject(FILE_UPLOAD_SERVICE) private handler: FileUploadHandler,
    @inject(RestBindings.Http.REQUEST) private req: Request,

    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,
  ) {}
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  @post('/files', {
    responses: {
      200: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
            },
          },
        },
        description: 'Files and fields',
      },
    },
  })
  async fileUpload(
    @requestBody.file()
    request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      this.handler(request, response, (err: unknown) => {
        if (err) reject(err);
        else {
          resolve(
            FileUploadController.getFilesAndFields(
              request,
              this.datasetRepository,
            ),
          );
        }
      });
    });
  }

  /**
   * Get files and fields for the request
   * @param request - Http request
   */
  private static async getFilesAndFields(
    request: Request,
    datasetRepository: DatasetRepository,
  ) {
    const uploadedFiles = request.files;
    const mapper = (f: globalThis.Express.Multer.File) => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      encoding: f.encoding,
      mimetype: f.mimetype,
      size: f.size,
      filename: f.filename,
    });
    let files: UploadedFile[] = [];
    if (Array.isArray(uploadedFiles)) {
      files = uploadedFiles.map(mapper);
    } else {
      for (const filename in uploadedFiles) {
        files.push(...uploadedFiles[filename].map(mapper));
      }
    }
    const userPlan = await getUserPlanData(
      _.get(request, 'user.sub', 'anonymous'),
    );
    const userDatasets = await datasetRepository.find({
      where: {
        owner: _.get(request, 'user.sub', 'anonymous'),
      },
    });

    if (userDatasets.length >= userPlan.datasets.noOfDatasets) {
      return {
        error: `You have reached the <b>${userPlan.datasets.noOfDatasets}</b> dataset limit for your ${userPlan.name} Plan. Upgrade to increase.`,
        errorType: 'planError',
      };
    }

    for (const uploadedFile of files) {
      try {
        const response = await axios.post(
          `http://${host}:4004/dataset-size`,
          userDatasets.map(d => d.id),
        );
        if (
          response.data.result + uploadedFile.size / (1024 * 1024) >=
          userPlan.datasets.datasetsSize
        ) {
          return {
            error: `Your dataset exceeds the total <b>${
              userPlan.datasets.datasetsSize / 1024
            }GB</b> limit on your ${userPlan.name} plan. Upgrade to increase.`,
            processingMessage: `This dataset exceeds your total ${
              userPlan.datasets.datasetsSize / 1024
            }GB of usage`,
            errorType: 'planError',
          };
        }
      } catch (e) {
        console.log('DX Backend upload failed', e);
        return {error: e.response.data.result};
      }
      await axios
        .post(`http://${host}:4004/upload-file/${uploadedFile.filename}`)
        .then(_ => console.log('DX Backend upload complete'))
        .catch(e => {
          console.log('DX Backend upload failed', e);
          return {error: e.response.data.result};
        });
    }
    return {files, fields: request.body};
  }
}
