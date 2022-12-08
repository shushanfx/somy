import exceljs from 'exceljs';
import stream from 'stream';
import fs from 'fs';
import { ExcelWorkBook, ExcelParameter } from './excel';
// @ts-ignore
import tmp from 'tmp';

export type CommandFunction = () => Promise<any>;

export class ExcelWorkBookStream extends ExcelWorkBook {
  bufferCount = 0;
  filename: string;
  streamWorkbook: exceljs.stream.xlsx.WorkbookWriter;
  isExecuting = false;
  commands: CommandFunction[];
  constructor(workbook?: exceljs.Workbook, name?: string, param?: ExcelParameter) {
    super(workbook, name, param);
    const filename = tmp.fileSync({
      prefix: 'excel',
      postfix: '.xlsx',
    });
    this.filename = filename.name;
    const options = {
      filename: filename.name,
      useStyles: true,
      useSharedStrings: true,
    };
    this.streamWorkbook = new exceljs.stream.xlsx.WorkbookWriter(options);
    this.commands = [];
  }
  async toStream(): Promise<stream.Stream> {
    const readable = fs.createReadStream(this.filename);
    this.emit(ExcelWorkBook.EVENT_STREAM_START, readable);
    readable.on('end', () => {
      this.emit(ExcelWorkBook.EVENT_STREAM_END);
    });
    readable.on('error', (e) => {
      this.emit(ExcelWorkBook.EVENT_ERROR, e);
    });
    return readable;
  }
  async toFile(name?: string): Promise<string> {
    if (!name) {
      return this.filename;
    }
    return new Promise((resolve, reject) => {
      this.emit(ExcelWorkBook.EVENT_FILE_START, name);
      const writableStream = fs.createWriteStream(name);
      writableStream.on('end', () => {
        this.emit(ExcelWorkBook.EVENT_FILE_END, name);
        resolve(name);
      });
      writableStream.on('error', (e) => {
        this.emit(ExcelWorkBook.EVENT_ERROR, e);
        reject(e);
      });
      fs.createReadStream(this.filename).pipe(writableStream);
    });
  }
  async addRow(row: any[], name?: string) {
    // BUGFIX workbook的sheets从1开始计数
    let sheet = this.streamWorkbook.getWorksheet(name ?? 1);
    if (!sheet) {
      sheet = this.streamWorkbook.addWorksheet(name);
    }
    await sheet.addRow(row).commit();
  }
  async addRows(rows: any[], name?: string) {
    // BUGFIX workbook的sheets从1开始计数
    let sheet = this.streamWorkbook.getWorksheet(name ?? 1);
    if (!sheet) {
      sheet = this.streamWorkbook.addWorksheet(name);
    }
    for (const row of rows) {
      await sheet.addRow(row).commit();
    }
  }
  async flushSheet(name: string) {
    const sheet = this.streamWorkbook.getWorksheet(name ?? 1);
    await sheet.commit();
  }
  async flush() {
    return this.streamWorkbook.commit();
  }
  addCommand(command: string, data: any, callback?: (...arg: any) => void) {
    let fun;
    if (command === ExcelWorkBook.EVENT_ROW) {
      fun = async () => this.addRow(data.row, data.name);
    } else if (command === ExcelWorkBook.EVENT_ROWS) {
      fun = async () => this.addRows(data.rows, data.name);
    } else if (command === ExcelWorkBook.EVENT_FLUSH_SHEET) {
      fun = async () => this.flushSheet(data.name);
    } else if (command === ExcelWorkBook.EVENT_FLUSH) {
      fun = async () => {
        await this.flush();
        await this.toFile().then((file) => {
          callback?.(null, file);
        })
          .catch((e) => {
            callback?.(e);
          });
      };
    }
    if (fun) {
      this.commands.push(fun);
      this.executeCommand();
    }
  }
  async executeCommand() {
    if (this.isExecuting) {
      return ;
    }
    while (this.commands.length) {
      const command = this.commands.shift();
      if (command) {
        await command();
      }
    }
    this.isExecuting = false;
  }
}
