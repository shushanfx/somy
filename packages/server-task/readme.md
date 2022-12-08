# @SOMY/SERVER-TASK

异步任务SDK。依托于bullmq，构建轻量的nodejs任务平台。

对于一个异步任务而言，其中包含多个参与者

## 如何使用

```bash
yarn add @somy/server-task

```

### 初始化

```ts
const queue = new Queue({
  name: 'server-task-test',
  isConsumer: true, // 该参数表示该队列既包含消费者，又包含生产者
  redis: {
    host: '', // redis配置
    port: 0,
    password: '',
    db: 1,
  },
  logger: console, // 自定义日志输出
});
```

### 生产者

```ts
const submitResult = await queue.submit({
 name: 'demo', // 消费者的名称
 params: {
  // 传入的参数
 },
 attempts: 5, // 重试次数
 creator: 'somy', // 创建人
 repeat: {
  cron: '', // crontab字符串
  every: number, // 每ms执行
  limit: 100, // 最多执行次数
 }
});
```

### 消费者

消费者包括两个：

* 定义消费处理逻辑
* 注册消费者

```ts
// 1 定义消费处理逻辑
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
// 2 注册消费者
queue.registerConsumer('demo', DemoConsumer)
    .registerConsumer('error', ErrorConsumer);
```

> PS: 在配置消费者时，必须将`isConsumer`设置为`true`，否则系统将不会消费任何消息！！！

## 配置和API

整个体系包含几个重要的概念：

1. 队列（Queue）

2. 消费者（Consumer)

3. 任务实例（Task）

### 队列的配置

```ts
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
```

### 队列包含的方法

```ts
export declare class Queue extends EventEmitter {
    private options;
    private queue;
    private consumers;
    private worker?;
    private scheduler?;
    private ip?;
    private emailSender?;
    constructor(options: QueueOptions);
    createZip(password?: string, options?: any): ZipBuilder;
    submit(parameter: TaskParameter): Promise<Task>;
    registerConsumer(name: any, task: typeof BaseConsumer): this;
    getJob(jobId: string): Promise<Task | undefined>;
    abortJob(jobId: string): Promise<AbortResult>;
}
```

### 消费者API

```ts
export declare abstract class BaseConsumer {
    task: Task;
    logger: TaskLogger;
    ip: string | undefined;
    queue: Queue;
    constructor(task: Task, options: {
        logger: TaskLogger;
        ip?: string;
        queue: Queue;
    });
    logBoth(msg: string): Promise<void>;
    execute(): Promise<TaskResult | void>;
    onBefore(_task: Task): Promise<void>;
    onComplete(_error: Error | null, _task: Task): Promise<void>;
    abstract run(task: Task): Promise<TaskResult | void>;
}
```

所有消费者均需实现`run`方法。

### 任务实体

```ts
export class Task extends Job {
  id: number;
  data: TaskJob;
  readonly opts: {
    attempts: number; // 重试次数
    delay?: number;
    repeat?: {};
    timestamp?: number;
  };
  readonly attemptsMade: number;
  progress(progress?: number | object): Promise<any>;
  log(raw: string): Promise<any>;
  getState(): Promise<string>;
  update(data: { [key: string]: any }): Promise<any>;
  remove(): Promise<any>;
  retry(): Promise<any>;
  discard(): Promise<any>;
  finished(): Promise<any>;
  moveToCompleted(returnValue: any, ignoreLock?: boolean, notFetch?: boolean): Promise<any>;
  moveToFailed(error: { message: string;[key: string]: any; }, ignoreLock?: boolean): Promise<any>;
}
```
