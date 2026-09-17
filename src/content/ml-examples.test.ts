import { describe, expect, it } from 'vitest'
import { mlLessons } from './ml'

function lesson(id: string) {
  const found = mlLessons.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Missing ML example: ${id}`)
  return found
}

function example(id: string) {
  return lesson(id).example
}

function confusion(scores: number[], labels: number[], threshold: number) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  scores.forEach((score, index) => {
    if (score >= threshold) {
      if (labels[index] === 1) tp++
      else fp++
    } else if (labels[index] === 1) fn++
    else tn++
  })
  return { tp, fp, fn, tn }
}

describe('ML authored numerical examples', () => {
  it('fits the preparation statistics only on the authored training values', () => {
    const text = example('ml-data-preparation')
    expect(text).toContain('Training response times are [2, 4, 6] hours; validation contains [100] hours.')
    const training = [2, 4, 6]
    const mean = training.reduce((sum, value) => sum + value, 0) / training.length
    const variance = training.reduce((sum, value) => sum + (value - mean) ** 2, 0) / training.length
    const standardized = (6 - mean) / Math.sqrt(variance)
    expect(mean).toBe(4)
    expect(variance).toBeCloseTo(8 / 3)
    expect(standardized).toBeCloseTo(1.224745, 6)
    expect(text).toContain(`Standardized training value 6 = (6 - 4) / sqrt(8/3) = ${standardized.toFixed(6)}.`)
    expect(text).toContain('population variance = 8/3 hours squared')
    const leakedMean = [...training, 100].reduce((sum, value) => sum + value, 0) / 4
    expect(text).toContain(`Including validation would change the mean to ${leakedMean} hours.`)
  })

  it('checks the preserved fraud example confusion counts and baseline', () => {
    const text = example('ml-evaluation-leakage')
    expect(text).toContain('1000 transactions, of which 40 are actually fraudulent')
    expect(text).toContain('It flags 50 transactions: 30 are fraud and 20 are legitimate.')
    const tp = 30
    const fp = 50 - tp
    const fn = 40 - tp
    const tn = 1000 - tp - fp - fn
    expect(text).toContain(`True positives = ${tp}; false positives = ${fp}; false negatives = ${fn}; true negatives = ${tn}.`)
    expect(text).toContain(`Precision = 30 / 50 = ${(100 * tp) / (tp + fp)}%.`)
    expect(text).toContain(`Recall = 30 / 40 = ${(100 * tp) / (tp + fn)}%.`)
    expect(text).toContain(`Accuracy = 970 / 1000 = ${(100 * (tp + tn)) / 1000}%.`)
    expect(text).toContain(`always-legitimate classifier has ${(100 * 960) / 1000}% accuracy but 0% recall`)
  })

  it('keeps the preserved ticket exercise arithmetic consistent with its solution', () => {
    const { task, solution } = lesson('ml-evaluation-leakage')
    expect(task).toContain('2000 tickets with 100 actual escalations')
    expect(task).toContain('160 are flagged: 80 actual escalations and 80 non-escalations')
    const counts = { tp: 80, fp: 80, fn: 100 - 80, tn: 1900 - 80 }
    expect(solution).toContain(`True positives = ${counts.tp}; false positives = ${counts.fp}; false negatives = ${counts.fn}; true negatives = ${counts.tn}.`)
    expect(solution).toContain(`Precision = 80 / 160 = ${(100 * counts.tp) / 160}%.`)
    expect(solution).toContain(`Recall = 80 / 100 = ${(100 * counts.tp) / 100}%.`)
    expect(solution).toContain(`Accuracy = (80 + 1820) / 2000 = ${(100 * (counts.tp + counts.tn)) / 2000}%.`)
    expect(160).toBeGreaterThan(100)
  })

  it('computes regression metrics with the authored residual direction and units', () => {
    const text = example('ml-regression-classification')
    expect(text).toContain('actual = [2, 4, 8] hours; predicted = [3, 5, 6] hours.')
    const actual = [2, 4, 8]
    const predicted = [3, 5, 6]
    const residuals = predicted.map((value, index) => value - actual[index])
    expect(residuals).toEqual([1, 1, -2])
    expect(text).toContain(`Residuals = [${residuals.join(', ')}] hours.`)
    const mae = residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length
    const mse = residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length
    expect(mae).toBeCloseTo(4 / 3)
    expect(mse).toBe(2)
    expect(text).toContain('MAE = (1 + 1 + 2) / 3 = 4/3 hours.')
    expect(text).toContain(`MSE = (1 + 1 + 4) / 3 = ${mse} hours squared.`)
    expect(text).toContain(`RMSE = sqrt(2) = ${Math.sqrt(mse).toFixed(6)} hours.`)
  })

  it('uses natural logs and the observed label in binary probability loss', () => {
    const text = example('ml-regression-classification')
    const p = 0.8
    expect(text).toContain(`positive label assigned p = ${p} has log loss -ln(0.8) = ${(-Math.log(p)).toFixed(6)}.`)
    expect(text).toContain(`negative label assigned p = ${p} has log loss -ln(0.2) = ${(-Math.log(1 - p)).toFixed(6)}.`)
    expect(-Math.log(1 - p)).toBeGreaterThan(-Math.log(p))
    const stretch = lesson('ml-regression-classification').extraPractice.find((practice) => practice.id === 'stretch')!
    expect(stretch.prompt).toContain('Model A predicts [0.6, 0.4]; model B predicts [0.9, 0.1]')
    expect(stretch.solution).toContain(`about ${(-Math.log(0.6)).toFixed(6)}`)
    expect(stretch.solution).toContain(`about ${(-Math.log(0.9)).toFixed(6)}`)
  })

  it('checks the halved squared-loss gradient, regularization, and overshoot', () => {
    const text = example('ml-optimization-regularization')
    expect(text).toContain('x = 2, target y = 4, weight w = 1, and no intercept.')
    const x = 2
    const y = 4
    const w = 1
    const loss = (weight: number) => 0.5 * (weight * x - y) ** 2
    const gradient = (w * x - y) * x
    const next = w - 0.1 * gradient
    expect(loss(w)).toBe(2)
    expect(gradient).toBe(-4)
    expect(next).toBe(1.4)
    expect(loss(next)).toBeCloseTo(0.72)
    expect(text).toContain(`Gradient g = (w*x - y)*x = ${gradient}.`)
    expect(text).toContain(`w_next = 1 - 0.1*(-4) = ${next}.`)
    expect(text).toContain(`new data objective = 0.5*(2.8 - 4)^2 = ${loss(next).toFixed(2)}.`)
    const lambda = 0.5
    const penalizedGradient = gradient + lambda * w
    expect(text).toContain(`total gradient = -4 + 0.5*1 = ${penalizedGradient}; w_next = ${w - 0.1 * penalizedGradient}.`)
    const overshot = w - gradient
    expect(text).toContain(`learning rate 1, w_next = ${overshot} and data objective = ${loss(overshot)}`)
    // A finite difference independently checks the supplied analytic derivative.
    const epsilon = 1e-5
    expect((loss(w + epsilon) - loss(w - epsilon)) / (2 * epsilon)).toBeCloseTo(gradient, 7)
  })

  it('shows why the regularized objective can improve while data fit worsens', () => {
    const stretch = lesson('ml-optimization-regularization').extraPractice.find((practice) => practice.id === 'stretch')!
    expect(stretch.prompt).toContain('x = 2, y = 4, w = 2')
    expect(stretch.prompt).toContain('lambda = 0.5 and take a step of 0.1')
    const next = 2 - 0.1 * (0 + 0.5 * 2)
    const dataLoss = 0.5 * (next * 2 - 4) ** 2
    const penalty = 0.5 * 0.5 * next ** 2
    expect(stretch.solution).toContain(`new weight is ${next}`)
    expect(stretch.solution).toContain(`data objective is ${dataLoss.toFixed(2)}`)
    expect(stretch.solution).toContain(`total objective is ${(dataLoss + penalty).toFixed(4)}`)
    expect(dataLoss).toBeGreaterThan(0)
    expect(dataLoss + penalty).toBeLessThan(1)
  })

  it('computes weighted Gini reduction without treating it as held-out accuracy', () => {
    const text = example('ml-trees-ensembles')
    const gini = (p: number) => 1 - p ** 2 - (1 - p) ** 2
    const parent = gini(4 / 8)
    const left = gini(3 / 4)
    const right = gini(1 / 4)
    const children = (4 / 8) * left + (4 / 8) * right
    expect(text).toContain('Parent labels: 4 positive, 4 negative.')
    expect(text).toContain('Left child: 3 positive, 1 negative.')
    expect(text).toContain('Right child: 1 positive, 3 negative.')
    expect(text).toContain(`Weighted child Gini = (4/8)*0.375 + (4/8)*0.375 = ${children}.`)
    expect(text).toContain(`Impurity reduction = 0.5 - 0.375 = ${parent - children}.`)
    expect(text).toContain(`training accuracy on these eight examples is 6/8 = ${(100 * 6) / 8}%`)
  })

  it('reproduces k-means assignment, centroid updates, and distortion units', () => {
    const text = example('ml-clustering')
    expect(text).toContain('points are [1, 2, 8, 9] minutes.')
    expect(text).toContain('initial centroids [1, 8] minutes.')
    const points = [1, 2, 8, 9]
    const initial = [1, 8]
    const assignments = points.map((point) =>
      (point - initial[0]) ** 2 <= (point - initial[1]) ** 2 ? 0 : 1,
    )
    expect(assignments).toEqual([0, 0, 1, 1])
    const centroids = initial.map((_, cluster) => {
      const members = points.filter((_, index) => assignments[index] === cluster)
      return members.reduce((sum, value) => sum + value, 0) / members.length
    })
    const distortion = (centers: number[]) =>
      points.reduce((sum, point, index) => sum + (point - centers[assignments[index]]) ** 2, 0)
    expect(text).toContain(`Updated centroids = [${centroids.join(', ')}] minutes.`)
    expect(text).toContain(`Initial within-cluster sum of squared distances = 0 + 1 + 0 + 1 = ${distortion(initial)} minutes squared.`)
    expect(text).toContain(`Updated sum of squared distances = 0.25 + 0.25 + 0.25 + 0.25 = ${distortion(centroids)} minute squared.`)
    expect(text).toContain(`Mean squared distance = 1/4 = ${distortion(centroids) / points.length} minutes squared.`)
    const warmup = lesson('ml-clustering').extraPractice.find((practice) => practice.id === 'warmup')!
    expect(warmup.prompt).toContain('new point at 7 minutes')
    expect(warmup.solution).toContain(`(7 - 8.5)^2 = ${(7 - centroids[1]) ** 2} minutes squared`)
  })

  it('evaluates threshold policies against both error cost and capacity', () => {
    const text = example('ml-imbalance-thresholds')
    const scores = [0.9, 0.8, 0.6, 0.4, 0.3, 0.1]
    const labels = [1, 0, 1, 0, 1, 0]
    expect(text).toContain(`Validation scores in descending order: [${scores.join(', ')}].`)
    expect(text).toContain(`Corresponding labels: [${labels.join(', ')}].`)
    expect(text).toContain('Flag scores >= threshold.')
    for (const threshold of [0.7, 0.5]) {
      const { tp, fp, fn, tn } = confusion(scores, labels, threshold)
      expect(text).toContain(`Threshold ${threshold}: TP=${tp}, FP=${fp}, FN=${fn}, TN=${tn};`)
      expect(text).toContain(`precision=${tp}/${tp + fp}; recall=${tp}/${tp + fn}; flagged=${tp + fp}.`)
    }
    const strict = confusion(scores, labels, 0.7)
    const loose = confusion(scores, labels, 0.5)
    const cost = ({ fp, fn }: ReturnType<typeof confusion>) => 2 * fp + 10 * fn
    expect(text).toContain(`observed cost is $${cost(strict)} at threshold 0.7 and $${cost(loose)} at threshold 0.5`)
    expect(strict.tp + strict.fp).toBeLessThanOrEqual(2)
    expect(loose.tp + loose.fp).toBeGreaterThan(2)
    expect(confusion(scores, labels, 0.6)).toEqual(loose) // Inclusive threshold at an actual score.
    const none = confusion(scores, labels, 1)
    expect(none).toEqual({ tp: 0, fp: 0, fn: 3, tn: 3 })
    expect(none.tp / (none.tp + none.fp)).toBeNaN()
    expect(2 * (1 - 1 / 6)).toBeCloseTo(10 * (1 / 6))
    expect(text).toContain('p = 2/(2+10) = 1/6')
  })

  it('checks the prevalence calculation in the harder threshold exercise', () => {
    const stretch = lesson('ml-imbalance-thresholds').extraPractice.find((practice) => practice.id === 'stretch')!
    expect(stretch.prompt).toContain('true-positive rate 80% and false-positive rate 10%')
    expect(stretch.prompt).toContain('1000 cases with 100 positives versus 10 positives')
    const precision = (positives: number) => {
      const tp = 0.8 * positives
      const fp = 0.1 * (1000 - positives)
      return tp / (tp + fp)
    }
    expect(stretch.solution).toContain(`about ${(100 * precision(100)).toFixed(1)}%`)
    expect(stretch.solution).toContain(`about ${(100 * precision(10)).toFixed(1)}%`)
  })

  it('checks the end-to-end cohort metrics and distinguishes review cost from FP cost', () => {
    const text = example('ml-deployment-monitoring')
    expect(text).toContain('2000 new tickets arrive per day.')
    expect(text).toContain('cohort contains 100 actual escalations.')
    expect(text).toContain('flags 100 tickets: TP=60, FP=40, FN=40, TN=1860.')
    const tp = 60
    const fp = 40
    const fn = 40
    const tn = 1860
    expect(tp + fp + fn + tn).toBe(2000)
    expect(text).toContain(`Precision = 60/100 = ${(100 * tp) / (tp + fp)}%`)
    expect(text).toContain(`recall = 60/100 = ${(100 * tp) / (tp + fn)}%`)
    expect(text).toContain(`accuracy = 1920/2000 = ${(100 * (tp + tn)) / 2000}%`)
    expect(text).toContain('every review costs $2 and each missed escalation costs $20')
    const policyCost = (tp + fp) * 2 + fn * 20
    const baselineCost = (tp + fn) * 20
    expect(text).toContain(`Policy cost = 100*$2 + 40*$20 = $${policyCost} per cohort.`)
    expect(text).toContain(`No-review baseline cost = 100*$20 = $${baselineCost} per cohort.`)
    expect(text).toContain(`Offline difference = $${baselineCost - policyCost}, not proven causal savings.`)
  })
})
