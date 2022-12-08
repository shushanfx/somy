import { ExcelWorkBook, EVENTS } from './excel';
import { ExcelWorkBookStream } from './excel.stream';
import { parentPort } from 'worker_threads';

const excel = new ExcelWorkBookStream();
EVENTS.forEach((event) => {
  excel.addListener(event, (...args) => {
    parentPort?.postMessage({
      type: event,
      data: args,
    });
  });
});
parentPort?.on('message', ({ type, data }) => {
  if (type === ExcelWorkBook.EVENT_ROW
      || type === ExcelWorkBook.EVENT_ROWS
      || type === ExcelWorkBook.EVENT_FLUSH_SHEET) {
    excel.addCommand(type, data);
  } else if (type === ExcelWorkBook.EVENT_FLUSH) {
    excel.addCommand(type, data, (err, file) => {
      if (err) {
        parentPort?.postMessage({
          type: ExcelWorkBook.EVENT_ERROR,
          data: [err],
        });
      } else {
        parentPort?.postMessage({
          type: ExcelWorkBook.EVENT_FILE,
          data: file,
        });
      }
    });
  }
});
