import type { Lesson } from '../curriculum-types'
import { starterLessons } from './starter'

function original(id: string) {
  const lesson = starterLessons.find((candidate) => candidate.id === id)
  if (!lesson) throw new Error(`Missing starter lesson: ${id}`)
  return lesson
}

const evaluation = original('ml-evaluation-leakage')
const biasVariance = original('ml-bias-variance')

export const mlLessons: Lesson[] = [
  {
    id: 'ml-data-preparation',
    track: 'ml',
    title: 'Data preparation: reconstruct what was knowable',
    minutes: 45,
    summary: 'Define the prediction contract, audit data availability, and fit a reproducible preprocessing pipeline without leaking the future.',
    prerequisites: [],
    prerequisiteNotes: 'Start with arithmetic averages, percentages, and the idea of a table with rows and columns. No model training experience is assumed.',
    objectives: [
      'Define a prediction unit, timestamp, target, and outcome window.',
      'Distinguish event time from availability time when constructing features.',
      'Fit imputation and scaling on training data and reuse the fitted state.',
    ],
    concepts: [
      {
        title: 'A row is a decision, not just a record',
        body: 'Define who receives which decision and when. One row represents a ticket at creation, labeled by escalation within seven days. Predicting whether an already open ticket escalates tomorrow is different: accumulated messages are available for that prediction, but not at creation. Record the outcome window and population alongside the schema. A ticket created yesterday is not a negative seven-day example; its label is immature until the observation window elapses.',
      },
      {
        title: 'Availability is stricter than event time',
        body: 'An event dated Monday but ingested Wednesday was unavailable Tuesday. Historical replay needs both event and availability cutoffs, otherwise chronological data can contain future knowledge. Historical escalation counts must include only outcomes known at ticket creation, not every outcome in today’s extraction table. Audit individual timelines before trusting a large join. Identify duplicates and shared customers before splitting; copied messages across windows can exaggerate generalization even without an explicit target column.',
      },
      {
        title: 'Learn preprocessing only from training',
        body: 'Split raw examples first. Fit medians, vocabularies, and scaling statistics on training; persist them with the model. Transform validation and test without refitting. For values 2, 4, and 6 hours, mean is 4 hours and population variance is 8/3 hours squared, giving a scale near 1.633 hours. The value 6 becomes about 1.225 standard units. State the variance convention: sample variance differs. Reserve unknown-category handling and avoid dividing by zero for constant columns.',
      },
      {
        title: 'Missingness and representation are product decisions',
        body: 'Missing income is not zero income; collection may have failed. A training median plus a missingness indicator preserves that distinction, but process changes can make the indicator brittle. Review units, ranges, categories, and missingness by source and time. One-hot encoding represents nominal categories without inventing an ordering; mapping colors to 1, 2, and 3 imposes misleading geometry. Target encoding additionally requires out-of-fold construction for training rows, not merely hiding validation labels.',
      },
    ],
    example: `Training response times are [2, 4, 6] hours; validation contains [100] hours.
Training mean = 4 hours; population variance = 8/3 hours squared; standard deviation = sqrt(8/3) hours.
Standardized training value 6 = (6 - 4) / sqrt(8/3) = 1.224745.
Training-median imputation for a missing value gives 4 hours.
Including validation would change the mean to 28 hours. This is leakage, not evidence that the training pipeline learned a useful improvement.
The validation value remains extreme after transformation; investigate its units and source rather than silently refitting or clipping using the test distribution.`,
    task: 'Prepare creation-time seven-day escalation predictions using ticket timestamps, initial queue/message length, final resolution, and history. Specify rows, mature labels, availability cutoffs, missing/category handling, and stored artifacts. Explain why the example’s combined scaler leaks.',
    starter: `prediction_time = ticket.created_at
raw_train, raw_validation, raw_test = chronological_windows(rows)
# Specify label maturity and as-of joins before fitting.
preprocessor = fit(raw_train)
validation_features = transform(preprocessor, raw_validation)`,
    hints: [
      'A past event can still be unavailable when its ingestion or outcome confirmation happens later.',
      'Separate the rules that define a row from the statistics learned by fitting the preprocessor.',
    ],
    solution: 'Use creation-time rows with completely observed seven-day outcomes at fitting cutoff. Accept initial queue and message length; reject final resolution. Join history only when events and their confirmation were available before creation. Split chronologically and inspect duplicates. Fit medians, scaling, and vocabularies on training only, preserving mean 4 hours rather than 28. Define missingness indicators and an unknown queue category. Store versioned feature definitions, cutoff rules, statistics, vocabulary, and units. Investigate extreme validation values without refitting.',
    checklist: [
      'I specify the prediction timestamp and complete seven-day label window.',
      'I enforce event-time and availability-time cutoffs for historical features.',
      'I fit preprocessing only on training and store its reusable state.',
      'I define missing-value and unseen-category behavior.',
    ],
    pitfalls: [
      'Treating unresolved recent outcomes as negatives creates mislabeled training data.',
      'A chronological split does not repair a future-looking feature join.',
      'Global imputation or feature selection before splitting leaks evaluation information.',
      'Dropping every row with missing fields can silently change the target population.',
    ],
    walkthrough: [
      {
        title: 'Replay one ticket',
        body: 'A ticket opens Tuesday at noon. A prior escalation occurred Monday but was confirmed Wednesday. It must not enter Tuesday’s count. Trace that record through availability filtering into the feature row: one concrete replay can expose assumptions a dataset-wide summary conceals.',
      },
      {
        title: 'Freeze and audit the transformation',
        body: 'Serialize the fitted pipeline and transform a later batch twice to check determinism. Compare offline and serving features for identical recorded inputs. Log missingness and unknown-category rates, not raw messages. Fix mismatches before comparing scores; a sophisticated estimator cannot reliably compensate for inconsistent inputs.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Impute without peeking',
        prompt: 'Training ages are 10, 20, and 30 days. Validation ages are missing and 90 days. What values enter median imputation, and what fills the missing value?',
        hints: ['Use only the three training values to fit.', 'Transformation does not recompute the median for each batch.'],
        solution: 'Fit median 20 days from training only and use it for missing validation age. Retain observed 90 unless a predefined validity rule rejects it. Refitting on validation leaks and changes batch behavior.',
        checklist: ['I obtain a training median of 20 days.', 'I leave fitting separate from validation transformation.'],
      },
      {
        id: 'stretch',
        title: 'Repair a late-arriving history',
        prompt: 'A feature job counts all historical escalations using event timestamps. Outcomes are often confirmed two days later. Propose a repair and one replay test without deleting all historical features.',
        hints: ['Add the time at which the outcome became known.', 'Choose a test case where event and confirmation straddle prediction.'],
        solution: 'Filter event and confirmation times before prediction and version the definition. The Monday event confirmed Wednesday contributes zero on Tuesday. Rebuild using recorded availability history; if that history is missing, disclose the replay limitation and consider a conservative lag or prospective collection instead of claiming perfect fidelity.',
        checklist: ['I enforce two availability conditions.', 'I acknowledge missing historical metadata rather than inventing it.'],
      },
    ],
    followUps: [
      { question: 'Can an unsupervised scaler see test inputs?', answer: 'Not under this held-out protocol: fitting adapts to test distribution. A transductive protocol needs separate justification and deployment alignment.' },
      { question: 'Should every extreme value be removed?', answer: 'No. Verify units and validity first; rare cases may matter. Learn clipping thresholds inside training only.' },
    ],
    takeaways: [
      'Define what was knowable before choosing features.',
      'A mature label and an available feature obey different time constraints.',
      'Persist preprocessing as part of the model, not as an informal notebook step.',
    ],
  },
  {
    ...evaluation,
    minutes: 45,
    prerequisites: ['ml-data-preparation'],
    prerequisiteNotes: 'Use the prediction-time contract and training-only preprocessing from the preceding lesson. Fractions and percentages are sufficient for the metric calculations.',
    concepts: [
      ...evaluation.concepts,
      {
        title: 'Choose the independence assumption deliberately',
        body: 'A random row split estimates performance on exchangeable rows, not automatically on future traffic or unseen customers. For a future-ticket service, use ordered windows and mature labels. If the product instead onboards entirely new organizations, hold organizations out so their writing styles and shared workflows cannot appear on both sides. When both novelty and time matter, evaluate future examples from held-out organizations, while keeping training entirely earlier. This can reduce available data substantially; report the resulting population and uncertainty rather than pretending every splitting goal is free.',
      },
      {
        title: 'Evaluation is a sequence of decisions',
        body: 'Validation is the workspace for comparing features, models, and thresholds. Test is a final audit of the locked decision procedure, including preprocessing and review policy. Repeatedly checking test results while making changes spends that independence even when the test data never enter gradient computation. For scarce labels, cross-validation can help model selection, but temporal folds must move forward and respect label delays, while group folds must preserve groups. Fit preprocessing anew inside each training fold. Average fold metrics only after considering whether fold populations and class prevalence are comparable.',
      },
      {
        title: 'Report denominators and uncertainty',
        body: 'A reported recall of 80% means little without its denominator: eight of ten positives is much less stable than eight thousand of ten thousand. On the original 100-positive ticket validation set, one additional missed escalation changes recall by one percentage point. Correlated tickets from the same customer make independent-row uncertainty calculations optimistic. Use repeated temporal windows or group-aware resampling where appropriate, and present counts alongside rates. A better aggregate score is evidence worth investigating, not a guarantee of benefit for every customer group or future period.',
      },
    ],
    walkthrough: [
      {
        title: 'Build the four cells before dividing',
        body: 'For the ticket task, start with 100 actual positives and 1900 actual negatives. Eighty flagged positives leave 20 false negatives. The other 80 flags are false positives, leaving 1820 true negatives. Now choose each denominator according to the question: 160 inspected tickets for precision, 100 escalations for recall, and all 2000 tickets for accuracy. Writing the cells first avoids switching denominators mid-calculation.',
      },
      {
        title: 'Simulate selection before deployment',
        body: 'Imagine choosing a threshold on July 1. Only validation tickets with fully observed seven-day outcomes by that cutoff may inform the choice. A ticket created June 29 is not ready, even if its eventual label is visible in today’s warehouse. After locking the threshold, replay later traffic under the actual batching and capacity rules. Score that period after its labels mature, and separate the prediction date from the date of the quality report.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Distinguish the denominators',
        prompt: 'A detector flags 20 events, including 12 true positives. There are 30 actual positives among 100 events. Compute precision, recall, and all four cells.',
        hints: ['False positives fill the remainder of the flags.', 'Actual positives include both found and missed cases.'],
        solution: 'TP = 12, FP = 8, FN = 18, TN = 62. Precision is 12/20 = 60%, recall is 12/30 = 40%, and accuracy is 74%. The first rate describes the inspected queue; the second describes coverage of all actual positives.',
        checklist: ['I derive all four counts summing to 100.', 'I distinguish 60% precision from 40% recall.'],
      },
      {
        id: 'stretch',
        title: 'Match a new-organization launch',
        prompt: 'Your ticket service will launch at organizations absent from training next quarter. Customers generate many related tickets, and labels arrive seven days later. Describe a defensible evaluation and its main cost.',
        hints: ['Holding out individual tickets does not hold out organizations.', 'Require both later prediction times and organization separation.'],
        solution: 'Reserve organizations as groups and evaluate their tickets in a later window. Train only on earlier mature tickets from other organizations; tune with separate groups and appropriate earlier windows. Enforce the maturity gap at each simulated selection cutoff. Audit duplicate templates and report organization-level slices. The cost is fewer eligible examples and potentially wider uncertainty; the benefit is an estimate aligned with the intended new-organization population rather than an easier repeat-customer task.',
        checklist: ['I preserve organization boundaries and time order.', 'I state the data-efficiency and uncertainty tradeoff.'],
      },
    ],
    followUps: [
      { question: 'Can we infer a better threshold from one confusion matrix?', answer: 'No. We need scores or counts at additional thresholds. The existing matrix tells us that the current policy exceeds capacity, not which alternative will satisfy quality requirements.' },
      { question: 'Does a seven-day gap always remove every leakage source?', answer: 'No. Seven days addresses the specified outcome window. Late confirmations, overlapping feature windows, duplicated groups, and delayed ingestion require their own checks and may require longer exclusions.' },
    ],
    takeaways: [
      'Choose split boundaries to model the actual deployment population.',
      'Precision and recall answer different operational questions.',
      'Lock the complete decision procedure before the final test audit.',
      'Report counts, maturity rules, and slices with headline metrics.',
    ],
  },
  {
    id: 'ml-regression-classification',
    track: 'ml',
    title: 'Regression and classification: choose a target and a loss',
    minutes: 45,
    summary: 'Connect predictions to continuous or categorical targets, work through baseline metrics, and distinguish a probability from an action.',
    prerequisites: ['ml-evaluation-leakage'],
    prerequisiteNotes: 'Bring held-out evaluation, confusion-matrix reasoning, and arithmetic with squares. Log loss is introduced with a supplied natural-log value.',
    objectives: [
      'Select regression or classification from the target and intended decision.',
      'Calculate MAE, MSE, and RMSE with meaningful units.',
      'Interpret a logistic probability, binary log loss, and a decision threshold separately.',
    ],
    concepts: [
      {
        title: 'The target determines the question',
        body: 'Regression predicts quantities such as resolution hours; classification predicts categories such as seven-day escalation. Expected resolution time does not directly give the probability of exceeding a deadline; uncertainty matters too. Start with a training-fitted baseline: a constant mean for squared error, median for absolute error, or prevalence for probability prediction. Evaluate it using the same split and information contract as complex models.',
      },
      {
        title: 'A loss encodes how mistakes grow',
        body: 'MAE averages absolute residuals, preserving target units. MSE averages squared residuals, emphasizing large misses and producing squared units. RMSE takes the square root of MSE, returning to target units but differing from MAE. For actual times 2, 4, 8 and predictions 3, 5, 6 hours, prediction-minus-actual residuals are 1, 1, -2 hours. MAE is 4/3 hours, MSE is 2 hours squared, and RMSE is sqrt(2) hours.',
      },
      {
        title: 'Linear scores and logistic probabilities',
        body: 'Linear regression combines weighted features and an intercept. Binary logistic regression transforms that score with sigmoid: p = 1 / (1 + exp(-score)). Score zero gives probability 0.5. Probabilities are dimensionless estimates, not individual certainties. Binary log loss is -log(p) for label one and -log(1-p) for label zero, using natural logarithms. Confident mistakes receive large penalties; thresholded accuracy discards this confidence information.',
      },
      {
        title: 'An estimate is not an intervention',
        body: 'A 0.7 escalation probability does not prescribe an action: capacity, error costs, and safeguards matter. Log loss evaluates probabilities; precision and recall evaluate decisions. Calibration asks whether comparable events assigned probabilities near 0.7 occur roughly 70% of the time. Useful ranking need not imply good calibration, but probability-based expected costs require it. Check representative held-out data and avoid interpreting observational weights as causal effects.',
      },
    ],
    example: `Regression: actual = [2, 4, 8] hours; predicted = [3, 5, 6] hours.
Residuals = [1, 1, -2] hours.
MAE = (1 + 1 + 2) / 3 = 4/3 hours.
MSE = (1 + 1 + 4) / 3 = 2 hours squared.
RMSE = sqrt(2) = 1.414214 hours.
Binary classification: a positive label assigned p = 0.8 has log loss -ln(0.8) = 0.223144.
A negative label assigned p = 0.8 has log loss -ln(0.2) = 1.609438.
At threshold 0.5, both probabilities trigger the positive action; their losses depend on the observed label.`,
    task: 'A support team wants estimated resolution hours and a queue of tickets likely to escalate. Explain why these are different targets. Work the regression metrics in the example, compare the two binary losses, and propose one training-only baseline for each target. Describe which held-out metrics would support a limited-capacity review queue and what cannot be concluded from a probability of 0.8 alone.',
    starter: `residual = predicted_hours - actual_hours
mae = mean(abs(residual))
mse = mean(residual * residual)
rmse = sqrt(mse)
action = escalation_probability >= chosen_threshold`,
    hints: [
      'Check units after each operation; squaring an hour error changes its units.',
      'Probability quality and queue quality are related but not interchangeable evaluations.',
    ],
    solution: 'Resolution hours require regression; seven-day escalation requires binary classification. Absolute residuals total 4 hours and squared residuals total 6 hours squared, yielding MAE 4/3, MSE 2, and RMSE sqrt(2) in their respective units. At p = 0.8 the losses are 0.223144 for a positive and 1.609438 for a negative. Fit training-mean and training-prevalence baselines, respectively. Evaluate on the same later window, reporting precision and recall under capacity plus calibration when probabilities guide costs. Probability alone justifies neither calibration nor intervention.',
    checklist: [
      'I distinguish resolution-time regression from escalation classification.',
      'I compute the three regression metrics and retain their units.',
      'I distinguish probability loss from threshold-dependent queue metrics.',
      'I fit baselines on training only.',
    ],
    pitfalls: [
      'MSE and RMSE cannot be compared numerically as though they share units.',
      'A low training loss does not establish performance on future tickets.',
      'A score labeled probability is not automatically calibrated.',
      'Linear model weights describe associations, not intervention effects.',
    ],
    walkthrough: [
      {
        title: 'Check the baseline on the same cases',
        body: 'A frozen training mean of 4 hours gives absolute errors 2, 0, and 4 hours on these cases: MAE 2 hours. The candidate improves to 4/3 hours. Three cases demonstrate arithmetic, not statistical confidence or future superiority.',
      },
      {
        title: 'Choose reporting for the actual user',
        body: 'Report time errors in hours, including tail errors, and escalation counts within staffing limits. Include review volume, precision, and recall. If severe delays have disproportionate consequences, consider a tailored loss or quantile prediction rather than assuming average error captures business cost.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'One large regression miss',
        prompt: 'Two predictions have residuals 0 and 4 hours. Compute MAE and RMSE and explain which is larger.',
        hints: ['Average absolute residuals for MAE.', 'Take the square root after averaging squared residuals.'],
        solution: 'MAE is 2 hours. MSE is 8 hours squared and RMSE is sqrt(8), about 2.828 hours. RMSE is larger because squaring gives the large miss extra influence before returning to hours.',
        checklist: ['I obtain MAE 2 hours and RMSE about 2.828 hours.', 'I explain the order of operations.'],
      },
      {
        id: 'stretch',
        title: 'Same actions, different probabilities',
        prompt: 'Two true labels are [1, 0]. Model A predicts [0.6, 0.4]; model B predicts [0.9, 0.1]. Compare their threshold-0.5 accuracy and mean log loss. What changes if B becomes overconfident on future errors?',
        hints: ['Both models choose the same two classes.', 'For each model the probability assigned to the correct label is the same across these two cases.'],
        solution: 'Both achieve 100% accuracy on these two cases. A has mean log loss -ln(0.6), about 0.510826; B has -ln(0.9), about 0.105361. B assigns more probability to the observed outcomes here. Future confident mistakes could reverse the loss advantage, so evaluate representative held-out cases and calibration rather than generalizing from two successes.',
        checklist: ['I separate identical accuracy from different log losses.', 'I limit the conclusion to the evaluated cases.'],
      },
    ],
    followUps: [
      { question: 'Why might median prediction beat mean prediction on MAE?', answer: 'A median minimizes total absolute error for a constant predictor on the fitting sample; the mean minimizes squared error. Held-out performance still depends on how representative training was.' },
      { question: 'Does lower log loss guarantee higher recall at our capacity?', answer: 'No. Average probability quality and the ordering near a specific review cutoff are different properties; evaluate the chosen capacity-constrained policy directly.' },
    ],
    takeaways: [
      'Choose the target before choosing a model.',
      'Carry units and aggregation conventions through every metric.',
      'Separate probability estimation, threshold choice, and operational value.',
    ],
  },
  {
    id: 'ml-optimization-regularization',
    track: 'ml',
    title: 'Optimization and regularization: control the fit',
    minutes: 50,
    summary: 'Work one gradient update, reason about learning rates and feature scales, and distinguish fitting the training objective from generalizing.',
    prerequisites: ['ml-regression-classification'],
    prerequisiteNotes: 'Know residuals, squared loss, and linear predictions. The required derivative is supplied; no calculus course or training framework is needed.',
    objectives: [
      'Calculate one gradient-descent update using a stated loss convention.',
      'Explain learning-rate and feature-scaling effects on optimization.',
      'Distinguish regularization, early stopping, and held-out model selection.',
    ],
    concepts: [
      {
        title: 'The gradient points uphill',
        body: 'For prediction w*x, objective J = 0.5*(w*x-y)^2 has gradient g = (w*x-y)*x. Gradient descent uses w_next = w - learning_rate*g, subtracting the uphill direction. The factor 0.5 cancels the derivative’s factor two. Unhalved squared error doubles the gradient; compare learning rates only when loss conventions and example reductions agree. A real model’s intercept also needs its own gradient.',
      },
      {
        title: 'A step size is part of a controlled experiment',
        body: 'Small steps can progress slowly; large steps can overshoot and diverge. Feature scale changes curvature, so standardization can help without creating predictive information. Minibatch gradients noisily estimate the full training gradient. Shuffle only eligible training examples and preserve the evaluation protocol. Monitor objective curves, nonfinite values, and seed stability. A stalled optimizer does not prove the dataset lacks learnable signal.',
      },
      {
        title: 'Regularization changes what is optimized',
        body: 'L2 adds 0.5*lambda*w^2 to this objective and lambda*w to its gradient. It favors smaller weights under the chosen scaling, trading fit for possible generalization benefit, not guaranteed fairness or robustness. Document whether intercepts are excluded. L1 can encourage exact zeros with suitable optimization; ordinary L2 generally shrinks weights. Select strength on validation and report predictive loss separately from the penalized training objective.',
      },
      {
        title: 'Early stopping spends validation information',
        body: 'Selecting the best validation checkpoint can restrain overfitting, but repeated selection makes its score optimistic. Reserve test for the frozen choice. Prespecify patience, meaningful improvement, and training budget; save the best checkpoint, not just the last. Isolated validation dips may reflect noise or shift. Compare seeds and slices without mistaking more tuning for new independent evidence.',
      },
    ],
    example: `Use dimensionless standardized x = 2, target y = 4, weight w = 1, and no intercept.
Data objective J = 0.5 * (w*x - y)^2 = 2.
Gradient g = (w*x - y)*x = -4.
With learning rate 0.1, w_next = 1 - 0.1*(-4) = 1.4.
New prediction = 2.8; new data objective = 0.5*(2.8 - 4)^2 = 0.72.
With L2 lambda = 0.5 at the original w, total gradient = -4 + 0.5*1 = -3.5; w_next = 1.35.
With no penalty and learning rate 1, w_next = 5 and data objective = 18: a larger step can be worse.`,
    task: 'Reproduce both updates and explain their signs, overshoot, and why lower training loss does not justify shipping. Design a small learning-rate and regularization experiment, preserving test independence and distinguishing predictive from penalized losses.',
    starter: `prediction = w * x
gradient = (prediction - y) * x
gradient += regularization_strength * w
next_w = w - learning_rate * gradient
# Evaluate predictive validation loss without the weight penalty.`,
    hints: [
      'The L2 gradient is computed at the original weight, not at a weight already updated this step.',
      'A training objective improvement demonstrates optimization progress, not future accuracy.',
    ],
    solution: 'The residual is -2 and gradient -4. Subtracting 0.1 times that gradient gives weight 1.4 and loss 0.72 instead of 2. L2 adds +0.5, yielding gradient -3.5 and weight 1.35. Learning rate 1 overshoots to weight 5, prediction 10, and loss 18. Check stable convergence across a small prespecified rate range, then compare penalty strengths with fixed data, architecture, and budget. Select using unpenalized validation loss; freeze the checkpoint, inspect uncertainty and slices, and evaluate test once.',
    checklist: [
      'I state the halved squared-error objective before taking its gradient.',
      'I derive weights 1.4 and 1.35 under the two update rules.',
      'I explain overshoot using the loss of 18 at learning rate 1.',
      'I keep penalized training objectives distinct from validation predictive losses.',
    ],
    pitfalls: [
      'Forgetting the loss normalization changes the effective learning rate.',
      'Applying the weight penalty twice implements a different optimizer.',
      'Regularizing unscaled features can penalize equivalent effects unequally.',
      'Selecting checkpoints on test data contaminates the final audit.',
    ],
    walkthrough: [
      {
        title: 'Read a learning curve before adding complexity',
        body: 'Exploding loss suggests checking step size, feature magnitude, and nonfinite arithmetic. Flat losses suggest checking gradients and actual parameter updates. Improving training but worsening validation suggests complexity, regularization, or shift. These patterns generate experiments, not unique diagnoses.',
      },
      {
        title: 'Keep the comparisons honest',
        body: 'Record the objective, transform, seed, training window, batch reduction, and checkpoint rule. This toy update uses dimensionless standardized inputs and targets; its loss is not hours squared. In real regression, target scale determines loss units and penalty meaning. Reusing lambda after changing units may not preserve the experiment.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'A zero-gradient check',
        prompt: 'Using the same x = 2 and y = 4 with no penalty, evaluate the gradient at w = 2. What happens after a learning-rate-0.1 step?',
        hints: ['Compute the prediction before the gradient.', 'A perfect fit has zero residual in this single-example objective.'],
        solution: 'Prediction is 4, residual is zero, gradient is zero, and the weight remains 2. This is a useful implementation check for the unregularized update, not a guarantee of an optimum for any other dataset or penalized objective.',
        checklist: ['I obtain a zero gradient and unchanged weight.', 'I qualify the result by the specified objective.'],
      },
      {
        id: 'stretch',
        title: 'Why shrink a perfect fit?',
        prompt: 'At x = 2, y = 4, w = 2, add L2 lambda = 0.5 and take a step of 0.1. Compute the new data and total objectives and compare with the original total objective.',
        hints: ['At the original weight only the penalty contributes to the gradient.', 'Add 0.5*lambda*w^2 to the data objective at each weight.'],
        solution: 'The gradient is 1, so the new weight is 1.9. Prediction is 3.8 and data objective is 0.02. The new penalty is 0.25*1.9^2 = 0.9025, so total objective is 0.9225, below the original total of 1. The data fit worsens while the penalized objective improves. This is exactly the tradeoff being optimized, not an arithmetic contradiction.',
        checklist: ['I derive weight 1.9 and total objective 0.9225.', 'I explain why data loss can rise while total loss falls.'],
      },
    ],
    followUps: [
      { question: 'Does regularization always improve validation?', answer: 'No. Excess penalties underfit; useful strength depends on scaling, data, and model. Measure rather than assume improvement.' },
      { question: 'Is one checkpoint conclusive?', answer: 'No. Noise and repeated selection matter. Prespecify the search, check stability, and preserve test independence.' },
    ],
    takeaways: [
      'Specify the objective and units before computing a gradient.',
      'Learning rate controls whether a local direction produces a useful step.',
      'Regularization trades training fit against a preference for simpler parameters.',
      'Optimization success and generalization success require different evidence.',
    ],
  },
  {
    ...biasVariance,
    minutes: 45,
    prerequisites: ['ml-optimization-regularization'],
    prerequisiteNotes: 'Use comparable held-out losses and the distinction between optimization and regularization. Formal statistical bias-variance decomposition is not required.',
    concepts: [
      ...biasVariance.concepts,
      {
        title: 'Design a diagnostic that could prove you wrong',
        body: 'A useful hypothesis predicts an observable change. If optimization failure explains a high training error, fixing an excessive learning rate or increasing a clearly insufficient training budget should lower that error under the same objective. If weak features explain the plateau, merely training longer may not help. State a stopping rule and a meaningful improvement before running the experiment. Changing architecture, data, regularization, and threshold together might improve the product, but it gives little evidence about which intervention mattered or which one to try next.',
      },
      {
        title: 'Hold the comparison population fixed',
        body: 'A learning curve varies training size while evaluating on the same held-out examples. Otherwise a lower validation error could reflect an easier window rather than a better model. For chronological data, sample eligible history without slipping later examples into an earlier training cutoff. Record the training population as well as its size: adding twenty thousand near-duplicates is not the same intervention as adding representative new cases. Inspect error by time and user group, because a shrinking aggregate gap can coexist with a worsening minority slice.',
      },
      {
        title: 'Separate practical diagnosis from formal decomposition',
        body: 'The numerical training-validation gap is not statistical variance. A formal decomposition depends on a loss, a data-generating distribution, and behavior across possible training samples; three observed error pairs do not identify those quantities. Label noise, distribution shift, finite-sample uncertainty, and selection bias can all affect the observed gap. Use high bias and high variance as shorthand for testable patterns, not as precise measurements extracted from a dashboard. Better explanations preserve uncertainty while still recommending a concrete next experiment.',
      },
    ],
    walkthrough: [
      {
        title: 'Compare gaps in percentage points',
        body: 'Subtract training error from validation error: 20 minus 19 is one percentage point, 13 minus 1 is twelve points, and 9 minus 6 is three points. These are differences in rates, not relative percentage improvements. The regularized candidate has the best observed validation error, even though its training error is worse than the larger unregularized model. That is a reason for provisional selection, not final readiness.',
      },
      {
        title: 'Add a falsifiable slice check',
        body: 'Suppose the selected candidate has 9% error overall but a small new-customer slice has 18%. First report its denominator and compare the baseline on the same slice. Investigate missing history, unfamiliar queues, and annotation differences. Define an acceptable slice error with the product owner before more tuning. A representative-data experiment should be judged on both overall improvement and this prespecified slice, not solely on the headline target.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Percentage points versus relative change',
        prompt: 'Validation error falls from 12% to 9%. Express both the percentage-point reduction and the relative error reduction. Does either quantify statistical variance?',
        hints: ['Subtract the rates for percentage points.', 'Divide the reduction by the original error for a relative change.'],
        solution: 'The reduction is three percentage points. Relative error reduction is (12 - 9)/12 = 25%. Neither number measures statistical variance; each summarizes two observed error rates under the evaluation protocol.',
        checklist: ['I distinguish three points from 25%.', 'I avoid interpreting either as a variance estimate.'],
      },
      {
        id: 'stretch',
        title: 'An alternative explanation for a large gap',
        prompt: 'A model has training error 2% and validation error 20%. Validation comes from a newly onboarded organization with a different ticket taxonomy. Propose two controlled checks before increasing regularization.',
        hints: ['Check whether feature categories and labels mean the same thing.', 'Compare errors within a matched population when possible.'],
        solution: 'First audit label definitions and unknown-category rates for the new organization using a small reviewed sample; semantic mismatch may explain apparent model failure. Second evaluate fixed models on a later window from existing organizations and separately on the new organization, keeping metric definitions constant. A gap isolated to the new population supports a shift hypothesis. Additional regularization may still help, but its benefit must be measured rather than inferred from the aggregate gap alone.',
        checklist: ['I test taxonomy and feature compatibility.', 'I compare fixed models across explicitly named populations.'],
      },
    ],
    followUps: [
      { question: 'Should we always collect more data when validation error is high?', answer: 'No. Learning curves and error analysis can reveal a plateau, label defects, missing information, or optimization failure. Collecting more of the same data may reproduce the same limitations.' },
      { question: 'Why not choose the smallest generalization gap?', answer: 'A model that predicts the majority class everywhere can have a small gap and poor usefulness. Consider absolute quality, constraints, uncertainty, and slices alongside the gap.' },
    ],
    takeaways: [
      'Treat observed patterns as hypotheses, not unique diagnoses.',
      'Change one factor and define success before measuring.',
      'Hold evaluation examples and metrics fixed for learning-curve comparisons.',
      'A provisional validation winner still needs an independent readiness audit.',
    ],
  },
  {
    id: 'ml-trees-ensembles',
    track: 'ml',
    title: 'Trees and ensembles: combine simple decisions',
    minutes: 45,
    summary: 'Interpret a tree split numerically, contrast bagging with boosting, and choose complexity under evaluation and serving constraints.',
    prerequisites: ['ml-bias-variance'],
    prerequisiteNotes: 'Know classification proportions, held-out model selection, and the difference between underfitting and overfitting hypotheses. Tree impurity is introduced from first principles.',
    objectives: [
      'Compute parent and weighted child Gini impurity for a proposed split.',
      'Explain how bagging and boosting address different modeling problems.',
      'Choose tree and ensemble controls without confusing feature importance with causality.',
    ],
    concepts: [
      {
        title: 'A tree asks a sequence of questions',
        body: 'Trees partition examples with rules such as message length exceeding a threshold. Leaves store predictions from their training examples. Branches capture interactions: long messages might indicate risk only in one queue. Binary Gini impurity is 1 - p*p - (1-p)*(1-p), where p is positive proportion. Pure leaves have zero impurity; evenly mixed leaves have 0.5. Greedy local splits do not guarantee a globally optimal tree.',
      },
      {
        title: 'Weight children by how many examples they contain',
        body: 'Four positives and four negatives give parent impurity 0.5. Splitting into children with counts 3/1 and 1/3 gives each impurity 0.375. Equal child sizes yield weighted impurity 0.375 and reduction 0.125. With unequal sizes, a tiny pure leaf must count less than a large mixed leaf. This reduction is a training criterion, not held-out accuracy improvement or a probability of business success.',
      },
      {
        title: 'Bagging reduces dependence on a particular sample',
        body: 'Bagging averages models fitted to bootstrap samples. Random forests additionally consider random feature subsets at splits, reducing correlation between trees. Averaging unstable trees can reduce variance, but perfectly correlated errors gain little. Tune depth, minimum leaf size, and feature subsampling on validation. Out-of-bag estimates can suit exchangeable data but do not automatically enforce chronology, label maturity, or organization separation. Preserve a deployment-aligned holdout.',
      },
      {
        title: 'Boosting adds corrections sequentially',
        body: 'Boosting sequentially adds learners to improve a specified loss. For squared error, negative gradients correspond to residuals: later trees correct current misses rather than independently voting. Learning rate, rounds, leaf complexity, and subsampling control fit. Smaller rates often need more rounds and serving work. Use validation early stopping, preserving test independence. Neither ensemble technique repairs leakage or guarantees superiority over a linear baseline.',
      },
    ],
    example: `Parent labels: 4 positive, 4 negative. Gini = 1 - 0.5^2 - 0.5^2 = 0.5.
Left child: 3 positive, 1 negative. Gini = 1 - 0.75^2 - 0.25^2 = 0.375.
Right child: 1 positive, 3 negative. Gini = 0.375.
Weighted child Gini = (4/8)*0.375 + (4/8)*0.375 = 0.375.
Impurity reduction = 0.5 - 0.375 = 0.125.
If each leaf predicts its majority label, training accuracy on these eight examples is 6/8 = 75%; predicting one class at the parent gives 50%.
Neither number estimates future accuracy without a separate evaluation.`,
    task: 'Explain and calculate the proposed split. A deep tree fits training almost perfectly but performs poorly on future tickets. Compare a shallower tree, a random forest, and boosted shallow trees as experiments. Specify what to hold fixed, which knobs to tune, and how latency, calibration, and feature availability enter the choice.',
    starter: `gini(positive, negative):
  total = positive + negative
  p = positive / total
  return 1 - p*p - (1-p)*(1-p)
weighted_children = sum(child_count / parent_count * child_gini)`,
    hints: [
      'Compute child class proportions locally, then weight their impurities by child size.',
      'An ensemble choice changes both the statistical experiment and the serving budget.',
    ],
    solution: 'Parent impurity is 0.5, child impurities 0.375, and weighted reduction 0.125; majority leaves correctly label six training examples. Verify feature availability and chronology first. Compare reduced depth or larger leaves, a forest with controlled tree count and subsampling, and boosted shallow trees with a fixed rate/rounds budget. Hold data and evaluation policies fixed. Measure held-out quality under capacity, calibration, model size, and realistic latency. Reject unavailable features regardless of training importance.',
    checklist: [
      'I compute the weighted Gini reduction as 0.125.',
      'I distinguish independent bagged fits from sequential boosting corrections.',
      'I name complexity controls and compare on an unchanged holdout.',
      'I include prediction cost and feature availability in selection.',
    ],
    pitfalls: [
      'An unweighted average of unequal children gives the wrong split criterion.',
      'A pure training leaf with one example provides weak evidence of future certainty.',
      'Out-of-bag scoring does not enforce the product’s time and group constraints.',
      'Impurity-based importance can favor high-cardinality features and does not show causality.',
    ],
    walkthrough: [
      {
        title: 'Translate a branch into a serving dependency',
        body: 'Messages before closure may create a pure leaf but are unavailable at creation. Trace split variables to serving-time sources. Readable rules still encode leakage or problematic proxies when input semantics are misunderstood.',
      },
      {
        title: 'Compare quality at a fixed resource budget',
        body: 'If a tree meets latency but misses recall, while an ensemble improves recall but exceeds latency, test smaller ensembles and shallower trees. Include preprocessing and memory costs. A weaker offline score may be preferable when it permits reliable decisions within the response deadline.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Unequal leaves',
        prompt: 'A parent has six examples. One child contains two positives only; the other contains two positives and two negatives. Compute weighted child impurity.',
        hints: ['The pure child contributes zero impurity.', 'The mixed child carries four sixths of the weight.'],
        solution: 'The pure child has Gini zero. The balanced four-example child has Gini 0.5. Weighted impurity is (2/6)*0 + (4/6)*0.5 = 1/3, not the unweighted average 0.25.',
        checklist: ['I obtain weighted impurity 1/3.', 'I use example counts as weights.'],
      },
      {
        id: 'stretch',
        title: 'Interrogate an importance claim',
        prompt: 'A forest ranks customer identifier as its most important feature. Someone concludes that changing a customer’s identifier will reduce escalation risk. Explain two problems and design a diagnostic.',
        hints: ['Association is not an intervention effect.', 'Identifiers can enable memorization across repeated entities.'],
        solution: 'An identifier can partition training customers without representing a causal mechanism; changing its string does not change their needs. High cardinality can also make impurity importance misleading. Compare a fixed model without identifiers using chronological and new-customer slices, and consider held-out permutation importance with awareness of correlated features. Preserve organization grouping where deployment requires it. A performance drop after removal shows predictive dependence under the test, not a causal effect of changing identifiers.',
        checklist: ['I reject the causal interpretation.', 'I test memorization using an evaluation aligned with customer novelty.'],
      },
    ],
    followUps: [
      { question: 'Must tree inputs be standardized?', answer: 'Ordinary threshold trees are generally insensitive to monotonic rescaling of individual numeric features, but preprocessing still needs correct units, missing-value handling, and training-only fitting. Distance-based models later in the track have stronger scaling needs.' },
      { question: 'Can more trees always fix overfitting?', answer: 'No. Averaging may stabilize a forest, while extra boosting rounds can overfit. Correlated errors, shift, labels, and feature quality remain limiting factors.' },
    ],
    takeaways: [
      'Tree splits reduce a weighted training impurity, not necessarily deployment error.',
      'Bagging averages variability; boosting adds sequential corrections.',
      'Tune complexity against held-out quality and real serving constraints.',
    ],
  },
  {
    id: 'ml-clustering',
    track: 'ml',
    title: 'Clustering: discover structure without inventing labels',
    minutes: 45,
    summary: 'Work a k-means iteration, inspect the geometry induced by features, and validate usefulness without pretending clusters are ground truth.',
    prerequisites: ['ml-trees-ensembles'],
    prerequisiteNotes: 'Use training-only preprocessing and squared-distance arithmetic. No linear algebra is required beyond averaging coordinates.',
    objectives: [
      'Perform assignment and centroid-update steps for a small k-means example.',
      'Explain how scaling, outliers, and cluster shape affect the result.',
      'Validate cluster stability and operational usefulness without claiming discovered labels.',
    ],
    concepts: [
      {
        title: 'Similarity is a modeling choice',
        body: 'Clustering groups examples by a representation and similarity rule, usually without target labels. It can organize ticket themes, but clusters are not automatically escalation classes or causal segments. Distance on message length asks a different question from distance on text embeddings, which themselves have learned limitations. Define useful similarity for the workflow and inspect representative and boundary examples before naming groups.',
      },
      {
        title: 'K-means alternates two simple operations',
        body: 'Choose k centroids, assign points to the nearest centroid by squared Euclidean distance, and update each centroid to its assigned points’ mean. Repeat until stable. Exact assignment and mean updates do not increase the objective on fixed data, but initialization can produce different local solutions. Define empty-cluster reinitialization and tie handling. More clusters permit lower training distortion, so minimizing distortion alone cannot choose meaningful k.',
      },
      {
        title: 'Geometry explains both strength and failure',
        body: 'K-means favors compact Euclidean groups; curved shapes, unequal density, and outliers can defeat that geometry. Dollars may dominate a 0-to-1 feature unless scaling is addressed. Training-fitted standardization can help but changes distance meaning: a high-variance feature might legitimately deserve influence. Choose scaling for the task, not blindly. Alternative methods impose different shape or density assumptions and their own parameters.',
      },
      {
        title: 'Evaluate discovery without manufacturing certainty',
        body: 'Check stability across seeds and samples, separation measures, and analyst usefulness. Silhouette compares cohesion with distance to the nearest other cluster; it is not accuracy and can favor certain shapes. Freeze historical centroids before measuring future assignment distances. Distant points may reflect novelty, bad units, or poor representation, not fraud. Keep customer content out of broad dashboards and review samples under appropriate access controls.',
      },
    ],
    example: `One-dimensional points are [1, 2, 8, 9] minutes. Choose k = 2 and initial centroids [1, 8] minutes.
Assignment: [1, 2] goes to centroid 1; [8, 9] goes to centroid 8.
Initial within-cluster sum of squared distances = 0 + 1 + 0 + 1 = 2 minutes squared.
Updated centroids = [1.5, 8.5] minutes.
Updated sum of squared distances = 0.25 + 0.25 + 0.25 + 0.25 = 1 minute squared.
Mean squared distance = 1/4 = 0.25 minutes squared.
Cluster numbers 0 and 1 are arbitrary identifiers; swapping them does not change the partition.`,
    task: 'Work the k-means example and propose a workflow for grouping support tickets to help analysts discover themes. Explain representation, scaling, initialization checks, choosing k, handling distant future tickets, and how you would measure usefulness without calling the clusters escalation labels.',
    starter: `centroids = initialize(training_points, k)
repeat:
  assignments = nearest_centroid(training_points, centroids)
  centroids = mean_of_each_assigned_group(training_points, assignments)
# Freeze preprocessing and centroids before evaluating future assignments.`,
    hints: [
      'Compute squared distances to the assigned centroid both before and after the mean update.',
      'Ask what an analyst will do differently because the grouping exists.',
    ],
    solution: 'Groups [1,2] and [8,9] have means 1.5 and 8.5 minutes. Squared-distance sum falls from 2 to 1 minute squared; the mean is 0.25 minutes squared. Choose privacy-appropriate content representation for themes, fit preprocessing on training, and compare several seeds and k values. Inspect boundaries, stability, and analyst efficiency against ungrouped review. Freeze centroids for future assignment; monitor distances and assignment rates. Inspect unusual cases without labeling them fraud. Version cluster IDs because refits can reorder or split groups.',
    checklist: [
      'I derive centroids 1.5 and 8.5 minutes and squared-distance sum 1.',
      'I explain the representation and scaling behind similarity.',
      'I check stability and task usefulness rather than claiming accuracy without labels.',
      'I define future assignment and cluster-version behavior.',
    ],
    pitfalls: [
      'Treating numeric cluster IDs as ordered categories invents a relationship.',
      'Selecting k only by training distortion rewards ever more clusters.',
      'An outlier is not automatically an error or malicious event.',
      'Comparing cluster ID 1 across refits without alignment can misread drift.',
    ],
    walkthrough: [
      {
        title: 'Name a cluster only after inspecting it',
        body: 'A group mixing billing questions, legal notices, and empty messages may reflect formatting rather than topic. Inspect representative and boundary points, not just centroid neighbors. Revise unhelpful representations; a neat visualization is insufficient validation.',
      },
      {
        title: 'Version the assignment policy',
        body: 'Version preprocessing, centroids, tie rules, and distance thresholds together. Report later counts and distances under the frozen version. Refitting may capture new themes, but compare versions with human review and align groups before reporting growth. A new cluster number does not prove new behavior.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Assign a future point',
        prompt: 'With frozen centroids 1.5 and 8.5 minutes, assign a new point at 7 minutes and compute its squared distance to the chosen centroid.',
        hints: ['Compare absolute distances 5.5 and 1.5 minutes.', 'Square the smaller distance after choosing the nearest centroid.'],
        solution: 'The point joins the group centered at 8.5 minutes. Its squared distance is (7 - 8.5)^2 = 2.25 minutes squared. This measures deviation under the chosen geometry, not the probability that the ticket is abnormal.',
        checklist: ['I choose centroid 8.5 and distance squared 2.25.', 'I avoid interpreting distance as probability.'],
      },
      {
        id: 'stretch',
        title: 'A misleading improvement from more clusters',
        prompt: 'On the four-point example, k = 4 can place one centroid at each point and achieve zero distortion. Explain why this does not settle the choice of k for an analyst-facing grouping tool.',
        hints: ['Every singleton can fit itself perfectly.', 'The tool must summarize future cases in useful groups.'],
        solution: 'Zero training distortion follows from memorizing every point, not necessarily from discovering reusable structure. Four singleton groups offer little summarization and may be unstable on new data. Compare candidate k values using stability, future assignment behavior, manageable analyst workload, and reviewed coherence. A distortion curve can inform the discussion, but there is no guaranteed correct elbow or universal k hidden in these four numbers.',
        checklist: ['I explain why zero distortion can be unhelpful.', 'I propose evaluation tied to the analyst workflow.'],
      },
    ],
    followUps: [
      { question: 'Can labels still help evaluate an unsupervised system?', answer: 'Yes, if a separate labeled audit answers a relevant question. Keep those labels out of purportedly unsupervised fitting and disclose if repeated audit-driven choices make that audit part of model selection.' },
      { question: 'Can we call the farthest points anomalies?', answer: 'Only as a defined distance-based flag. Investigate whether they are meaningful unusual cases, corrupted inputs, or ordinary examples poorly represented by the chosen geometry.' },
    ],
    takeaways: [
      'Clusters summarize a chosen geometry, not hidden ground-truth labels.',
      'K-means alternates nearest-centroid assignments and mean updates.',
      'Validate stability, future behavior, and human usefulness alongside distortion.',
    ],
  },
  {
    id: 'ml-imbalance-thresholds',
    track: 'ml',
    title: 'Imbalance and thresholds: spend a limited review budget',
    minutes: 50,
    summary: 'Choose a decision policy from held-out scores, costs, and staffing limits while preserving prevalence and calibration assumptions.',
    prerequisites: ['ml-clustering'],
    prerequisiteNotes: 'Recall precision, recall, probabilistic classification, and held-out selection. Clustering provides a contrast: ranked classifier scores, not arbitrary cluster IDs, drive this decision policy.',
    objectives: [
      'Calculate confusion metrics and expected observed cost at different thresholds.',
      'Explain why resampling changes training, not the deployment prevalence.',
      'Distinguish a fixed threshold from a batch top-k policy and test capacity explicitly.',
    ],
    concepts: [
      {
        title: 'Rare positives change the useful baseline',
        body: 'At 1% prevalence, always predicting negative gives 99% accuracy while finding nothing. Report positive counts, precision, recall, and capacity. Precision changes with prevalence even if true-positive and false-positive rates stay constant. Precision-recall curves compare thresholds, but summary area does not guarantee quality at the staffing limit. Small positive counts make estimates noisy; report denominators and uncertainty.',
      },
      {
        title: 'Resampling belongs inside training',
        body: 'Resampling and weighting change what learning prioritizes. Apply them inside training folds only; preserve representative validation and test prevalence. Duplicating positives before splitting can leak copies into evaluation. These techniques may alter calibration, so raw outputs need not estimate deployment probabilities. A representative calibration set or properly nested procedure can help with sufficient labels. Calibration and threshold selection have different goals.',
      },
      {
        title: 'Translate scores into feasible actions',
        body: 'Fixed thresholds flag scores at or above a value, so traffic and score shifts change volume. Batch top-k selects at most k cases with documented ties. It controls count but may select weak cases and requires waiting for batch closure. Live systems need arrival, reserved-capacity, and overflow rules without knowing future scores. Select on validation and freeze both policy and timing before test.',
      },
      {
        title: 'Costs need explicit assumptions',
        body: 'Assume false positives cost $2, missed positives $10, and correct decisions zero. For calibrated p, flagging costs 2*(1-p) in expectation; not flagging costs 10*p. Flag above 1/6; equality ties. This assumes fixed costs, applicable probabilities, and unlimited capacity. Real reviews also cost money for true positives, may not prevent escalation, and may change later labels. State those differences before applying the algebra.',
      },
    ],
    example: `Validation scores in descending order: [0.9, 0.8, 0.6, 0.4, 0.3, 0.1].
Corresponding labels: [1, 0, 1, 0, 1, 0]. Flag scores >= threshold.
Threshold 0.7: TP=1, FP=1, FN=2, TN=2; precision=1/2; recall=1/3; flagged=2.
Threshold 0.5: TP=2, FP=1, FN=1, TN=2; precision=2/3; recall=2/3; flagged=3.
At FP cost $2 and FN cost $10, observed cost is $22 at threshold 0.7 and $12 at threshold 0.5 for this six-case batch.
A capacity of two reviews makes threshold 0.5 infeasible despite its lower unconstrained cost.
For calibrated probabilities with these costs and no capacity constraint, the expected-cost boundary is p = 2/(2+10) = 1/6.`,
    task: 'Work both threshold policies in the example. Choose a feasible policy under two reviews per batch, explain what additional scores or labels would be needed for a stronger claim, and design training and calibration checks if positives are oversampled. Contrast the observed batch costs with the theoretical probability-cost boundary.',
    starter: `predicted_positive = score >= threshold
precision = true_positives / flagged_count
recall = true_positives / actual_positive_count
observed_cost = 2 * false_positives + 10 * false_negatives
# Check capacity before comparing feasible policy costs.`,
    hints: [
      'Count labels among the selected prefix rather than inferring from the score magnitudes.',
      'The probability-cost boundary assumes calibration and does not enforce staffing limits.',
    ],
    solution: 'Threshold 0.7 gives precision 1/2, recall 1/3, and cost $22; threshold 0.5 gives both rates 2/3 and cost $12. Only 0.7 meets capacity here. Top-two selects the same cases and guarantees batch count, unlike a fixed threshold on future traffic. Six examples cannot establish future quality. Oversample training only and evaluate representative later data and calibration. The 1/6 boundary minimizes simplified expected error cost without capacity; it does not justify an infeasible review queue.',
    checklist: [
      'I compute both confusion matrices and observed costs correctly.',
      'I reject the three-review policy under a two-review limit.',
      'I preserve deployment prevalence in validation and test.',
      'I state calibration and capacity assumptions for the cost boundary.',
    ],
    pitfalls: [
      'Oversampling before splitting can leak duplicate examples into evaluation.',
      'A threshold meeting yesterday’s capacity may overload tomorrow’s queue.',
      'Undefined precision for zero flags is not automatically perfect precision.',
      'Selecting the best of many thresholds on a tiny validation set can overfit.',
    ],
    walkthrough: [
      {
        title: 'Apply the capacity constraint first',
        body: 'Tabulate policies, review counts, positives found, and costs. Mark infeasible policies before selection to avoid recommending unserviceable queues. Compare no review too: missing all three positives costs $30 under these simplified assumptions.',
      },
      {
        title: 'Specify ties and timing',
        body: 'Resolve equal scores with a documented stable or reproducibly randomized rule, checking group effects. Define batch closure and maximum wait. Waiting a day for exact top-two ranking may be unacceptable for urgent tickets even when offline metrics look good.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'No flags is not high precision',
        prompt: 'On the six-case example, set the threshold to 1. Compute recall, review count, and observed cost. What should be reported for precision?',
        hints: ['No score reaches 1.', 'Precision would divide zero true positives by zero flags.'],
        solution: 'Review count is zero, recall is 0/3 = 0, and all three positives are missed, costing $30. Precision is undefined mathematically. Report it as not applicable, or disclose an explicit software convention; do not claim 100% precision.',
        checklist: ['I obtain zero recall and cost $30.', 'I handle the zero denominator explicitly.'],
      },
      {
        id: 'stretch',
        title: 'Prevalence changes queue quality',
        prompt: 'A detector has true-positive rate 80% and false-positive rate 10%. Compare precision on 1000 cases with 100 positives versus 10 positives, assuming those rates remain unchanged.',
        hints: ['Apply false-positive rate to actual negatives, not all cases.', 'Precision divides found positives by all flags.'],
        solution: 'At 100 positives, TP=80 and FP=90, so precision is 80/170, about 47.1%. At 10 positives, TP=8 and FP=99, so precision is 8/107, about 7.5%. This calculation holds the conditional rates fixed as an assumption; real distribution changes may alter them too. A much rarer target can make the same detector expensive to review.',
        checklist: ['I obtain 80/170 and 8/107 precision.', 'I state the fixed-rate assumption.'],
      },
    ],
    followUps: [
      { question: 'Is top-k always better than a fixed threshold?', answer: 'No. It enforces a count but can select low-value cases and needs a defined batch. Thresholds can avoid weak cases but require capacity safeguards under changing traffic.' },
      { question: 'Can a threshold fix bad ranking?', answer: 'Not generally. A threshold chooses where to cut the ranking; it cannot reorder misplaced positives. Improve representation or learning if no feasible operating point meets the quality target.' },
    ],
    takeaways: [
      'Evaluate rare outcomes with positive counts and decision-relevant metrics.',
      'Resample training only and recheck probability calibration.',
      'Choose a feasible operational policy, not just the lowest unconstrained error.',
      'Distinguish observed costs from expected costs under calibration assumptions.',
    ],
  },
  {
    id: 'ml-deployment-monitoring',
    track: 'ml',
    title: 'Deployment and monitoring: defend an end-to-end ML design',
    minutes: 55,
    summary: 'Design capacity-aware ticket review with historical replay, delayed quality measurement, and rollback.',
    prerequisites: ['ml-imbalance-thresholds'],
    prerequisiteNotes: 'Integrate availability, evaluation, model selection, and thresholds. The case introduces latency, logging, and versioning.',
    objectives: [
      'Specify a complete prediction pipeline and an operational fallback.',
      'Separate immediate input and service monitoring from delayed outcome quality.',
      'Plan a guarded rollout with intervention-aware evaluation and rollback criteria.',
      'Defend model, policy, and retraining tradeoffs in an end-to-end design case.',
    ],
    concepts: [
      {
        title: 'Ship the whole decision procedure',
        body: 'Version feature definitions, preprocessing, parameters, calibration, and action policy together. Replay missing-history and unknown-queue cases to check offline-serving consistency. Log timestamps, versions, actions, and minimal diagnostics under appropriate retention and access controls, not raw ticket bodies for convenience. Include a reliable fallback such as the existing manual queue; a production design must handle unavailable features and scoring failures.',
      },
      {
        title: 'Monitor several clocks, not one dashboard',
        body: 'Latency, errors, missing features, scores, and review saturation are observable immediately. Precision, recall, and calibration require mature labels and complete observation. Report seven-day quality by mature prediction cohort, separating missing labels from negatives. Input drift does not prove degraded quality, and stable input averages do not prove stable quality. Use drift to prioritize investigation and delayed labels for direct supervised evidence.',
      },
      {
        title: 'Interventions change what gets observed',
        body: 'Preventing escalation can make high-risk reviewed tickets appear negative. Labeling only reviewed cases can leave population recall unidentified. Track exposure and representative audit samples where permissible. Use a controlled comparison for causal benefit, respecting safety and operational constraints. Shadow mode measures compatibility and scores, not intervention effects. Predictive performance under an observation policy differs from the causal benefit of review.',
      },
      {
        title: 'Retraining is another release, not an automatic cure',
        body: 'Drift can reflect broken sources, units, new customers, or concept change. Retraining on broken inputs entrenches defects. Diagnose first, collect representative mature labels, and compare candidates under the same contract. Require replay, capacity, slice, and rollback checks before promotion. Choose cadence from measured need and label availability. Rollback must restore feature transformations as well as weights.',
      },
    ],
    example: `Design case: 2000 new tickets arrive per day. Escalation labels mature after seven days. Reviewers can inspect at most 100 tickets per completed daily batch.
Candidate selection uses earlier mature validation cohorts; the original 160-flag threshold is infeasible. Select a top-100 policy with documented tie-breaking, or a threshold plus a capacity cap, before final testing.
A mature held-out cohort contains 100 actual escalations. The frozen policy flags 100 tickets: TP=60, FP=40, FN=40, TN=1860.
Precision = 60/100 = 60%; recall = 60/100 = 60%; accuracy = 1920/2000 = 96%.
Assume every review costs $2 and each missed escalation costs $20, with no other costs or intervention effects in this offline calculation.
Policy cost = 100*$2 + 40*$20 = $1000 per cohort.
No-review baseline cost = 100*$20 = $2000 per cohort. Offline difference = $1000, not proven causal savings.`,
    task: 'Design the ticket-review system: prediction contract, as-of features, mature splits, baseline/model comparison, frozen policy, batch timing, fallback, logging, monitoring, guarded rollout, and retraining. Calculate metrics and costs; explain why controlled product evaluation remains necessary.',
    starter: `on_ticket_created:
  features = point_in_time_features(ticket)
  score = versioned_pipeline(features)
  record_minimal_prediction_metadata(score)
on_batch_closed:
  review = capacity_limited_selection(scores, tie_rule)
after_label_maturity:
  join_cohort_predictions_to_observed_outcomes()
  report_quality_and_label_coverage_by_slice()`,
    hints: [
      'Keep prediction time, batch decision time, and label availability time distinct.',
      'If review changes the outcome or which labels are collected, offline costs do not identify causal savings.',
    ],
    solution: 'Predict at creation using initial features and known history, excluding closure information. Fit preprocessing/baselines on older mature cohorts, tune later, and freeze before final test. Compare simple and ensemble classifiers under capacity and latency. Precision and recall are 60%, accuracy 96%, and conditional cost $1000 versus $2000. Define batch waiting time; urgent intervention needs a reevaluated online policy. Use manual fallback on failure. Run shadow checks and a guarded comparison under prespecified service, workload, and slice limits. Monitor immediate inputs and mature quality separately. Audit unreviewed outcomes and exposure before claiming recall or causal savings; diagnose before retraining.',
    checklist: [
      'I specify availability, mature splits, and a frozen pipeline.',
      'I calculate 60% precision/recall and conditional $1000 cost difference.',
      'I enforce capacity and batch timing.',
      'I separate immediate health from delayed quality.',
      'I include fallback, intervention-aware evaluation, and rollback.',
    ],
    pitfalls: [
      'Immature outcomes treated as negatives create fictitious trends.',
      'Score drift does not prove accuracy degradation.',
      'Reviewed-only labels cannot establish population recall.',
      'Offline costs do not establish causal benefit.',
      'Weight-only rollback can leave broken transforms active.',
    ],
    walkthrough: [
      {
        title: 'Turn monitoring into response rules',
        body: 'Assign alert owners and actions: unknown queues trigger source checks, timeouts trigger fallback, saturation triggers capacity investigation, and mature quality regressions trigger slice analysis and possible rollback. Agree limits before rollout rather than selecting favorable thresholds after seeing results.',
      },
      {
        title: 'Walk through a failure and a recovery',
        body: 'A source switches hours to minutes. Catch the range shift before seven-day labels arrive. On a guardrail breach, pause model actions, use manual fallback, restore compatible features, and replay affected predictions. Audit actions and wasted capacity; retraining is not the first repair for broken units.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Which cohort is ready?',
        prompt: 'At September 15 noon, can September 7 and September 12 noon cohorts be scored? Labels need seven complete days with no reporting lag.',
        hints: ['Add seven days to each creation timestamp.', 'Availability of a row is not maturity of its target.'],
        solution: 'September 7 matured September 14 noon, assuming complete observation. September 12 matures September 19 noon. Report its service statistics separately without inventing negative labels.',
        checklist: ['I include only the September 7 cohort in mature quality.', 'I state the no-additional-lag and complete-observation assumptions.'],
      },
      {
        id: 'stretch',
        title: 'The apparent recall improvement',
        prompt: 'Only 100 reviewed tickets receive labels. A dashboard claims 100% recall because every labeled escalation was reviewed. Diagnose and repair this evaluation, including tradeoffs.',
        hints: ['Where could false negatives be observed?', 'A sample outside the reviewed queue can reveal selection bias.'],
        solution: 'Unobserved false negatives invalidate the denominator. Obtain complete downstream outcomes or audit representative unreviewed tickets with recorded inclusion probabilities and appropriate weighting. Wait for maturity and report uncertainty; this costs labels and time. If reviews change outcomes, also track exposure or use a safely controlled comparison to measure intervention benefit.',
        checklist: ['I identify the unobserved false negatives.', 'I propose representative outcome collection and acknowledge cost and intervention effects.'],
      },
    ],
    followUps: [
      { question: 'What does shadow mode establish?', answer: 'Feature availability, latency, scores, and hypothetical load, not the causal effect of reviews that never occurred.' },
      { question: 'Should drift automatically trigger retraining?', answer: 'Not alone. Require trustworthy mature labels and promotion checks; broken data may need repair or rollback instead.' },
    ],
    takeaways: [
      'Version the decision procedure and test fallback.',
      'Respect immediate-health and delayed-quality clocks.',
      'Evaluate capacity, timing, and label collection.',
      'Separate predictive evidence from causal impact.',
      'Control retraining and rollback releases.',
    ],
  },
]
