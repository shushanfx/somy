import { BaseConsumer, Queue, Task, TaskResult } from '../src/index';

class DemoConsumer extends BaseConsumer {
  async run(task: Task): Promise<void | TaskResult> {
    await this.logBoth(`This task ${task.name} run at ${Date.now()}`);
  }
}

class ErrorConsumer extends BaseConsumer {
  async run(task: Task): Promise<void | TaskResult> {
    await this.logBoth(`This task ${task.name} at ${Date.now()}`);
    await this.logBoth(`This task ${task.name} will throw an error at ${Date.now()}`);
    throw new Error('Method not implemented.');
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms > 0 ? ms : 1);
  });
}

describe('Consumers', () => {
  const queue = new Queue({
    name: 'server-task-test',
    isConsumer: true,
    redis: {
      host: '127.0.0.1',
      port: 3306,
      db: 1,
    },
    logger: console,
  });
  queue.registerConsumer('demo', DemoConsumer)
    .registerConsumer('error', ErrorConsumer);
  test('Add a job', async () => {
    const job = await queue.submit({
      name: 'demo',
    });
    expect(!!job.id).toBeTruthy();
  }, 10000);
  test('Add a repeat job', async () => {
    const job = await queue.submit({
      name: 'demo',
      repeat: {
        every: 2000,
        limit: 3,
        immediately: true,
      },
    });
    expect(!!job.id).toBeTruthy();
    await sleep(20000);
  }, 30000);
  test('Add a delayed job', async () => {
    const job = await queue.submit({
      name: 'demo',
      delay: 3000,
    });
    expect(!!job.id).toBeTruthy();
    const resultJob = await queue.getJob(job.id!);
    expect(resultJob?.name).toBe('demo');
    expect(await resultJob?.getState()).toBe('delayed');
    const result = await queue.abortJob(job.id!);
    expect(result.result).toBe('success');
    const resultJob2 = await queue.getJob(job.id!);
    expect(resultJob2?.isAbort).toBeTruthy();
    await sleep(5000);
  });
  test('Create a crontab job', async () => {
    const job = await queue.submit({
      name: 'demo',
      repeat: {
        cron: '*/1 * * * *',
        immediately: true,
      },
    });
    if (job.id) {
      await sleep(10000);
      await queue.abortJob(job.id);
    }

    const job2 = await queue.getJob(job.id!);
    console.info(job2);
  });
});
