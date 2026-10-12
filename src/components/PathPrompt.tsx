import type { PathPrompt as Prompt } from '../learning-paths'

export default function PathPrompt({ prompt }: { prompt: Prompt }) {
  return <details className="senior-extension">
    <summary>Senior focus: {prompt.title}</summary>
    <p className="helper">Optional discussion practice. It doesn’t change your grade or review schedule.</p>
    <p>{prompt.prompt}</p>
    <h3>Reasoning rubric</h3><ul>{prompt.rubric.map(item => <li key={item}>{item}</li>)}</ul>
    <details><summary>One defensible discussion</summary><p>{prompt.discussion}</p></details>
  </details>
}
