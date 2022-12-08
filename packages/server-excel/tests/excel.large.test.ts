import { toExcel } from '../src/index';
import { resolve } from 'path';

describe('Large cale', () => {
  test('Large file', async () => {
    const data = new Array(10000)
      .fill(1)
      .map((_, index) => [
        index + 1,
        '2021-10-18',
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
        `我的名称${index + 1}`,
      ]);
    const sheet2 = {
      sheets: [
        {
          header: ['序号', '日期', '名称'],
          data: [
            [1, '2021-10-18', '我的名称1'],
            [2, '2021-10-18', '我的名称2'],
            [3, '2021-10-18', '我的名称3'],
          ],
        },
        {
          header: ['序号', '日期', '名称'],
          data,
        },
      ],
      noStart: false,
    };
    process.env.EXCEL_CHILD_PATH = resolve(__dirname, '../dist/excel.child.js');
    const workbook = toExcel(sheet2, {
      resourceLimits: {
        maxOldGenerationSizeMb: 8192,
      },
    });
    for (let i = 0; i < 10000; i++) {
      workbook.addRow([
        i,
        1,
        2,
        3,
        4,
      ], 'Sheet1');
      workbook.addRow([
        i,
        1,
        2,
      ], 'Sheet3');
    }
    await workbook.start();
    await workbook.toFile('excel.master02.xlsx');
  }, 5000000);
});
