import exceljs from 'exceljs';
import stream from 'stream';
import { EventEmitter } from 'events';

export interface ExcelSheet {
  name?: string;
  header: string[];
  data: any[];
}

export interface ExcelParameter {
  name?: string; // excel文件的名称
  sheets: ExcelSheet[]; // excel的sheets
  noStart?: boolean; // 不调用
}

export class ExcelWorkBook extends EventEmitter {
  static EVENT_START = 'start';
  static EVENT_FLUSH = 'flush';
  static EVENT_STREAM_START = 'streamstart';
  static EVENT_STREAM_END = 'streamend';
  static EVENT_FILE_START = 'filestart';
  static EVENT_FILE_END = 'fileend';
  static EVENT_ERROR = 'error';
  static EVENT_ROW = 'row';
  static EVENT_ROWS = 'rows';
  static EVENT_FILE = 'file';
  static EVENT_FLUSH_SHEET = 'flushsheet';

  workbook?: exceljs.Workbook;
  param?: ExcelParameter;
  name: string;
  isStart: boolean;
  isEnd: boolean;
  constructor(workbook?: exceljs.Workbook, name?: string, param?: ExcelParameter) {
    super();
    this.isStart = false;
    this.isEnd = false;
    this.workbook = workbook;
    this.param = param;
    this.name = name || 'test.xlsx';
  }
  async toStream(): Promise<stream.Stream> {
    const buffer = await this.toBuffer();
    const readable = new stream.Readable();
    this.emit(ExcelWorkBook.EVENT_STREAM_START, readable);
    const { length } = buffer;
    let iCount = 0;
    readable._read = (size) => {
      while (iCount <= length) {
        const end = Math.min(length, iCount + size);
        const arr = buffer.slice(iCount, end);
        iCount = end;
        if (iCount >= length) {
          readable.push(arr);
          readable.push(null);
          break;
        } else {
          const result = readable.push(arr);
          if (!result) {
            break;
          }
        }
      }
    };
    readable.on('end', () => {
      this.emit(ExcelWorkBook.EVENT_STREAM_END);
    });
    readable.on('error', (e) => {
      this.emit(ExcelWorkBook.EVENT_ERROR, e);
    });
    return readable;
  }
  async toFile(name?: string): Promise<string> {
    if (!this.workbook) {
      throw new Error('The workbook is null.');
    }
    const finalName = name || this.name;
    this.emit(ExcelWorkBook.EVENT_FILE_START, finalName);
    return this.workbook.xlsx
      .writeFile(finalName)
      .then(() => {
        this.emit(ExcelWorkBook.EVENT_FILE_END, finalName);
        return finalName;
      })
      .catch((e) => {
        this.emit(ExcelWorkBook.EVENT_ERROR, e);
        return '';
      });
  }
  addRow(row: any[], name?: string) {
    // BUGFIX workbook的sheets从1开始计数
    let sheet = this.workbook!.getWorksheet(name ?? 1);
    if (!sheet) {
      sheet = this.workbook!.addWorksheet(name);
    }
    sheet.addRow(row);
  }
  addRows(rows: any[], name?: string) {
    // BUGFIX workbook的sheets从1开始计数
    let sheet = this.workbook!.getWorksheet(name ?? 1);
    if (!sheet) {
      sheet = this.workbook!.addWorksheet(name);
    }
    sheet.addRows(rows);
  }
  flush() {
    this.emit(ExcelWorkBook.EVENT_FLUSH);
  }
  start() {
    if (this.isStart) {
      return ;
    }
    this.isStart = true;
    this.emit(ExcelWorkBook.EVENT_START);
    this.flush();
  }
  private async toBuffer(): Promise<Buffer> {
    if (!this.workbook) {
      throw new Error('The workbook is null.');
    }
    const buffer = await this.workbook.xlsx.writeBuffer();
    const ret = Buffer.from(buffer);
    return ret;
  }
}

export const toExcel = function (param: ExcelParameter): ExcelWorkBook {
  const workbook = new exceljs.Workbook();
  const excel = new ExcelWorkBook(workbook, param.name);
  for (const item of param.sheets) {
    const sheetData: any[] = [item.header].concat(item.data);
    const sheet = workbook.addWorksheet(item.name);
    sheet.addRows(sheetData);
  }
  // 尽快执行
  setImmediate(() => {
    if (param.noStart) {
      return ;
    }
    excel.start();
  });
  return excel;
};

export const EVENTS = [
  ExcelWorkBook.EVENT_ERROR,
  ExcelWorkBook.EVENT_FILE_START,
  ExcelWorkBook.EVENT_FILE_END,
  ExcelWorkBook.EVENT_FLUSH,
  ExcelWorkBook.EVENT_START,
  ExcelWorkBook.EVENT_STREAM_START,
  ExcelWorkBook.EVENT_STREAM_END,
];
