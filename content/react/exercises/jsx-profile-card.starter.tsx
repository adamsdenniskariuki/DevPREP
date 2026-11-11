type ProfileCardProps = { name: string; title: string; avatarUrl?: string }

// TODO: name as a level-2 heading, title in a paragraph,
// and an <img> with alt="<name>'s avatar" only when avatarUrl is given.
export function ProfileCard({ name, avatarUrl }: ProfileCardProps) {
  return (
    <div className="profile-card">
      <img src={avatarUrl} />
      <h3>{name}</h3>
    </div>
  )
}

export default function App() {
  return <ProfileCard name="Ada Lovelace" title="Analyst" />
}
