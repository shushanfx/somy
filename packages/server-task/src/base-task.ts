import { Job, RepeatOptions, JobsOptions } from 'bullmq';
import { Queue } from './queue';

export interface TaskJobRepeatConfig {
  /**
 * crontab的语法
 */
  cron?: string;
  /**
  * 每过多久执行一次，单位ms
  */
  every?: number;
  /**
   * 最多执行的次数，默认不限制
   */
  limit?: number;
}

interface TaskParameterErrorOptions {
  receivers: Array<string>;
  title?: string;
  content?: string;
}
export interface TaskParameter {
  /**
   * 任务的名称
   */
  name: string;
  /**
   * 重试次数
   */
  attempts?: number; // 重试次数
  creator?: string;
  /**
   * 出错的推送信息，执行失败时会推送消息
   */
  error?: TaskParameterErrorOptions;
  /**
   * 任务的延迟的时间，单位ms
   */
  delay?: number;
  /**
   * 任务的重复属性
   */
  repeat?: RepeatOptions;
  data?: {
    [key: string]: any;
  },
  [key: string]: any;
  debugError?: boolean;
}

export interface TaskOptions extends JobsOptions {
  error?: TaskParameterErrorOptions;
  debugError?: boolean;
  creator?: string;
}
export interface TaskData {
  __isAbort?: boolean;
  __abortAt?: string;
  __notFoundRetryTimes?: number;
  [key: string]: any;
}
export class Task extends Job {
  job!: TaskParameter;
  opts!: TaskOptions;
  isAbort?: boolean;
  data!: TaskData;
}
export interface TaskResult {
  [key: string]: any;
}

export interface TaskLogger {
  debug(...args: any);
  log(...args: any);
  error(...args: any);
}

export abstract class BaseConsumer {
  task: Task;
  logger: TaskLogger;
  ip: string|undefined;
  queue: Queue;
  constructor(task: Task, options: {
    logger: TaskLogger;
    ip?: string;
    queue: Queue;
  }) {
    this.task = task;
    this.logger = options.logger;
    this.ip = options.ip;
    this.queue = options.queue;
  }
  async logBoth(msg: string) {
    if (this.logger) {
      this.logger.log(msg);
    }
    await this.task.log(msg);
  }
  async execute(): Promise<TaskResult | void> {
    const { opts } = this.task;
    await this.logBoth(`Execute job ${this.task.id} by server ${this.ip}`);
    try {
      if (opts?.debugError) {
        throw new Error('测试执行报错信息！');
      }
      const result = await this.run(this.task);
      let dataString = '';
      if (result) {
        dataString = JSON.stringify(result);
        this.logBoth(`Job result: ${dataString}`);
      }
      await this.task.updateProgress(100);
      return result;
    } catch (e: any) {
      const currentTimes = (this.task.attemptsMade || 0) + 1;
      const maxRetryTimes = this.task?.opts?.attempts && this.task?.opts.attempts > 0 ? this.task.opts.attempts : 1;
      this.logBoth(`execute job fail. ${e?.message || ''} in time ${currentTimes}`);
      if (currentTimes >= maxRetryTimes) {
        if (opts.error?.receivers?.length) {
          const receivers = [
            ...opts.error.receivers,
          ];
          const content = `${opts.error.title || `执行异步任务${this.task.name}异常，`}`;
          this.logBoth(`Mail content: ${content}`);
          await this.queue.sendEmail({
            title: opts.error.title || `【cmp任务】执行异步任务${this.task.name}异常，请联系管理员。`,
            content,
            receivers,
          });
        }
      }
      throw e;
    }
  }
  async onBefore(_task: Task): Promise<void> {};
  async onComplete(_error: Error | null, _task: Task): Promise<void> {};
  abstract run(task: Task): Promise<TaskResult | void>;
}

/**
 * 空任务，不进行具体的任务，Queue中用得到。
 */
export class EmptyConsumer extends BaseConsumer {
  async run(_task: Task): Promise<void | TaskResult> {
    // 不进行任何任务
  }
}
