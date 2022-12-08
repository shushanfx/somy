import { toExcel, ExcelParameter, ExcelWorkBook } from '../src/index';
import { resolve } from 'path';
import { createWriteStream } from 'fs';

describe('Excel Event', () => {
  const sheets: ExcelParameter = {
    name: 'excel.event.xslx',
    sheets: [{
      name: 'Sheet1',
      header: [
        '北京1',
        '北京2',
        '北京3',
      ],
      data: [
        [
          '1', '2', '3',
        ],
        [
          '1', '2', '3',
        ],
        [
          '1', '2', '3',
        ],
      ],
    }],
  };
  it('Test Stream', async () => {
    const workbook = toExcel(sheets);
    const streamStartFunction = jest.fn();
    const streamEndFunction = jest.fn();
    workbook.addListener(ExcelWorkBook.EVENT_STREAM_START, streamStartFunction);
    workbook.addListener(ExcelWorkBook.EVENT_STREAM_END, streamEndFunction);
    const stream = await workbook.toStream();
    expect(streamStartFunction).toBeCalledTimes(1);
    await new Promise((resolve) => {
      const write = createWriteStream('./testEvent4.xlsx');
      write.on('close', () => {
        resolve(true);
      });
      stream.pipe(write);
    });
    expect(streamEndFunction).toBeCalledTimes(1);
  });
  test('Test File', async () => {
    process.env.EXCEL_CHILD_PATH = resolve(__dirname, '../dist/excel.child.js');
    const startFunction = jest.fn();
    const flushFunction = jest.fn();
    const fileStart = jest.fn();
    const fileEnd = jest.fn();
    const sheets: ExcelParameter = {
      name: 'excel.xslx',
      sheets: [{
        name: 'Sheet1',
        header: [
          '北京1',
          '北京2',
          '北京3',
        ],
        data: [],
      }],
      noStart: true,
    };
    for (let i = 0; i < 10000; i++) {
      sheets.sheets[0].data.push([
        1,
        2,
        3,
        4,
        5,
      ]);
    }
    const workbook = toExcel(sheets);
    for (let i = 0; i < 10000; i++) {
      workbook.addRow([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ]);
    }
    for (let i = 0; i < 10000; i++) {
      workbook.addRows([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ]);
      workbook.addRows([
        [1, 2, 3, 4, 'No string', '=1 + 2'],
      ], 'sheet1234');
      workbook.addRow([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ], 'sheet12345');
    }
    workbook.addListener(ExcelWorkBook.EVENT_START, startFunction);
    workbook.addListener(ExcelWorkBook.EVENT_FLUSH, flushFunction);
    workbook.addListener(ExcelWorkBook.EVENT_FILE_START, fileStart);
    workbook.addListener(ExcelWorkBook.EVENT_FILE_END, fileEnd);
    await workbook.start();
    expect(startFunction).toBeCalledTimes(1);
    expect(flushFunction).toBeCalledTimes(1);
    expect(fileStart).not.toBeCalled();
    expect(fileEnd).not.toBeCalled();
    await workbook.toFile('./testEvent3.xlsx');
    expect(fileStart).toBeCalled();
    expect(fileEnd).toBeCalled();
  }, 10000000);
});
