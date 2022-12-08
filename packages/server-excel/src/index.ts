import { Worker, WorkerOptions } from 'worker_threads';
import path from 'path';
import { ExcelParameter, toExcel as toEasyExcel, ExcelWorkBook } from './excel';
import fs from 'fs';
import stream from 'stream';

const delay = (timeout: number): Promise<boolean> => new Promise((resolve) => {
  setTimeout(() => {
    resolve(true);
  }, timeout);
});

export interface ExtendSheet {
  name?: string;
  rows?: any[];
  isFlush: boolean;
}

class ExcelWorkBookMaster extends ExcelWorkBook {
  worker: Worker;
  filename?: string;
  readyPromise: Promise<string>;
  extendSheets: ExtendSheet[];
  constructor(worker: Worker, param: ExcelParameter) {
    super();
    this.extendSheets = [];
    this.worker = worker;
    this.readyPromise = new Promise((resolve, reject) => {
      worker.on('message', ({ type, data }) => {
        if (type === ExcelWorkBook.EVENT_FILE) {
          // data 为Unit8Array
          this.filename = data;
          resolve(data);
        } else if (type === ExcelWorkBook.EVENT_ERROR) {
          const [error] = (data || []);
          this.emit(type, error);
          reject(error as Error);
        } else {
          this.emit(type, ...(data || []));
        }
      });
      worker.once('error', (e) => {
        this.emit(ExcelWorkBook.EVENT_ERROR, e);
        reject(e);
      });
      worker.once('exit', () => {
        this.isEnd = true;
      });
    });
    this.param = param;
  }
  async toStream(): Promise<stream.Readable> {
    await this.readyPromise;
    const filename = await this.toFile();
    const readable = fs.createReadStream(filename);
    this.emit(ExcelWorkBook.EVENT_STREAM_START, readable);
    readable.on('end', () => {
      this.emit(ExcelWorkBook.EVENT_STREAM_END, readable);
    });
    readable.on('error', (e) => {
      this.emit(ExcelWorkBook.EVENT_ERROR, e);
    });
    return readable;
  }
  async toFile(name?: string): Promise<string> {
    await this.readyPromise;
    if (!name) {
      return this.filename!;
    }
    return new Promise((resolve, reject) => {
      this.emit(ExcelWorkBook.EVENT_FILE_START, name);
      const writableStream = fs.createWriteStream(name);
      writableStream.on('close', () => {
        this.emit(ExcelWorkBook.EVENT_FILE_END, name);
        resolve(name);
      });
      writableStream.on('error', (e) => {
        this.emit(ExcelWorkBook.EVENT_ERROR, e);
        reject(e);
      });
      fs.createReadStream(this.filename!).pipe(writableStream);
    });
  }
  addRow(row: any[], name?: string) {
    if (this.isEnd) {
      return ;
    }
    if (!this.isStart) {
      this.addRows([row], name);
    } else {
      throw new Error('已经开始处理excel，不允许再添加数据！');
    }
  }
  addRows(rows: any[], name?: string) {
    if (this.isEnd) {
      return ;
    }
    if (!this.isStart) {
      const extendSheet = this.getExtendSheet(name);
      if (!extendSheet) {
        const extendSheet: ExtendSheet = {
          name,
          rows,
          isFlush: false,
        };
        this.extendSheets.push(extendSheet);
      } else {
        extendSheet.rows = extendSheet.rows?.concat(rows);
      }
    } else {
      throw new Error('已经开始处理excel，不允许再添加数据！');
    }
  }
  getExtendSheet(name?: string) {
    const finalName = name || 'Sheet1';
    const find = this.extendSheets.find((item) => {
      if (item.name === finalName) {
        return true;
      }
      return false;
    });
    return find;
  }
  flushSheet(name: string) {
    this.worker.postMessage({
      type: ExcelWorkBook.EVENT_FLUSH_SHEET,
      data: { name },
    });
    this.emit(ExcelWorkBook.EVENT_FLUSH_SHEET);
  }
  flush() {
    this.worker.postMessage({
      type: ExcelWorkBook.EVENT_FLUSH,
    });
    this.emit(ExcelWorkBook.EVENT_FLUSH);
  }
  async start() {
    if (this.isStart) {
      return ;
    }
    const flushRows = async (arr: any[], name: string) => {
      let iCount = 0;
      const size = 1000;
      const { length } = arr;
      while (iCount < length) {
        const end = Math.min(iCount + size, length);
        this.worker.postMessage({
          type: ExcelWorkBook.EVENT_ROWS,
          data: {
            rows: arr.slice(iCount, end),
            name,
          },
        });
        await delay(2);
        iCount += size;
      }
    };
    this.isStart = true;
    let iSheetCount = 0;
    this.emit(ExcelWorkBook.EVENT_START);
    for (const item of this.param!.sheets) {
      const name = item.name ?? `Sheet${iSheetCount + 1}`;
      const extendSheet = this.getExtendSheet(name);
      let arr = item.data;
      if (extendSheet) {
        arr = arr.concat(extendSheet.rows);
      }
      this.worker.postMessage({
        type: ExcelWorkBook.EVENT_ROW,
        data: {
          row: item.header,
          name,
        },
      });
      await flushRows(arr, name);
      await this.flushSheet(name);
      if (extendSheet) {
        extendSheet.isFlush = true;
      }
      iSheetCount += 1;
    }
    iSheetCount = 0;
    for (const item of this.extendSheets) {
      if (!item.isFlush && item.name) {
        await flushRows(item?.rows || [], item.name);
        await this.flushSheet(item.name);
      }
      iSheetCount += 1;
    }
    this.flush();
  }
}

export const toExcel = function (param: ExcelParameter, options?: WorkerOptions): ExcelWorkBook {
  let isNeedChildProcess = false;
  for (const item of param.sheets) {
    const { data, header } = item;
    const size = header.length * data.length;
    if (size > 10000) {
      // 1W个Cell，需要开启子进程
      isNeedChildProcess = true;
    }
  }
  if (isNeedChildProcess) {
    const filePath = process.env.EXCEL_CHILD_PATH || path.resolve(__dirname, './excel.child.js');
    const worker = new Worker(filePath, options);
    const workbook = new ExcelWorkBookMaster(worker, param);
    setImmediate(() => {
      if (param.noStart) {
        return ;
      }
      workbook.start();
    });
    return workbook;
  }
  return toEasyExcel(param);
};

export { ExcelParameter, ExcelWorkBook, ExcelSheet } from './excel';
