import { startTransition, useOptimistic, useState } from 'react'

type LikeButtonProps = { initialLikes: number; sendLike: () => Promise<number> }

export function LikeButton({ initialLikes, sendLike }: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes)
  const [error, setError] = useState('')
  const [optimisticLikes, addOptimistic] = useOptimistic(likes, (current, delta: number) => current + delta)

  function like() {
    setError('')
    startTransition(async () => {
      addOptimistic(1)
      try {
        const saved = await sendLike()
        startTransition(() => setLikes(saved))
      } catch {
        startTransition(() => setError('Could not save your like.'))
      }
    })
  }

  return (
    <div>
      <button onClick={like}>Like ({optimisticLikes})</button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

let server = 41
const fakeSend = () => new Promise<number>((resolve, reject) => setTimeout(() => (Math.random() < 0.3 ? reject(new Error('flaky')) : resolve(++server)), 700))

export default function App() {
  return <LikeButton initialLikes={41} sendLike={fakeSend} />
}
