import archiver from 'archiver';
import archiverZipEncryptable from 'archiver-zip-encryptable';
import fs from 'fs';
import { Stream } from 'stream';

archiver.registerFormat('zip-encryptable', archiverZipEncryptable);

interface ZipEntryOptions {
  name: string;
  date?: string | Date;
  mode?: number;
  prefix?: string;
  stats?: fs.Stats;
  namePrependSlash?: boolean;
  store?: boolean
}

export class ZipBuilder {
  password?: string;
  zip: any;
  constructor(password?: string, options?: any) {
    this.password = password;
    this.zip = archiver.create(password ? 'zip-encryptable' : 'zip', {
      zlib: {
        level: 9,
      },
      password: this.password,
      forceLocalTime: true,
      ...(options || {}),
    });
  }
  append(data: string | Buffer | Stream, entryData: string | ZipEntryOptions): this {
    if (typeof entryData === 'string') {
      this.zip.append(data, {
        name: entryData,
      });
    } else {
      this.zip.append(data, entryData);
    }
    return this;
  }
  file(filePath: string, dstPath: string, options?: ZipEntryOptions): this {
    this.zip.file(filePath, {
      name: dstPath,
      ...(options || {}),
    });
    return this;
  }
  directory(dirPath: string, dstPath: string, options?: ZipEntryOptions): this {
    this.zip.directory(dirPath, dstPath, options);
    return this;
  }
  async toFile(file: string): Promise<ZipResult> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      this.zip.pipe(fs.createWriteStream(file));
      this.zip.on('end', () => {
        const result: ZipResult = {
          cost: Date.now() - start,
          path: file,
          size: 0,
        };
        fs.stat(file, (err, stat) => {
          if (err) {
            reject(err);
          } else {
            result.size = stat.size;
            resolve(result);
          }
        });
      });
      this.zip.on('error', (e) => {
        reject(e);
      });
      this.zip.finalize();
    });
  }
}

export interface ZipResult {
  size: number;
  path: string;
  cost: number;
}

export const createZip = (password?: string, options?: any): ZipBuilder => new ZipBuilder(password, options);
