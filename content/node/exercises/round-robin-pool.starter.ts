export type Worker<J, R> = (job: J) => Promise<R>

export class WorkerPool<J, R> {
  private next = 0

  constructor(private workers: Worker<J, R>[]) {}

  run(job: J): Promise<R> {
    // TODO: only one job per worker at a time; queue the rest.
    const worker = this.workers[this.next]
    this.next = (this.next + 1) % this.workers.length
    return worker(job)
  }

  stats() {
    return { busy: 0, queued: 0 }
  }
}
