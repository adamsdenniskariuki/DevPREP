export class Channel<T> {
  private buffer: T[] = []
  private receivers: Array<(value: T) => void> = []

  constructor(readonly capacity: number) {}

  get size(): number {
    return this.buffer.length
  }

  async send(value: T): Promise<void> {
    // TODO: wait when the buffer is full.
    const receiver = this.receivers.shift()
    if (receiver) receiver(value)
    else this.buffer.push(value)
  }

  receive(): Promise<T> {
    if (this.buffer.length) return Promise.resolve(this.buffer.shift()!)
    return new Promise(resolve => this.receivers.push(resolve))
  }
}
