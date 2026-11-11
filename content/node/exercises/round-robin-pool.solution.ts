export type Worker<J, R> = (job: J) => Promise<R>

interface Pending<J, R> { job: J; resolve: (value: R) => void; reject: (error: unknown) => void }

export class WorkerPool<J, R> {
  private busy: boolean[]
  private cursor = 0
  private queue: Pending<J, R>[] = []

  constructor(private workers: Worker<J, R>[]) {
    this.busy = workers.map(() => false)
  }

  run(job: J): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ job, resolve, reject })
      this.pump()
    })
  }

  stats() {
    return { busy: this.busy.filter(Boolean).length, queued: this.queue.length }
  }

  private idle(): number {
    for (let step = 0; step < this.workers.length; step++) {
      const i = (this.cursor + step) % this.workers.length
      if (!this.busy[i]) return i
    }
    return -1
  }

  private pump() {
    while (this.queue.length) {
      const i = this.idle()
      if (i < 0) return
      const { job, resolve, reject } = this.queue.shift()!
      this.busy[i] = true
      this.cursor = (i + 1) % this.workers.length
      Promise.resolve()
        .then(() => this.workers[i](job))
        .then(resolve, reject)
        .finally(() => {
          this.busy[i] = false
          this.pump()
        })
    }
  }
}
