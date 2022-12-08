import { toExcel, ExcelParameter, ExcelWorkBook } from '../src/excel';
import { createWriteStream } from 'fs';

describe('Excel Basic', () => {
  const sheets: ExcelParameter = {
    name: 'excel.xslx',
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
    const workbook = await toExcel(sheets);
    const stream = await workbook.toStream();
    const writer = createWriteStream('./testBuffer2.xlsx');
    return new Promise((resolve) => {
      writer.on('close', () => {
        resolve(true);
      });
      stream.pipe(writer);
    });
  });
  it('Test To File', async () => {
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
    for (let i = 0; i < 10; i++) {
      workbook.addRow([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ]);
    }
    for (let i = 0; i < 10; i++) {
      workbook.addRows([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ]);
      workbook.addRows([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ], 'sheet1234');
      workbook.addRow([
        1, 2, 3, 4, 'No string', '=1 + 2',
      ], 'sheet12345');
    }
    workbook.flush();
    await workbook.toFile('./testBuffer3.xlsx');
  });
  it('Test To Null', async () => {
    const workbook = new ExcelWorkBook();
    expect(workbook.workbook).toBeUndefined();
  });
});
