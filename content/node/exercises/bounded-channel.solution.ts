interface Sender<T> { value: T; resolve: () => void }

export class Channel<T> {
  private buffer: T[] = []
  private receivers: Array<(value: T) => void> = []
  private senders: Array<Sender<T>> = []

  constructor(readonly capacity: number) {}

  get size(): number {
    return this.buffer.length
  }

  send(value: T): Promise<void> {
    const receiver = this.receivers.shift()
    if (receiver) {
      receiver(value)
      return Promise.resolve()
    }
    if (this.buffer.length < this.capacity) {
      this.buffer.push(value)
      return Promise.resolve()
    }
    return new Promise(resolve => this.senders.push({ value, resolve }))
  }

  receive(): Promise<T> {
    if (this.buffer.length) {
      const value = this.buffer.shift()!
      const sender = this.senders.shift()
      if (sender) {
        this.buffer.push(sender.value)
        sender.resolve()
      }
      return Promise.resolve(value)
    }
    const sender = this.senders.shift()
    if (sender) {
      sender.resolve()
      return Promise.resolve(sender.value)
    }
    return new Promise(resolve => this.receivers.push(resolve))
  }
}
