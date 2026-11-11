import { Channel } from './index'

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export async function testBuffersUpToCapacity() {
  const ch = new Channel<number>(2)
  await ch.send(1)
  await ch.send(2)
  assertEqual(ch.size, 2)
  assertEqual(await ch.receive(), 1)
  assertEqual(await ch.receive(), 2)
}

export async function testSenderWaitsWhenFull() {
  const ch = new Channel<string>(1)
  await ch.send('a')
  let sent = false
  const pending = ch.send('b').then(() => { sent = true })
  await tick()
  assertEqual(sent, false)
  assertEqual(ch.size, 1)
  assertEqual(await ch.receive(), 'a')
  await pending
  assertEqual(sent, true)
  assertEqual(await ch.receive(), 'b')
}

export async function testReceiverWaitsForSend() {
  const ch = new Channel<number>(1)
  const value = ch.receive()
  await tick()
  await ch.send(42)
  assertEqual(await value, 42)
  assertEqual(ch.size, 0)
}

export async function testKeepsOrderAcrossWaitingSenders() {
  const ch = new Channel<number>(1)
  const sends = [1, 2, 3, 4].map(n => ch.send(n))
  const got: number[] = []
  for (let i = 0; i < 4; i++) got.push(await ch.receive())
  await Promise.all(sends)
  assertEqual(got, [1, 2, 3, 4])
}

export async function testProducerIsPacedByConsumer() {
  const ch = new Channel<number>(2)
  let produced = 0
  const producer = (async () => { for (let i = 0; i < 10; i++) { await ch.send(i); produced++ } })()
  await tick()
  assert(produced <= 3, `producer ran ahead: ${produced}`)
  for (let i = 0; i < 10; i++) await ch.receive()
  await producer
  assertEqual(produced, 10)
}
