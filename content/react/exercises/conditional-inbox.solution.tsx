export type Message = { id: string; subject: string; read: boolean }

export function Inbox({ messages }: { messages: Message[] }) {
  const unread = messages.filter(message => !message.read).length
  return (
    <section>
      <h2>Inbox</h2>
      {messages.length === 0 ? (
        <p>No messages</p>
      ) : (
        <>
          {unread > 0 && <p>You have {unread} unread {unread === 1 ? 'message' : 'messages'}</p>}
          <ul>
            {messages.map(message => <li key={message.id}>{message.subject}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}

export default function App() {
  return <Inbox messages={[{ id: 'a', subject: 'Welcome', read: false }, { id: 'b', subject: 'Receipt', read: true }]} />
}
