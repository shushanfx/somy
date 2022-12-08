import { QueueScheduler as BullQueueScheduler, Job, Queue as BullQueue, QueueOptions as BullQueueOptions, Worker as BullWorker } from 'bullmq';
import { assert } from 'console';
import { EventEmitter } from 'events';
import { TaskParameter, BaseConsumer, Task, TaskLogger, EmptyConsumer, TaskResult } from './base-task';
import { internalIpV4Sync } from './util/ip';
import { createZip, ZipBuilder } from './util/zip';
import moment from 'moment';

export interface QueueOptions {
  /**
   * 队列的名称
   */
  name: string;
  /**
   * 是否为消费者
   */
  isConsumer?: boolean;
  /**
   * Redis配置或者直接通过ioredis创建的redis实例
   */
  redis?: {
    host?: string;
    port?: number;
    db?: number;
    password?: string;
    [key: string]: any;
  } | any;
  logger: TaskLogger | undefined;
  /**
   * 如果consumer未找到，重试的次数，0表示不重试，-1表示一直进行重试，大于0表示具体的重试次数。默认1次
   */
  notFoundRetryTimes?: number;
  /**
   * 下次notFound检查的延迟时间，默认1分钟
   */
  notFoundCheckDelay?: number;
}

export interface AbortResult {
  result: 'notfound' | 'success' | 'fail',
  message: string;
}

export const QUEUE_DEFAULT_OPTIONS: QueueOptions = {
  name: 'default',
  isConsumer: false,
  notFoundCheckDelay: 60 * 1000,
  notFoundRetryTimes: 1,
  logger: console,
};

export class Queue extends EventEmitter {
  private options: QueueOptions;
  private queue: BullQueue;
  private consumers: { [key: string]: typeof BaseConsumer };
  private worker?: BullWorker;
  private scheduler?: BullQueueScheduler;
  private ip?: string;

  constructor(options: QueueOptions) {
    super();
    assert(!!options.name, 'queue name can not be null!');
    this.options = Object.assign(QUEUE_DEFAULT_OPTIONS, options);
    const opt: BullQueueOptions = {};
    if (options.redis) {
      opt.connection = options.redis;
    }
    this.queue = new BullQueue(options.name, opt);
    this.consumers = {};
  }
  createZip(password?: string, options?: any): ZipBuilder {
    return createZip(password, options);
  }
  getBullQueue(): BullQueue {
    return this.queue;
  }
  async submit(parameter: TaskParameter): Promise<Task> {
    const opt = {
      ...parameter,
      data: null,
    };
    const job = await this.queue.add(parameter.name, parameter.data || {}, opt);
    return job as Task;
  }
  registerConsumer(name, task: typeof BaseConsumer): this {
    if (!this.options.isConsumer) {
      return this;
    }
    this.consumers[name] = task;
    if (!this.worker) {
      this.ip = internalIpV4Sync();
      const worker = new BullWorker(
        this.options.name,
        async (job: Job, token?: string): Promise<TaskResult|void> => {
          const { name, data } = (job as Task);
          // 处理取消的情况
          if (data.__isAbort) {
            return;
          }
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const Executor = (this.consumers[name]) as typeof EmptyConsumer;
          if (!Executor) {
          // 是否进行notFound再检查
            if (this.options.notFoundRetryTimes === -1
              || (data.__notFoundRetryTimes || 0) < this.options.notFoundRetryTimes!) {
              await job.update({
                ...data,
                __notFoundRetryTimes: (data.__notFoundRetryTimes || 0) + 1,
              });
              await job.moveToDelayed(this.options.notFoundCheckDelay || 60 * 1000, token);
            } else {
              throw new Error(`任务${name}未找到消费者`);
            }
          }
          const task = job as Task;
          const instance: BaseConsumer = new Executor(task, {
            ip: this.ip,
            logger: this.options.logger!,
            queue: this,
          });
          try {
            await instance.onBefore(task);
            const result = await instance.execute();
            await instance.onComplete(null, task);
            return result;
          } catch (e) {
            this.options.logger!.error('执行任务失败', e);
            await instance.onComplete(e, task);
            throw e;
          }
        }, {
          concurrency: 1,
          connection: this.options.redis,
          autorun: true,
        },
      );
      this.worker = worker;
      this.scheduler = new BullQueueScheduler(this.options.name, {
        connection: this.options.redis,
        autorun: true,
      });
    }
    return this;
  }
  async getJob(jobId: string): Promise<Task|undefined> {
    const job = await this.queue.getJob(jobId);
    this.options.logger?.debug?.('Get job %s with %j', jobId, job);
    if (job) {
      const task = job as Task;
      const { data } = task;
      if (data.__isAbort) {
        task.isAbort = true;
      }
      return task;
    }
    return job as Task;
  }
  async abortJob(jobId: string): Promise<AbortResult> {
    const job = await this.getJob(jobId);
    if (job) {
      if (job.repeatJobKey) {
        // 如果是重复执行的任务，则进行物理删除，减少资源的占用
        this.options.logger?.debug?.('Remove repeat job jobId: %s jobKey: %s', jobId, job.repeatJobKey);
        await job.remove();
        return {
          result: 'success',
          message: '操作成功',
        };
      }
      const state = await job.getState();
      if (state === 'delayed'
        || state === 'waiting'
        || state === 'waiting-children') {
        await job.update(Object.assign({
          ...(job.data || {}),
          __isAbort: true,
          __abortAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        }));
        return {
          result: 'success',
          message: '操作成功',
        };
      }
      if (state === 'active') {
        return {
          result: 'fail',
          message: `当前任务${jobId}正在执行，无法停止`,
        };
      }
      return {
        result: 'fail',
        message: `当前任务状态为${state}，不支持停止`,
      };
    }
    return {
      result: 'notfound',
      message: '当前任务不存在',
    };
  }
}
