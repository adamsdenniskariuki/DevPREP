/** Renders plain prompt text: blank lines split paragraphs, "- " lines become a list. */
export default function TextBlocks({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    return lines.every(line => line.startsWith('- '))
      ? <ul key={index}>{lines.map(line => <li key={line}>{line.slice(2)}</li>)}</ul>
      : <p key={index}>{lines.join(' ')}</p>
  })}</>
}
