import type { PathPrompt as Prompt } from './learning-paths'

export default function PathPrompt({ prompt }: { prompt: Prompt }) {
  return <details className="senior-extension">
    <summary>Senior focus: {prompt.title}</summary>
    <p className="helper">Optional discussion practice, not a separate lesson or grade. Add labeled notes to your session notebook before finishing if useful. Your original core task and review schedule are unchanged.</p>
    <p>{prompt.prompt}</p>
    <h3>Reasoning rubric</h3><ul>{prompt.rubric.map(item => <li key={item}>{item}</li>)}</ul>
    <details><summary>One defensible discussion</summary><p>{prompt.discussion}</p></details>
  </details>
}
