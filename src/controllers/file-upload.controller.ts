// Copyright IBM Corp. and LoopBack contributors 2020. All Rights Reserved.
// Node module: @loopback/example-file-transfer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {inject} from '@loopback/core';
import {
  post,
  Request,
  requestBody,
  Response,
  RestBindings
} from '@loopback/rest';
import {FILE_UPLOAD_SERVICE} from '../keys';
import {FileUploadHandler} from '../types';
// @ts-ignore keep this import for production node
import multer from 'multer';
import axios from 'axios';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
}

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
  ) { }
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
          resolve(FileUploadController.getFilesAndFields(request));
        }
      });
    });
  }

  /**
   * Get files and fields for the request
   * @param request - Http request
   */
  private static async getFilesAndFields(request: Request) {
    const uploadedFiles = request.files;
    const additionalFields = request.body;
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
    for (const uploadedFile of files) {
      let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
      if (process.env.ENV_TYPE !== "prod") host = process.env.ENV_TYPE ? `dx-backend-${process.env.ENV_TYPE}` : host;
      let uploadFileAddition = "";
      if (additionalFields.table) uploadFileAddition = `/${additionalFields.table}`;
      if (
        additionalFields.username !== "" &&
        additionalFields.password !== "" &&
        additionalFields.host !== "" &&
        additionalFields.port !== "" &&
        additionalFields.database !== "" &&
        additionalFields.table !== ""
      ) {
        uploadFileAddition = `/${additionalFields.username}/${additionalFields.password}/${additionalFields.host}/${additionalFields.port}/${additionalFields.database}/${additionalFields.table}`;
      }
      if (additionalFields.api_url !== "") {
        // create a base64 encoded string from the api url and replace slashes with underscores
        let apiUrlBase64 = Buffer.from(additionalFields.api_url, 'utf-8').toString('base64');
        apiUrlBase64 = apiUrlBase64.replace(/\//g, "_");
        // extend the url with the base64 encoded string and the json and xml root elements, or none if not provided
        uploadFileAddition = `/${apiUrlBase64}`;
        uploadFileAddition += `/${(additionalFields.json_root !== "") ? additionalFields.json_root : "none"}`;
        uploadFileAddition += `/${(additionalFields.xml_root !== "") ? additionalFields.xml_root : "none"}`;
      }
      await axios.post(`http://${host}:4004/upload-file/${uploadedFile.filename}${uploadFileAddition}`)
        .then(_ => console.log("DX Backend upload complete"))
        .catch(e => {
          console.log("DX Backend upload failed", e);
          return {error: "Error uploading files"};
        });
    }
    return {files, fields: request.body};
  }
}
