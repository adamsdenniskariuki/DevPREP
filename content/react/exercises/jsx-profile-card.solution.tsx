type ProfileCardProps = { name: string; title: string; avatarUrl?: string }

export function ProfileCard({ name, title, avatarUrl }: ProfileCardProps) {
  return (
    <div className="profile-card">
      {avatarUrl && <img src={avatarUrl} alt={`${name}'s avatar`} width={48} height={48} />}
      <h2>{name}</h2>
      <p>{title}</p>
    </div>
  )
}

export default function App() {
  return <ProfileCard name="Ada Lovelace" title="Analyst" />
}
