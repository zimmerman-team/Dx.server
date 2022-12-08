import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import 'dotenv/config';
import multer from 'multer';
import path from 'path';
import {DbDataSource} from './datasources';

import {FILE_UPLOAD_SERVICE, STORAGE_DIRECTORY} from "./keys";
import {MySequence} from "./sequence";

export {ApplicationConfig};

export class ApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set datasource based off environment
    const dbHost = process.env.MONGO_HOST ?? 'localhost';
    const dbPort = process.env.MONGO_PORT ?? 27017;
    const dbUser = process.env.MONGO_USERNAME ?? '';
    const dbPass = process.env.MONGO_PASSWORD ?? '';
    const database = process.env.MONGO_DB ?? 'the-data-explorer-db';

    this.bind('datasources.config.db').to({
      name: 'db',
      connector: 'mongodb',
      url: '',
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      database: database,
      useNewUrlParser: true,
    });
    this.bind('datasources.db').toClass(DbDataSource);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/api-explorer',
      indexTitle: 'The Data Explorer API',
    });
    this.component(RestExplorerComponent);

    this.configureFileUpload(options.fileStorageDirectory);
    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  /**
   * Configure `multer` options for file upload
   */
  protected configureFileUpload(destination?: string) {
    // Upload files to `dist/.sandbox` by default
    destination = destination ?? path.join(__dirname, "../../dx.backend/staging/db/data");
    this.bind(STORAGE_DIRECTORY).to(destination);
    const multerOptions: multer.Options = {
      storage: multer.diskStorage({
        destination,
        // Use the original file name as is
        filename: (req, file, cb) => {
          const newName = `data-${file.fieldname}.${file.originalname.split('.').pop()}`;
          cb(null, newName);
        },
      }),
      limits: {fileSize: 1024 * 1024 * 40}
    };
    // Configure the file upload service with multer options
    this.configure(FILE_UPLOAD_SERVICE).to(multerOptions);
  }
}
