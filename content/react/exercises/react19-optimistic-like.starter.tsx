import { useState } from 'react'

type LikeButtonProps = { initialLikes: number; sendLike: () => Promise<number> }

// TODO: show the +1 immediately with useOptimistic and handle failure.
export function LikeButton({ initialLikes, sendLike }: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes)
  async function like() {
    try {
      setLikes(await sendLike())
    } catch {
      // TODO: roll back and show an alert.
    }
  }
  return <button onClick={like}>Like ({likes})</button>
}

let server = 41
const fakeSend = () => new Promise<number>((resolve, reject) => setTimeout(() => (Math.random() < 0.3 ? reject(new Error('flaky')) : resolve(++server)), 700))

export default function App() {
  return <LikeButton initialLikes={41} sendLike={fakeSend} />
}
