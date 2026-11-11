export type Message = { id: string; subject: string; read: boolean }

export function Inbox({ messages }: { messages: Message[] }) {
  const unread = messages.filter(message => !message.read).length
  // TODO: fix the stray 0, pluralise and handle an empty inbox.
  return (
    <section>
      <h2>Inbox</h2>
      {unread && <p>You have {unread} unread messages</p>}
      <ul>
        {messages.map(message => <li>{message.subject}</li>)}
      </ul>
    </section>
  )
}

export default function App() {
  return <Inbox messages={[{ id: 'a', subject: 'Welcome', read: false }, { id: 'b', subject: 'Receipt', read: true }]} />
}
