import { describe, expect, it } from 'vitest'
import { lessons } from '../curriculum'

const text = (id: string) => JSON.stringify(lessons.find(lesson => lesson.id === id))
const round = (value: number, digits: number) => value.toFixed(digits)
const grouped = (value: number) => value.toLocaleString('en-US')
const softmax = (xs: number[]) => {
  const exps = xs.map(Math.exp)
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(x => x / sum)
}

describe('AI/LLM and ML system design authored numerical examples', () => {
  it('computes scaled dot-product attention and the KV cache size', () => {
    const q = [1, 0, 1, 0]
    const keys = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0]]
    const values = [[1, 0], [0, 1], [1, 1]]
    const weights = softmax(keys.map(k => k.reduce((sum, x, i) => sum + x * q[i], 0) / Math.sqrt(4)))
    const output = [0, 1].map(d => weights.reduce((sum, w, i) => sum + w * values[i][d], 0))
    const body = text('ai-transformers-attention')
    for (const w of weights) expect(body).toContain(round(w, 4))
    for (const o of output) expect(body).toContain(round(o, 4))
    const bytes = 2 * 32 * 8 * 128 * 4096 * 2
    expect(body).toContain(grouped(bytes))
    expect(bytes / 2 ** 20).toBe(512)
  })

  it('computes cosine similarity and embedding storage', () => {
    const body = text('ai-tokenization-embeddings')
    expect(body).toContain(round(8 / 9, 4))
    expect(body).toContain(String(10e6 * 768 * 4 / 1e9))
  })

  it('counts LoRA trainable parameters against a full matrix', () => {
    const d = 4096, r = 8
    const body = text('ai-fine-tuning-lora')
    expect(body).toContain(grouped(2 * d * r))
    expect(body).toContain(grouped(d * d))
    expect(body).toContain(grouped(2 * d * r * 2 * 32))
  })

  it('computes a pass-rate confidence interval and compounding agent failure', () => {
    const half = 1.96 * Math.sqrt(0.85 * 0.15 / 200) * 100
    expect(text('ai-evals')).toContain(round(half, 1))
    expect(Math.ceil(1.96 ** 2 * 0.85 * 0.15 / 0.02 ** 2)).toBe(1225)
    expect(text('ai-agents-tools')).toContain(round(0.95 ** 10, 3))
    expect(text('ai-agents-tools')).toContain(round(0.9 ** (1 / 10), 4))
  })

  it('computes reciprocal rank for the RAG retrieval example', () => {
    expect((1 / 2 + 1 + 1 / 4 + 0 + 1) / 5).toBeCloseTo(0.55, 10)
    expect(text('ai-rag')).toContain('0.55')
  })

  it('computes NDCG@5 with exponential gain and log2 discount', () => {
    const dcg = (grades: number[]) => grades.slice(0, 5).reduce((sum, rel, i) => sum + (2 ** rel - 1) / Math.log2(i + 2), 0)
    const actual = dcg([3, 2, 3, 0, 1, 2])
    const ideal = dcg([3, 3, 2, 2, 1, 0])
    const body = text('ml-search-ranking')
    expect(body).toContain(round(actual, 3))
    expect(body).toContain(round(ideal, 3))
    expect(body).toContain(round(actual / ideal, 3))
  })

  it('counts multilayer perceptron parameters and the softmax cross-entropy', () => {
    const body = text('ml-neural-networks')
    expect(body).toContain(grouped(784 * 128 + 128 + 128 * 10 + 10))
    expect(body).toContain(round(-Math.log(softmax([2, 1, 0])[0]), 3))
  })
})
