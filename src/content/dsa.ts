import type { Lesson } from '../curriculum-types'
import { starterLessons } from './starter'

type Enrichment = Pick<Lesson, 'minutes' | 'prerequisites' | 'prerequisiteNotes' | 'walkthrough' | 'extraPractice' | 'followUps' | 'takeaways'> & {
  concepts: Lesson['concepts']
}

function enrich(id: string, additions: Enrichment): Lesson {
  const core = starterLessons.find((lesson) => lesson.id === id)
  if (!core || core.track !== 'dsa') throw new Error(`Missing published DSA lesson: ${id}`)
  return {
    ...core,
    ...additions,
    objectives: [...core.objectives],
    hints: [...core.hints],
    checklist: [...core.checklist],
    pitfalls: [...core.pitfalls],
    concepts: [...core.concepts.map((section) => ({ ...section })), ...additions.concepts],
  }
}

function lesson(content: Omit<Lesson, 'track'>): Lesson {
  return { ...content, track: 'dsa' }
}

const arrays = lesson({
  id: 'arrays-prefix-foundations',
  title: 'Arrays: indices, scans, and prefix sums',
  minutes: 40,
  summary: 'Turn repeated interval totals into boundary subtraction while practicing precise array contracts.',
  prerequisites: [],
  prerequisiteNotes: 'Know variables, integer arithmetic, comparisons, loops, and function returns. Indices are zero-based; no earlier algorithm lesson is required.',
  objectives: [
    'Describe a half-open interval and its length without special cases.',
    'Build a prefix array whose entries summarize completed work.',
    'Separate preprocessing, per-query cost, and result storage.',
  ],
  concepts: [
    { title: 'An index is a position, not a value', body: 'An array gives constant-time indexed access under the usual random-access model. Adjacent positions need not contain adjacent numbers. A loop over n positions costs O(n), while inserting at the front of a packed array may shift n values. Start by writing the legal index range. For an array of length n, element indices run from 0 to n minus 1; the boundary n is legal in an interval but is not an element to read.' },
    { title: 'Half-open intervals compose', body: 'The interval [left, right) includes left and excludes right. Its length is right minus left, so [2, 2) is empty. Adjacent intervals [a, b) and [b, c) join without double-counting b. This convention lets a query ending at n include the final element, and gives empty arrays a natural representation. Decide interval conventions before coding rather than adjusting endpoints until examples happen to pass.' },
    { title: 'Store one more boundary than elements', body: 'Define prefix[k] as the sum of the first k elements, not the sum through index k. Thus prefix[0] = 0 and prefix[k + 1] = prefix[k] + values[k]. Subtracting prefix[left] from prefix[right] removes exactly the earlier elements and leaves the requested interval. Negative values do not invalidate subtraction. Choose a numeric representation wide enough for accumulated sums even when individual inputs fit a smaller type.' },
  ],
  example: 'rangeTotals([3, -2, 5, 1], [[0,4],[1,3],[2,2]]) returns [7,3,0]. The prefix array is [0,3,1,6,7].',
  task: 'Write rangeTotals(values, ranges). Each range is [left, right), with 0 <= left <= right <= n. Return one sum per range in input order without modifying values or ranges. Arrays may be empty; n and the number q of queries are at most 100000, with values between -1000000 and 1000000. Use O(n + q) time. For rangeTotals([], [[0,0]]), return [0].',
  starter: `function rangeTotals(values, ranges):
    prefix = array of length length(values) + 1 filled with 0
    // Build the total at every boundary.
    totals = empty list
    // Answer each interval using two boundaries.
    return totals`,
  hints: [
    'What total should prefix[0] represent before reading any elements?',
    'The first right elements include the first left elements. Subtract their summaries.',
  ],
  solution: `function rangeTotals(values, ranges):
    prefix = array of length length(values) + 1 filled with 0
    for i from 0 to length(values) - 1:
        prefix[i + 1] = prefix[i] + values[i]
    totals = empty list
    for [left, right] in ranges:
        append prefix[right] - prefix[left] to totals
    return totals

For [3, -2, 5, 1], successive totals are 0, 3, 1, 6, 7. Query [1,3) is 6 minus 3 = 3, which equals -2 + 5. The empty query subtracts a boundary from itself. Induction on i proves each prefix entry summarizes exactly the elements before its boundary; subtraction then proves every answer. Preprocessing takes O(n) time and O(n) auxiliary space. Each query costs O(1) time; total time is O(n + q), auxiliary space O(n), and returned output O(q).`,
  checklist: [
    'I define prefix[k] in words before using it.',
    'I handle empty intervals and the boundary n without reading values[n].',
    'I distinguish auxiliary storage from the returned answers.',
  ],
  pitfalls: [
    'Treating right as inclusive adds an unwanted element.',
    'Allocating only n prefix entries loses the final boundary.',
    'Using a narrow accumulator can overflow even when each value fits.',
  ],
  walkthrough: [
    { title: 'Begin with the direct method', body: 'For each query, scan from left to right minus one and add values. That baseline is easy to validate, uses constant working space, and may be the right choice for one tiny query. But q full-length queries revisit n elements each, for O(nq) time. Prefix sums change the question from “which elements should I visit again?” to “which already computed totals bracket this interval?” This is a time-for-space tradeoff, not a universally free optimization.' },
    { title: 'Audit boundaries before large inputs', body: 'Trace [0,n), [0,0), [n,n), and a single-element interval [i,i+1). The corresponding subtraction should produce the entire sum, zero, zero, and values[i]. Then include a negative element to expose accidental assumptions about increasing totals. Unlike sorted search, prefix sums need not be monotone. The stored summaries describe the original array: changing one element invalidates later prefixes, so this solution explicitly assumes a static array during the batch.' },
  ],
  extraPractice: [
    {
      id: 'warmup', title: 'A running total',
      prompt: 'Return the sum after each element of [2,-1,4]. Generalize to an arbitrary array, returning [] for empty input.',
      hints: ['Keep one accumulator initially zero.', 'Append after adding the current value, not before.'],
      solution: 'Maintain total = 0; for each value, add it and append total. The result is [2,1,5]. The accumulator is the sum of the processed prefix, so each emitted value is correct. Time O(n), auxiliary space O(1), and output space O(n); no extra leading zero belongs in this output contract.',
      checklist: ['I return one result per element.', 'I explain why a negative input can decrease a running total.'],
    },
    {
      id: 'stretch', title: 'Exactly one update before queries',
      prompt: 'The same immutable array receives many range queries, then one value changes, then another batch arrives. Explain a correct rebuild strategy and its costs; identify why silently reusing the original prefix array fails.',
      hints: ['Which prefix boundaries include the changed position?', 'A full rebuild can be reasonable when updates are rare.'],
      solution: 'Keep the updated values and rebuild the n + 1 boundaries before the second batch. An update at index k affects every prefix boundary greater than k. For q total queries and one rebuild, construction plus reconstruction plus queries is O(n + q), with O(n) auxiliary space. Frequent alternating updates and queries would motivate a different data structure; constant-time queries alone do not guarantee a cheap dynamic workload.',
      checklist: ['I name precisely which summaries become stale.', 'I include rebuilding in the total work.'],
    },
  ],
  followUps: [
    { question: 'Can the same subtraction trick answer interval minimum?', answer: 'Not from prefix minima alone. A prefix minimum discards information: if the earlier prefix contains the smallest value, removing that prefix does not reveal the next smallest. Sums work because subtraction reverses addition.' },
    { question: 'Must every query be stored before answering?', answer: 'No. Once prefixes exist, independent queries can be processed as a stream. Retaining answers is required here by the return contract, not by the prefix-sum algorithm itself.' },
  ],
  takeaways: ['Specify element positions separately from interval boundaries.', 'A useful invariant gives every stored entry one exact meaning.', 'Precomputation is valuable when many operations reuse unchanged input.'],
})

const complements = enrich('hash-map-complements', {
  minutes: 45,
  prerequisites: [arrays.id],
  prerequisiteNotes: 'Know index scans and array returns. Map membership is distinct from truthiness.',
  concepts: [
    { title: 'Decide what information may be forgotten', body: 'Any valid pair is accepted, so one earlier index per value suffices. Replacing an earlier occurrence loses no necessary evidence. Returning every pair needs counts or index collections. Choose state from output requirements, not familiarity.' },
    { title: 'Expected performance is a model assumption', body: 'Pathological collisions can slow hash lookup; an ordered balanced map offers logarithmic worst-case operations instead. Also ensure complement subtraction fits the numeric representation. Neither implementation detail changes the distinct-index invariant, but both belong in an honest performance discussion.' },
  ],
  walkthrough: [
    { title: 'Derive the lookup from a quadratic baseline', body: 'Every earlier-index comparison asks whether a value equals the same need, target minus values[j]. Remembering values replaces that repeated scan with membership. Initially the map is empty; after a failed lookup, insertion restores the next iteration’s invariant. Operation order makes the proof executable.' },
    { title: 'Test validity without overconstraining the answer', body: 'Check in-range increasing indices and the target sum. For [4,9,1,6] and target 10, both [0,3] and [1,2] are valid, although this scan returns [1,2]. Contract tests should accept either. Include a no-match case to distinguish remembered candidates from completed pairs.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'An earlier duplicate', prompt: 'Return whether any value occurs twice in an integer array. Trace [6,1,6] and [6].', hints: ['You need membership but no index in the answer.', 'Check the set before adding the current value.'], solution: 'Scan with an initially empty set. Return true when the current value is already present; otherwise add it. Return false after the scan. [6,1,6] returns true at the final position, while [6] returns false. The set contains exactly the distinct earlier values. Expected time is O(n), auxiliary space O(n); empty input is false.', checklist: ['I distinguish repeated positions from one occurrence.', 'I justify the empty-set initialization.'] },
    { id: 'stretch', title: 'Count all matching index pairs', prompt: 'Return the number of i < j pairs summing to target, rather than one pair. For [2,2,2,3] and target 4, return 3.', hints: ['Remember the frequency of each earlier value.', 'Add the partner frequency before incrementing the current frequency.'], solution: 'Maintain frequency and count. At j, add frequency[target - values[j]] (zero if absent), then increment frequency[values[j]]. The three 2s contribute 0, then 1, then 2 pairs, totaling 3; the 3 contributes none. Each pair is counted exactly at its later endpoint. Expected time O(n), auxiliary space O(n). The answer can reach n(n - 1)/2, so use a sufficiently wide integer.', checklist: ['I count duplicate occurrences rather than distinct values.', 'I still perform lookup before insertion.'] },
  ],
  followUps: [
    { question: 'Why not sort first?', answer: 'Sorting costs O(n log n) comparison time and changes positions. Preserving original indices requires bookkeeping; a sorted-input contract cannot be silently substituted.' },
    { question: 'Can this process a stream?', answer: 'Yes, assign arrival indices and retain map entries until a match. Without an answer, memory can grow with distinct arriving values.' },
  ],
  takeaways: ['Derive a remembered state from repeated baseline work.', 'Update order prevents accidental self-matching.', 'Changing “any answer” to “all answers” changes required state.'],
})

const pointers = enrich('two-pointers-sorted-pairs', {
  minutes: 45,
  prerequisites: [arrays.id, complements.id],
  prerequisiteNotes: 'Know zero-based indices and pair contracts. Nondecreasing order permits equal neighboring values.',
  concepts: [
    { title: 'Elimination is stronger than intuition', body: 'A failed endpoint comparison alone proves little. Sorted order makes it eliminate every pair using one endpoint: an entire row or column of candidate pairs. The search shrinks because whole families of answers are impossible, not because a value merely looks unhelpful.' },
    { title: 'Choose pointers by the relation you need', body: 'Opposite-end pointers suit sorted sums; read/write pointers suit compaction; fast/slow pointers suit linked structures. Their names supply no proofs. Identify the classified region and preserved relation first. Here the remaining interval contains every pair not yet ruled out by ordering.' },
  ],
  walkthrough: [
    { title: 'Use a minimal duplicate trace', body: 'For [2,2] and target 4, pointers name different positions despite equal values, so comparison succeeds. A singleton never enters the loop. Empty input starts right at -1 and also skips it. The strict comparison prevents self-use without special cases.' },
    { title: 'Explain the cost without relying on lucky matches', body: 'Each failed comparison decreases interval width, so fewer than n moves occur even without a match. Only pointers and a sum are stored. Sorting is excluded by the input guarantee; adding it requires reporting its time, space, mutation, and original-index effects.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Two end values only', prompt: 'Given a sorted array of at least two values, compare its first-plus-last sum with a target and identify a safe endpoint to discard, or report a match. Use [-3,2,8] and target 7.', hints: ['The endpoint sum is 5.', 'Can any smaller partner make -3 reach 7?'], solution: 'Discard the first endpoint -3 because even its largest available partner 8 gives only 5. Any other partner is no larger, so none can produce 7 with -3. One decision takes O(1) time and space. This exercise makes only one elimination, not a claim that the remaining array necessarily contains a match.', checklist: ['I eliminate the endpoint with every possible partner.', 'I avoid claiming a solution exists after one move.'] },
    { id: 'stretch', title: 'Count pairs below a threshold', prompt: 'Count sorted-array pairs i < j with values[i] + values[j] < target. For [1,2,3,4], target 6, return 4.', hints: ['When the endpoint sum is below target, how many right partners work for left?', 'Count those partners together, then remove only that left endpoint.'], solution: 'Start at opposite ends. Below target, add right - left and increment left; otherwise decrement right. Value 1 contributes three pairs; value 2 contributes one. Distinct left endpoints prevent double counting. Time O(n), auxiliary space O(1); use a wide count and strict inequality.', checklist: ['I count every proven partner.', 'I exclude equality.'] },
  ],
  followUps: [
    { question: 'Does this work with negatives?', answer: 'Yes. The proof uses order, not sign. Moving right inward cannot increase its value even if both endpoints are negative.' },
    { question: 'Can we validate sortedness?', answer: 'An O(n)-time, O(1)-space adjacent-pair scan can reject invalid input. The core contract already guarantees order, so this is optional API validation.' },
  ],
  takeaways: ['State why every discarded candidate is impossible.', 'Equal values can still represent distinct indices.', 'Report the cost of establishing prerequisites as well as using them.'],
})

const window = enrich('sliding-window-distinct', {
  minutes: 50,
  prerequisites: [arrays.id, complements.id, pointers.id],
  prerequisiteNotes: 'Know sets, contiguous half-open or inclusive intervals, and monotone pointer movement. This task uses lowercase letters, not arbitrary Unicode text.',
  concepts: [
    { title: 'Validity must survive removing a prefix', body: 'Shrinking cannot introduce duplicates. Since the previous window was valid, only the incoming character can cause a violation. This repair property enables the moving boundary. Negative-sum constraints, for example, need not behave monotonically as endpoints move.' },
    { title: 'A last-seen table is an alternative representation', body: 'Remember each character’s latest index instead of removing set entries. Set left to max(left, lastSeen + 1) before recording the new index. An occurrence outside the window must never move left backward. This represents the same longest-valid-suffix invariant with different state.' },
  ],
  walkthrough: [
    { title: 'Why abba catches broken repairs', body: 'After ab, the incoming b repeats. Removing a alone leaves the old b, so remove that too before inserting the new b. The final a extends ba. In a last-seen implementation, its obsolete index zero must not move left backward.' },
    { title: 'Separate alphabet space from input size', body: 'At most 26 distinct lowercase letters occupy the set, independent of n. A general alphabet of size A instead gives O(min(n,A)) space. Returning the actual substring would require saved boundaries and possibly copied output storage; this task returns only a length.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Check one fixed interval', prompt: 'Check whether an entire lowercase string contains no repeats. Explain the results for "cab" and "cac".', hints: ['No shrinking is necessary because the interval is fixed.', 'A repeated set member disproves validity immediately.'], solution: 'Scan with an empty set. Reject on a previously present character; otherwise insert and continue. Accept at the end. "cab" is true and "cac" is false at its final c. Expected time O(n), space O(min(n,26)), including O(1) with this alphabet. Empty input is valid, unlike a requirement for a nonempty substring.', checklist: ['I check membership before insertion.', 'I state how empty input behaves.'] },
    { id: 'stretch', title: 'At most two distinct letters', prompt: 'Return the longest substring length containing at most two distinct letters. For "eceba", return 3 using "ece".', hints: ['Counts are needed because duplicates are allowed.', 'Delete a character’s map entry only when its count reaches zero.'], solution: 'Expand right and increment its character count. While the map has more than two keys, decrement the left character, remove zero counts, and advance left. Measure after repair. For "eceba", "ece" reaches three; adding b forces removal of e then c before two types remain. Each endpoint advances at most n times: expected O(n) time, O(1) alphabet-bounded space. A set without counts cannot tell whether a removed letter still occurs inside.', checklist: ['I keep counts synchronized with the window.', 'I measure only after the distinct-key constraint holds.'] },
  ],
  followUps: [
    { question: 'Why not test longest lengths first?', answer: 'Many overlapping substrings still repeat membership work. Reusing the valid suffix guarantees O(n) traversal instead of relying on early success.' },
    { question: 'What about subsequences?', answer: 'They may skip interior positions. A window proves a statement about consecutive positions only; changing that requirement changes the problem.' },
  ],
  takeaways: ['Keep stored state identical to the represented interval.', 'Repair every violation before scoring a candidate.', 'Amortized analysis counts movements across the entire run.'],
})

const stack = enrich('stack-balanced-delimiters', {
  minutes: 45,
  prerequisites: [arrays.id],
  prerequisiteNotes: 'Know array scans, boolean returns, and empty collections. A stack exposes push, pop, and top at one end.',
  concepts: [
    { title: 'The stack is a compressed history', body: 'Completed pairs no longer constrain the future and can be forgotten. Unmatched openers still matter in nesting order. The stack retains exactly this unresolved history, rather than the entire prefix. This general modeling technique keeps unfinished obligations and discards completed work.' },
    { title: 'Some failures are irreversible', body: 'A wrong or unpaired closer cannot be repaired by any suffix. Remaining openers might still close later, so reject those only at end of input. Prefix failures and final-state failures serve different logical purposes in validators; neither check replaces the other.' },
  ],
  walkthrough: [
    { title: 'Trace state, not just counts', body: 'For ([)], top [ blocks the next ). Reaching below it would close an outer obligation while its inner one remains unresolved. Counts cannot capture that ordering. Record the stack after every symbol and check it lists exactly the unmatched openers in encounter order.' },
    { title: 'Measure depth and implementation costs', body: 'Sequence ()()() needs depth one, whereas (((()))) needs four. Storage follows nesting depth, not pair count. Growable-array end pushes are amortized constant-time and pops avoid shifting. Front insertions would undermine the cost model even if they reproduced the same abstract stack behavior.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Only one bracket type', prompt: 'Validate strings containing only ( and ). Use a counter rather than a stack. Explain why ")(" is invalid even though its final count is zero.', hints: ['Increment on open and decrement on close.', 'A negative prefix count means a closer arrived too soon.'], solution: 'Keep balance = 0. Update it for each symbol and immediately reject if it becomes negative. At the end accept exactly when balance is zero. ")(" fails on its first symbol; empty input passes. With one type, only the number of unresolved identical openers matters. Time O(n), auxiliary space O(1); multiple bracket types require retaining their order.', checklist: ['I reject negative prefixes.', 'I require zero final balance.'] },
    { id: 'stretch', title: 'Explain the first failure', prompt: 'Return the index of the first incompatible closer. If there is no incompatible closer but openers remain, return n. Return -1 for valid input. For "[(])", return 2; for "((", return 2.', hints: ['Carry the current scan index into early rejection.', 'The end-of-input boundary can represent unfinished obligations.'], solution: 'Use the original opener stack and matching checks. Return i instead of false on an empty-stack or wrong-top closer. After scanning, return n if the stack is nonempty, otherwise -1. The sentinel n is a boundary, not an index to read. This reports exactly the requested failure category, with O(n) time and O(d) space; locating the earliest unmatched opener instead would require storing opener indices.', checklist: ['I distinguish an actual symbol position from end-of-input.', 'I preserve type checking while adding diagnostics.'] },
  ],
  followUps: [
    { question: 'Can a queue replace the stack?', answer: 'No. A queue closes the oldest opener first, while nesting demands the newest. The valid string ([]) illustrates the reversal.' },
    { question: 'What if ordinary text is included?', answer: 'The current input contract excludes it. A broader parser needs explicit rules for ignoring text, handling quotes, and recognizing escapes; silently treating every other character as a closer would be incorrect.' },
  ],
  takeaways: ['Store unfinished obligations in the order future work needs them.', 'Prefix failure and incomplete final state are different checks.', 'Abstract operation costs depend on the underlying collection.'],
})

const queues = lesson({
  id: 'queues-fifo-simulation',
  title: 'Queues: process arrivals fairly',
  minutes: 40,
  summary: 'Simulate round-robin work with first-in, first-out order and an explicit progress measure.',
  prerequisites: [arrays.id, stack.id],
  prerequisiteNotes: 'Know stack operations and array traversal. This lesson contrasts last-in, first-out obligations with first-in, first-out waiting.',
  objectives: ['Model a waiting line with a queue.', 'Implement constant-time logical dequeue with a head index.', 'Analyze a simulation by the number of events, not just the number of inputs.'],
  concepts: [
    { title: 'Arrival order is the policy', body: 'A queue removes the oldest waiting item. In round-robin scheduling, a job receives one unit of service and, if unfinished, joins the back. Later jobs therefore receive turns before that job runs again. The queue determines fairness among waiting jobs, but does not magically reduce the amount of work required. State the scheduling policy before selecting operations; using a stack would favor recently requeued work and produce a different completion order.' },
    { title: 'A moving head avoids shifts', body: 'Store queue entries in an array and read queue[head], then increment head. New entries append at the end. The logical queue is the suffix starting at head; old entries before it are inactive. This avoids repeatedly removing index zero, which may shift the entire suffix. It does retain historical entries, so its memory bound depends on total enqueues. A circular buffer can reuse consumed slots when bounded live storage matters.' },
    { title: 'Count service events', body: 'Let S be the sum of all requested positive work units. Every iteration reduces remaining work by exactly one, so there are S iterations. A bound stated only as O(n) would miss potentially large jobs. Inputs below restrict S to keep the simulation practical. Termination follows from a nonnegative remaining-work measure that strictly decreases, not from the queue getting shorter every turn; unfinished jobs rejoin it.' },
  ],
  example: 'completionOrder([2,1,3]) returns [1,0,2]. Service IDs are 0,1,2,0,2,2.',
  task: 'Write completionOrder(work), returning job indices in completion order. All jobs arrive initially in index order; each turn consumes one unit, then unfinished jobs join the back. Each work value is a positive integer; empty input returns []. There are at most 100000 jobs and at most 1000000 total units. Do not modify work. Include the space cost of retained queue entries.',
  starter: `function completionOrder(work):
    remaining = copy of work
    queue = indices 0 through length(work) - 1
    head = 0
    completed = empty list
    // Serve one unit per turn.
    return completed`,
  hints: ['Store job IDs in the queue so their remaining work can live in a separate array.', 'After decrementing, append either to completed or to queue, never both.'],
  solution: `function completionOrder(work):
    remaining = copy of work
    queue = indices 0 through length(work) - 1
    head = 0
    completed = empty list
    while head < length(queue):
        job = queue[head]
        head = head + 1
        remaining[job] = remaining[job] - 1
        if remaining[job] == 0:
            append job to completed
        else:
            append job to queue
    return completed

For [2,1,3], job 0 rejoins after its first turn; job 1 finishes next. Job 2 rejoins, then job 0 finishes, then job 2 receives its remaining two turns. The output is [1,0,2]. At every boundary the live queue contains each unfinished job exactly once in its next-turn order. Serving and possibly requeueing preserves that invariant. Time O(n + S); the append-only queue retains S entries, so auxiliary space O(n + S), with O(n) output. A reusable circular queue reduces auxiliary space to O(n).`,
  checklist: ['I preserve next-turn order when requeueing.', 'I never requeue a completed job.', 'I count total service units and retained history in complexity.'],
  pitfalls: ['Removing the first array entry can add shifting work.', 'Using input values as IDs confuses equal-sized jobs.', 'Requeueing before checking zero gives finished jobs extra turns.'],
  walkthrough: [
    { title: 'Distinguish live size from allocated size', body: 'At most n unfinished jobs are live at any moment, but the simple array does not discard consumed entries. After many turns its length can be S even if only one job remains. Draw a divider at head when tracing the example: only entries to its right can be served. This explains both cheap dequeue and historical storage without pretending the physical array is always the logical queue.' },
    { title: 'Check policy edge cases', body: 'With one job of work four, the same ID is served four times and appears once in the result. With all work values one, no requeue occurs and completion order is input order. Empty input skips the loop. Zero-unit jobs are excluded deliberately: supporting them would require specifying whether they complete before any service, and in what tie order. A simulation is correct only relative to those policy choices.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'A short waiting line', prompt: 'Enqueue A, enqueue B, dequeue, enqueue C, then drain the queue. State all removed values.', hints: ['Only remove the oldest still-waiting value.', 'A removed item no longer competes with later arrivals.'], solution: 'The first removal is A; draining later removes B then C. Each queue operation costs O(1) with suitable storage; k operations cost O(k) time. Maximum live storage is two entries. A head-index array retains three enqueued entries in this trace, illustrating why live and allocated size can differ.', checklist: ['I return A before B.', 'I distinguish removed history from waiting entries.'] },
    { id: 'stretch', title: 'Reuse the waiting slots', prompt: 'Describe a circular-array implementation for the same scheduler that uses O(n) queue storage, including the full-versus-empty distinction.', hints: ['Track head and the number of live entries.', 'The append position is (head + size) modulo capacity.'], solution: 'For nonempty input allocate n slots, track head and size, and initialize all IDs. Dequeue reads head, advances it modulo n, and decrements size. Enqueue writes at (head + size) modulo n and increments size. A service always removes before any requeue, so capacity is never exceeded. Handle empty input before modulo operations. Time remains O(n + S), auxiliary space O(n), and output O(n).', checklist: ['I avoid modulo zero for empty input.', 'I use size to distinguish full and empty states.'] },
  ],
  followUps: [
    { question: 'Would prioritizing the shortest job produce the same answer?', answer: 'Not generally. It changes scheduling policy and requires selecting by remaining work rather than arrival order. A priority queue, introduced later, models that choice.' },
    { question: 'Is the runtime polynomial in the digits of each work value?', answer: 'Not necessarily. It depends on numeric total S, which can be huge relative to its encoded length. The explicit total-work constraint makes this event-by-event simulation feasible.' },
  ],
  takeaways: ['Choose a collection whose removal order matches the policy.', 'Use a head index when array-front removal would shift data.', 'Parameterize simulations by events as well as input records.'],
})

const linked = lesson({
  id: 'linked-lists-reversal',
  title: 'Linked lists: preserve links while rewiring',
  minutes: 45,
  summary: 'Reverse a singly linked chain in place using a precise partition of processed and unprocessed nodes.',
  prerequisites: [arrays.id, pointers.id],
  prerequisiteNotes: 'Know loops and object identity. A node has a value and a next reference; null means no node, not a node whose value is zero.',
  objectives: ['Separate node identity from stored values.', 'Save a successor before overwriting a link.', 'Prove that a rewiring loop neither loses nodes nor creates cycles.'],
  concepts: [
    { title: 'References replace positional access', body: 'A singly linked node stores its value and the reference to the next node. Finding the kth node requires following k links from the head, unlike constant-time array indexing. Inserting after a known node can be constant-time, but finding that node still costs traversal. Reversal changes links and the head, not values. Two equal-valued nodes remain distinct objects and must both appear in the reversed result.' },
    { title: 'Partition the chain', body: 'Maintain previous as the head of the already reversed prefix and current as the first unprocessed node. Initially previous is null and current is the original head. The two chains together contain every original node exactly once. Reversing current.next transfers one node from the unprocessed chain to the reversed chain, provided its original successor was saved first. This invariant makes each assignment’s purpose visible.' },
    { title: 'Mutation is an API choice', body: 'In-place reversal changes every next link. A caller retaining a reference to the old head now holds the tail, not an unchanged view of the list. The task permits this mutation and returns the new head. A nonmutating variant would allocate new nodes, using O(n) additional space. State ownership assumptions explicitly; an algorithm can be logically correct yet violate a caller’s expectation about shared data.' },
  ],
  example: 'reverseList(4 -> 1 -> 7 -> null) returns 7 -> 1 -> 4 -> null, using the same three nodes.',
  task: 'Write reverseList(head) for a finite, acyclic singly linked list of at most 100000 nodes. Each node has value and next. Rewire existing nodes and return the new head without allocating replacement nodes or modifying values. A null head returns null. Assume no other operation mutates the list concurrently. Use O(n) time and O(1) auxiliary space.',
  starter: `function reverseList(head):
    previous = null
    current = head
    while current != null:
        // Preserve the old successor before changing current.next.
    return previous`,
  hints: ['After current.next changes, where will you find the unprocessed suffix?', 'Save nextNode, reverse the link, then advance previous and current in that order.'],
  solution: `function reverseList(head):
    previous = null
    current = head
    while current != null:
        nextNode = current.next
        current.next = previous
        previous = current
        current = nextNode
    return previous

For 4 -> 1 -> 7, first save node 1 and point 4 to null. Then save 7 and point 1 to 4. Finally save null and point 7 to 1. current becomes null and previous names 7. Each iteration transfers exactly one node while preserving the two-chain partition. Thus all original nodes appear once, in reverse order, and the old head terminates the chain. Time O(n), auxiliary space O(1); returned nodes are the existing input storage, not a new O(n) copy.`,
  checklist: ['I save the successor before rewiring.', 'I return the new head and preserve node identities.', 'I handle null and one-node inputs without special unsafe dereferences.'],
  pitfalls: ['Reading current.next after overwriting it loses the suffix.', 'Returning the old head exposes only the new tail.', 'Swapping values instead of links violates the identity-preserving task.'],
  walkthrough: [
    { title: 'Draw references after every assignment', body: 'For the first node, current.next becomes null even though more nodes remain. That is safe only because nextNode still points to the remainder. previous then takes ownership of the reversed prefix and current advances along the saved reference. Avoid compressing these operations into an opaque multiple assignment while learning: the sequence explains why information is never lost. Null acts as the empty-chain boundary on both sides.' },
    { title: 'Test structure, not just printed values', body: 'A value-only test can miss replacement nodes, duplicate references, and cycles. Retain the original node objects, reverse the chain, and verify their exact reversed identity order plus a null final link. Reverse again to recover the original ordering and head identity. Repeated values make this especially useful because equal displayed values do not prove that all distinct nodes survived. The acyclic precondition is essential; this routine is not a cycle detector.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Count a chain', prompt: 'Count nodes in 8 -> 8 -> null without changing any links. Return zero for null.', hints: ['Advance a cursor by next until null.', 'Count positions, even when values repeat.'], solution: 'Set count = 0 and cursor = head. While cursor is not null, increment count and advance cursor = cursor.next. The sample returns 2. The cursor marks the first uncounted node, so each node contributes once. Time O(n), auxiliary space O(1), assuming a finite acyclic chain.', checklist: ['I preserve links.', 'I count both equal-valued nodes.'] },
    { id: 'stretch', title: 'Detect a cycle without extra storage', prompt: 'Return whether a singly linked structure contains a cycle. Explain the result for A -> B -> C -> B and for null.', hints: ['Move one cursor one step and another two steps.', 'Compare node identity, not value, after advancing.'], solution: 'Initialize slow and fast at head. While fast and fast.next exist, move slow once and fast twice; return true if they are identical. Otherwise return false when the fast path reaches null. In a cycle, the relative position advances one step per iteration modulo cycle length, so a meeting is inevitable. The sample is true and null is false. Time O(n) in distinct reachable nodes, auxiliary space O(1).', checklist: ['I guard both fast dereferences.', 'I explain eventual meeting rather than relying on one trace.'] },
  ],
  followUps: [
    { question: 'Why is an array reversal different?', answer: 'Array reversal exchanges values at accessible indices. A singly linked list has no constant-time backward access; rewiring remembered next references is the natural linear traversal.' },
    { question: 'Can recursive reversal use constant space?', answer: 'Ordinary recursion keeps O(n) active frames for this chain. Iterative rewiring avoids that stack; do not assume a runtime performs tail-call elimination.' },
  ],
  takeaways: ['Preserve a reference before destroying its only access path.', 'Use a partition invariant for mutation-heavy loops.', 'Test object identity and termination as well as values.'],
})

const binary = enrich('binary-search-lower-bound', {
  minutes: 50,
  prerequisites: [arrays.id, pointers.id],
  prerequisiteNotes: 'Know sorted arrays and half-open bounds. Integer division rounds down.',
  concepts: [
    { title: 'A boundary is more general than membership', body: 'Lower bound supports insertion, threshold counts, and duplicate ranges even when equality never occurs. Its answer space includes n, unlike element indices. For membership, check that the returned boundary is below n before reading its element and comparing for equality.' },
    { title: 'Write the predicate before writing the loop', body: 'The predicate values[i] >= target is false then true. One observation therefore classifies an entire side of the search. If the predicate switches back and forth, that elimination is unjustified. Binary search is a monotonicity argument, not simply visiting middle positions.' },
  ],
  walkthrough: [
    { title: 'Check the smallest undecided interval', body: 'When high = low + 1, middle equals low. A true predicate sets high to low; false sets low to high. Both terminate. Using low = middle instead would loop forever. Also trace empty input and an all-false array to audit the boundary n.' },
    { title: 'Use a result certificate', body: 'For returned k, all earlier values must be below target, and values[k] must qualify if k < n. This independently testable certificate catches returning a later duplicate. Calculating middle as low plus half the difference also avoids adding two potentially large indices.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Linear boundary oracle', prompt: 'Find the first value at least 5 in [1,4,6,6] by a left-to-right scan; explain the result for [].', hints: ['Return immediately on the first qualifying value.', 'The fallback position is the array length.'], solution: 'Scan indices in increasing order and return the first whose value is at least target. The sample returns 2 and empty input returns 0. Earlier values were explicitly checked and rejected. Time O(n), auxiliary space O(1). This slower, simple method is a useful independent oracle for validating binary search on small generated arrays.', checklist: ['I return a boundary rather than a value.', 'I use n when no index qualifies.'] },
    { id: 'stretch', title: 'Count a duplicate run', prompt: 'Count target occurrences using two boundaries. For [1,3,3,3,8], target 3, return 3.', hints: ['Find the first value >= target and the first value > target.', 'The difference between those boundaries is a half-open interval length.'], solution: 'Compute lower with >= and upper with >; return upper - lower. Boundaries 1 and 4 give 3. Absent targets make boundaries coincide, including empty input. Time O(log(n + 1)), auxiliary space O(1). Avoid target + 1, which can overflow; change the predicate instead.', checklist: ['I change the predicate consistently.', 'I handle absence without scanning.'] },
  ],
  followUps: [
    { question: 'Is this logarithmic on linked lists?', answer: 'Not with ordinary traversal: reaching middle positions lacks constant-time indexing. Comparison count alone does not capture the access cost.' },
    { question: 'Can we search feasible capacities?', answer: 'Yes, with monotone feasibility and bounds covering the answer. Multiply iteration count by feasibility-test cost when reporting runtime.' },
  ],
  takeaways: ['Search answer boundaries without reading outside element bounds.', 'Prove progress on a one-position interval.', 'Choose a monotone predicate and state its false and true regions.'],
})

const sorting = lesson({
  id: 'sorting-stable-merge',
  title: 'Sorting: merge ordered runs stably',
  minutes: 50,
  summary: 'Build a bottom-up merge sort and account for stability, copying, and repeated passes.',
  prerequisites: [arrays.id, pointers.id, binary.id],
  prerequisiteNotes: 'Know half-open intervals, array buffers, and comparing ordered values. Recursion is not required for bottom-up sorting.',
  objectives: ['Merge two ordered runs without skipping or duplicating records.', 'Explain how a tie rule preserves stability.', 'Derive O(n log n) work from linear passes and doubling run width.'],
  concepts: [
    { title: 'Sorted runs are reusable evidence', body: 'A run of length one is already sorted. Merging two sorted runs requires comparing only their first unconsumed records, because no later record in either run is smaller. Emit the smaller head and advance only that run. Repeating this operation builds a larger sorted run. Unlike a general pair search, the output must retain every record, including equal values, so running out of one side means copying the remainder of the other.' },
    { title: 'Stability preserves earlier order', body: 'A stable sort leaves equal-key records in their original relative order. When merging adjacent runs, choose the left record on a tie. Its original position preceded every right-run record, and each run already preserves its own ties. Stability matters when records carry labels or when a previous ordering should remain a secondary ordering. Plain equal numbers cannot reveal stability in tests; labeled records can.' },
    { title: 'Bottom-up passes replace recursive splitting', body: 'Begin with run width one, merge adjacent runs, then double width. An unmatched final run is copied normally using clipped boundaries. Each pass reads and writes O(n) records; after O(log n) passes one run spans the input. Reusing two n-sized buffers keeps peak auxiliary storage O(n). Allocating a fresh output per merge can obscure this bound and cause needless allocation overhead, even if asymptotic peak memory remains linear.' },
  ],
  example: 'stableSort([(3,"a"),(1,"b"),(3,"c"),(2,"d")]) returns [(1,"b"),(2,"d"),(3,"a"),(3,"c")], ordered by the first field.',
  task: 'Write stableSort(records), a nonmutating bottom-up merge sort for records (integer key, label). Return a new array sorted by key with stable equal-key order. n is at most 100000 and may be zero. Labels are opaque data, not tie breakers. Use O(n log(n + 1)) time and O(n) auxiliary storage; assume constant-time key comparison.',
  starter: `function stableSort(records):
    source = copy of records
    target = array of length length(records)
    width = 1
    // Merge adjacent runs, then exchange buffer roles.
    return source`,
  hints: ['Use mid = min(start + width, n) and end = min(start + 2 * width, n).', 'Take from the left when keys are equal; handle either exhausted run before reading its head.'],
  solution: `function stableSort(records):
    n = length(records)
    source = copy of records
    target = array of length n
    width = 1
    while width < n:
        for start from 0 to n - 1 stepping 2 * width:
            mid = min(start + width, n)
            end = min(start + 2 * width, n)
            i = start
            j = mid
            for out from start to end - 1:
                if i < mid and (j == end or source[i].key <= source[j].key):
                    target[out] = source[i]
                    i = i + 1
                else:
                    target[out] = source[j]
                    j = j + 1
        exchange source and target
        width = 2 * width
    return source

The sample first forms [(1,b),(3,a)] and [(2,d),(3,c)]. Their merge emits 1, then 2, then left 3 before right 3. By induction each pass produces stable sorted runs twice as wide. Every output position is written once per pass. Time O(n log(n + 1)), including the initial copy; peak auxiliary space O(n) and returned array O(n). Empty and singleton inputs skip merging but still return a new array.`,
  checklist: ['I preserve every record exactly once.', 'I choose the left run on equal keys.', 'I handle an incomplete last run and preserve input order.'],
  pitfalls: ['Using < instead of <= can reverse equal-key groups across runs.', 'Reading a run head after its end causes invalid access.', 'Returning the inactive buffer loses the last completed pass.'],
  walkthrough: [
    { title: 'An odd-sized pass', body: 'With five records and width two, the first merge combines positions [0,2) and [2,4). The second has left run [4,5) and empty right run [5,5). Its exhaustion checks copy the final record safely. This is why clipped half-open boundaries are useful: a leftover run needs no separate algorithm and no invented padding values that might collide with real keys.' },
    { title: 'Prove more than sortedness', body: 'A correct output is sorted, is a permutation of input records, and preserves equal-key relative order. Test all three properties. An accidentally duplicated record might still leave keys sorted, while a swapped pair of equal keys would pass both sortedness and value-count checks. Keeping unique labels in a test distinguishes identities without changing the comparator. Also verify the original array remains unchanged, since mutation is explicitly forbidden.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Merge two short runs', prompt: 'Merge [1,4] and [2,4,5] into one sorted sequence. Mark equal 4s by their originating side.', hints: ['Compare only the unconsumed heads.', 'Choose left 4 before right 4.'], solution: 'Emit 1,2,4-left,4-right,5. At each step the smaller remaining head is globally smallest among remaining values. Merging lengths a and b takes O(a + b) time, O(1) working cursor space, and O(a + b) output space. An empty side is handled by copying the other.', checklist: ['I retain both 4s.', 'I copy the remaining suffix.'] },
    { id: 'stretch', title: 'Count inversions during merging', prompt: 'Count pairs i < j with values[i] > values[j]. For [3,1,2], return 2. Explain how merging can count them efficiently.', hints: ['When a right value beats the left head, all remaining left values are larger.', 'Equal values are not inversions.'], solution: 'During each merge, when right is strictly smaller, add mid - i before emitting it. Count inversions inside smaller runs on earlier passes and cross-run inversions on their merge. [3,1,2] contains (3,1) and (3,2). Each pair crosses exactly one merge boundary, so it is counted once. Time O(n log(n + 1)), auxiliary space O(n), and a wide integer count may be needed.', checklist: ['I add the entire remaining left-run length.', 'I exclude ties from the count.'] },
  ],
  followUps: [
    { question: 'Why not always use insertion sort?', answer: 'Insertion sort can be simple and efficient for tiny or nearly sorted inputs, but shifting across a reverse-ordered array takes O(n squared) time. Merge passes provide a predictable worst-case bound.' },
    { question: 'Does O(n log n) apply to all sorting?', answer: 'It is a comparison-sorting benchmark, not a universal lower bound for every model. Bounded integer domains allow counting approaches with costs depending on the domain size.' },
  ],
  takeaways: ['A merge consumes two sorted frontiers without rescanning.', 'Stable ordering is an explicit equality decision.', 'Verify ordering, permutation, stability, and mutation separately.'],
})

const recursion = lesson({
  id: 'recursion-fast-power',
  title: 'Recursion: contracts, progress, and the call stack',
  minutes: 45,
  summary: 'Derive exponentiation by squaring with a smaller recursive subproblem and an explicit base case.',
  prerequisites: [arrays.id, binary.id, sorting.id],
  prerequisiteNotes: 'Know function parameters, return values, integer division, and logarithmic halving. Each recursive call has its own local variables.',
  objectives: ['Identify a base case and a decreasing nonnegative measure.', 'Use a recursive result without expanding every nested call mentally.', 'Account for both arithmetic work and active stack frames.'],
  concepts: [
    { title: 'A recursive call has a contract', body: 'To compute power(base, exponent), assume a call with a smaller exponent returns the correct power. Your job is to combine that result correctly and ensure the smaller call is genuinely closer to a base case. This is induction expressed as a program. Trying to remember every active frame at once makes the code feel mysterious; a precise function contract lets each frame reason locally while the proof connects all frames.' },
    { title: 'Halving exposes reusable work', body: 'For an even exponent 2k, base raised to 2k equals the square of base raised to k. For an odd exponent 2k + 1, multiply that square by base once more. Compute the half-power once and store it. Calling the same recursive expression twice duplicates the entire subtree of work and destroys the intended logarithmic operation count. The shape of the call tree matters as much as its depth.' },
    { title: 'Frames consume memory', body: 'A pending call retains its parameters and waits to square the recursive answer, so ordinary runtimes keep one frame per halving level. The stack is O(log(exponent + 1)), not O(1). For arbitrary-precision integers, multiplication cost depends on operand size. This lesson reports the number of arithmetic operations under a unit-cost numeric model; it does not claim that multiplying enormous exact integers always takes constant real time.' },
  ],
  example: 'power(3,5) returns 243. Exponents descend 5 -> 2 -> 1 -> 0; returns are 1,3,9,243.',
  task: 'Write power(base, exponent) for integer base and nonnegative integer exponent. Define exponent zero to return 1, including power(0,0). Assume arithmetic is exact and report arithmetic-operation complexity separately from large-integer bit costs. Do not use a built-in exponent operator. Trace power(-2,3) = -8 and power(7,0) = 1.',
  starter: `function power(base, exponent):
    // Return the identity for the empty product.
    // Recursively compute one half-power and combine it.`,
  hints: ['An exponent of zero needs no recursive work.', 'The parity of exponent determines whether a final factor of base is needed.'],
  solution: `function power(base, exponent):
    if exponent == 0:
        return 1
    half = power(base, floor(exponent / 2))
    result = half * half
    if exponent modulo 2 == 1:
        result = result * base
    return result

For power(3,5), exponent 0 returns 1; exponent 1 returns 1 * 1 * 3 = 3; exponent 2 returns 3 * 3 = 9; exponent 5 returns 9 * 9 * 3 = 243. Nonnegative exponent strictly decreases until zero. Assuming the half-power is correct, the even and odd algebra establishes the caller’s result. There are O(log(exponent + 1)) arithmetic operations for positive exponent and constant base-case work; stack space O(log(exponent + 1)) with a constant minimum frame. Exact integer bit time and storage grow with result size.`,
  checklist: ['I handle zero before recursing.', 'I compute the half-power once per frame.', 'I include pending frames and numeric assumptions in complexity.'],
  pitfalls: ['Recursing on an unchanged exponent never reaches the base.', 'Computing the half-power twice duplicates work.', 'Allowing negative exponents without a new contract can cause nontermination or wrong numeric types.'],
  walkthrough: [
    { title: 'Descending calls and returning values are different phases', body: 'The descending phase only establishes smaller exponents; it does not yet know the large result. The returning phase squares known smaller answers. Draw separate columns for exponent and returned value in the example. This distinction becomes especially useful in trees, where a parent must wait for child summaries. A printed trace that mixes call entry and return without labels can make a correct recursive order look inconsistent.' },
    { title: 'Start with a slower recurrence', body: 'The straightforward recurrence multiplies base by power(base, exponent - 1), requiring exponent calls. It is correct but can exhaust the call stack for large exponents. Halving changes the decreasing measure much faster while using algebra to recover the skipped factors. Optimization here is not removing recursion; it is choosing a better subproblem. The same recurrence can later be converted to a loop with an accumulator if constant stack space is needed.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Sum a prefix recursively', prompt: 'Define sumFirst(values, k), summing the first k values for 0 <= k <= length(values). Trace [2,5,1] with k = 2.', hints: ['The first zero values sum to zero.', 'Separate values[k - 1] from the first k - 1 values.'], solution: 'Return 0 when k = 0; otherwise return sumFirst(values, k - 1) + values[k - 1]. The sample returns 2 + 5 = 7. Every call reduces k, and the final element is included exactly once. Time O(k), stack O(k) with a constant base frame. An iterative scan achieves the same time with constant auxiliary space.', checklist: ['I do not read an element at k = 0.', 'I distinguish stack space from input storage.'] },
    { id: 'stretch', title: 'Exponentiation modulo a bound', prompt: 'Compute base raised to exponent modulo positive m without constructing the full power. Verify base 3, exponent 5, m 7 gives 5.', hints: ['Reduce the base and each multiplication result modulo m.', 'The zero-exponent identity becomes 1 modulo m.'], solution: 'Return 1 modulo m at exponent zero, then reduce each squared half-power and extra base multiplication modulo m. Reduction preserves product residue, so the recurrence remains correct. 243 modulo 7 is 5; m = 1 always returns 0. Time and stack space are O(1 + log(exponent + 1)) under unit-cost arithmetic. Normalize negative residues consistently; intermediate products still need sufficient width or safe modular multiplication.', checklist: ['I handle m = 1.', 'I do not confuse small residues with guaranteed safe products.'] },
  ],
  followUps: [
    { question: 'Is recursion automatically slower than iteration?', answer: 'No universal rule applies. Call overhead and stack limits matter, but the recurrence and work count usually matter more. Both forms can implement the same algorithm with different space behavior.' },
    { question: 'Why explicitly define zero to the zero power here?', answer: 'The task needs an unambiguous return value. Defining every zero exponent as the empty product 1 makes the programming contract consistent; broader mathematical contexts can use different conventions.' },
  ],
  takeaways: ['Trust a smaller-call contract, then prove the combination.', 'Name a measure that decreases toward the base case.', 'Count repeated calls and retained frames, not just source lines.'],
})

const trees = lesson({
  id: 'trees-bst-validation',
  title: 'Trees and BSTs: propagate global constraints',
  minutes: 50,
  summary: 'Validate a strict binary search tree by carrying ancestor bounds, not merely comparing parent and child.',
  prerequisites: [linked.id, recursion.id, stack.id],
  prerequisiteNotes: 'Know node references and recursive contracts. A binary tree is finite and acyclic; each node has at most a left child and a right child.',
  objectives: ['Describe preorder, inorder, and postorder traversal roles.', 'Distinguish local child comparisons from ancestor constraints.', 'Analyze recursive tree work by node count and stack depth by height.'],
  concepts: [
    { title: 'Structure is not ordering', body: 'A binary tree only limits the number of children. A strict binary search tree additionally requires every value in a node’s left subtree to be smaller and every value in its right subtree to be larger. Those requirements apply to all descendants, not just immediate children. This lesson rejects duplicate keys; other BST designs can allow duplicates with a different documented side rule. The representation alone does not establish any ordering guarantee.' },
    { title: 'Carry the allowed interval', body: 'Each recursive frame receives optional exclusive lower and upper bounds inherited from ancestors. A left child inherits the lower bound and receives the parent value as upper bound. A right child receives the parent value as lower bound and inherits the upper bound. An absent bound means unrestricted, not a magic integer sentinel. Real minimum or maximum integer keys must remain valid when there is no constraint on that side.' },
    { title: 'Traversal order serves the question', body: 'Preorder processes a node before descendants, useful for rejecting an invalid key immediately. Inorder visits left, node, right; on a strict BST it produces a strictly increasing sequence. Postorder visits descendants before the node, useful when computing height or subtree totals. Each full traversal visits n nodes in O(n) time, but recursive storage follows height h. A chain has h = n; only balanced trees guarantee logarithmic height.' },
  ],
  example: 'isStrictBST(8 with left 3 and right 10 whose left child is 6) returns false: 6 violates the inherited lower bound 8. isStrictBST(8 with left 3 and right 10) returns true.',
  task: 'Write isStrictBST(root), returning whether a supplied finite binary tree obeys strict BST order. Values are integers and duplicates are invalid. Nodes have value, left, and right; null is an empty tree and returns true. n is at most 10000; report stack depth and discuss an explicit-stack alternative for deep inputs. Do not mutate nodes.',
  starter: `function isStrictBST(root):
    return validate(root, absent, absent)

function validate(node, lower, upper):
    // Check inherited exclusive bounds, then refine them for children.`,
  hints: ['A right-subtree descendant must exceed every relevant ancestor, not just its parent.', 'Passing an absent bound avoids excluding an extreme integer key.'],
  solution: `function isStrictBST(root):
    return validate(root, absent, absent)

function validate(node, lower, upper):
    if node == null:
        return true
    if lower is present and node.value <= lower:
        return false
    if upper is present and node.value >= upper:
        return false
    return validate(node.left, lower, node.value)
           and validate(node.right, node.value, upper)

At root 8, the right child 10 receives lower = 8. Its left child 6 receives interval (8,10), so validation fails despite 6 being smaller than its parent. Each frame verifies its root and delegates strictly refined constraints, covering every ancestor requirement. Empty subtrees satisfy the condition vacuously. Worst-case time O(n); auxiliary stack O(h), up to O(n) for a chain. An explicit stack of (node, lower, upper) frames avoids runtime recursion limits while retaining the same worst-case bounds.`,
  checklist: ['I enforce inherited bounds at every node.', 'I reject duplicates and accept an empty tree.', 'I do not assume a supplied tree is balanced.'],
  pitfalls: ['Checking only immediate children misses deep ancestor violations.', 'Using inclusive comparisons accidentally accepts duplicates.', 'Using numeric sentinels can reject legitimate extreme keys.'],
  walkthrough: [
    { title: 'Draw the hidden violation', body: 'The invalid example passes every immediate parent check: 3 is below 8, 10 above 8, and 6 below 10. Yet an inorder traversal yields 3,8,6,10, which is not increasing. Bound propagation identifies the precise failed obligation, 6 > 8, without materializing that sequence. This is the tree analogue of retaining unresolved context: the recursive path carries constraints that a local view would forget.' },
    { title: 'Separate validation from search', body: 'A search in an already-valid BST can follow one child per comparison. Validation cannot generally do that because a violation may hide anywhere, so worst-case work visits every node. Furthermore, even valid BST search is O(h), not automatically O(log n). Inserting sorted keys into an unbalanced structure can produce a chain. Treat shape guarantees and ordering guarantees as separate assumptions when discussing performance.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Count tree nodes', prompt: 'Return the node count of a binary tree. A root with two leaf children has count 3; null has count 0.', hints: ['Empty subtrees contribute zero.', 'Combine the current node with both child counts.'], solution: 'Return 0 for null; otherwise return 1 + count(left) + count(right). Each node belongs to exactly one child subtree or is the current root, so no node is counted twice. Time O(n), stack O(h). Ordering is irrelevant: this works on any finite binary tree, not just a BST.', checklist: ['I include both children.', 'I return zero for an absent subtree.'] },
    { id: 'stretch', title: 'Return the kth smallest key', prompt: 'Given a valid strict BST and positive k, return the kth smallest key or absent if fewer than k nodes exist. In the valid 8/3/10 example, k = 2 returns 8.', hints: ['Inorder traversal emits sorted keys.', 'An explicit stack can pause traversal after k visits.'], solution: 'Push the left spine, pop the next node and increment a visit count, then continue from its right child. Return when the count reaches k; return absent if traversal ends first. The inorder invariant makes the kth visit the kth smallest. Time O(h + k) when k exists, O(n) otherwise; stack O(h). Do not confuse key value with rank, and do not sort all values unnecessarily.', checklist: ['I count visits rather than compare keys to k.', 'I define the out-of-range result.'] },
  ],
  followUps: [
    { question: 'Can repeated references be treated as a tree?', answer: 'Not under this contract. Shared children or cycles form a more general graph and can cause double counting or nontermination. Validating that representation requires separate visited-identity checks.' },
    { question: 'Would inorder validation also work?', answer: 'Yes. Compare each visited key with the previous key using strict increase, without storing the whole traversal. It has O(n) time and O(h) stack, but still needs a safe “no previous value” state.' },
  ],
  takeaways: ['Global tree properties need ancestor context or an equivalent traversal invariant.', 'Node count determines full-traversal work; height determines recursive depth.', 'Ordering does not imply balance.'],
})

const heaps = lesson({
  id: 'heaps-top-k',
  title: 'Heaps: keep the best k candidates',
  minutes: 50,
  summary: 'Maintain a small min-heap whose root is the weakest retained candidate.',
  prerequisites: [arrays.id, trees.id, sorting.id],
  prerequisiteNotes: 'Know binary-tree shape and array indexing. A heap gives partial order, not a completely sorted sequence.',
  objectives: ['Map a complete binary tree to array parent and child indices.', 'Repair a heap after insertion and root replacement.', 'Prove that a size-k heap retains the k largest values seen.'],
  concepts: [
    { title: 'Only the root is globally extremal', body: 'In a min-heap every parent is no greater than either child. Therefore the root is a minimum, but siblings and distant subtrees need not be ordered. A complete tree packs levels from left to right, enabling array storage: children of index i are 2i + 1 and 2i + 2, and a nonroot parent is floor((i - 1)/2). Its height is logarithmic in size regardless of the input arrival order.' },
    { title: 'Repair along one path', body: 'Appending a value preserves shape but may violate the relation with its parent; sift it upward while smaller. Replacing the root preserves every relation except possibly along a downward path. Compare both existing children, swap with the smaller when necessary, and continue. Choosing the smaller child is essential: swapping with a larger child can leave the other child smaller than its new parent. Each repair crosses at most the tree height.' },
    { title: 'The root defines the retention threshold', body: 'To retain the largest k values, use a min-heap of those candidates. Its minimum is the easiest retained value to evict. Once full, an incoming value no larger than the root cannot improve the collection; a larger one replaces the root. This is deliberately the opposite heap orientation from “retrieve the largest next.” Duplicates count as separate occurrences, so the kth largest is a rank among positions, not distinct values.' },
  ],
  example: 'kthLargest([5,1,5,3,8], 3) returns 5. The retained multiset ends as {5,5,8}; its minimum is the third largest.',
  task: 'Write kthLargest(values, k) using a min-heap containing at most k values. Count duplicates separately. Return absent when k < 1 or k > n, including empty input. n is at most 100000. Do not modify values or sort the entire input. Describe push and root-replacement repair, not just an unexplained priority-queue call.',
  starter: `function kthLargest(values, k):
    if k < 1 or k > length(values):
        return absent
    heap = empty min-heap
    // Fill k slots, then improve the minimum retained value.
    return heap[0]`,
  hints: ['The heap should expose the smallest retained candidate.', 'After replacing its root, only a downward repair is needed.'],
  solution: `function kthLargest(values, k):
    if k < 1 or k > length(values):
        return absent
    heap = empty list
    for value in values:
        if length(heap) < k:
            append value to heap
            i = length(heap) - 1
            while i > 0:
                parent = floor((i - 1) / 2)
                if heap[parent] <= heap[i]:
                    break
                exchange heap[parent] and heap[i]
                i = parent
        else if value > heap[0]:
            heap[0] = value
            i = 0
            while 2 * i + 1 < length(heap):
                child = 2 * i + 1
                if child + 1 < length(heap) and heap[child + 1] < heap[child]:
                    child = child + 1
                if heap[i] <= heap[child]:
                    break
                exchange heap[i] and heap[child]
                i = child
    return heap[0]

The first three sample values fill {1,5,5}. Value 3 evicts 1; value 8 evicts 3, leaving {5,5,8}. After each input, the heap retains the largest min(k, processed count) values: a rejected value is no better than every retained value, while replacement removes exactly the weakest candidate. Heap repairs preserve that multiset. Time O(n log(k + 1)), auxiliary space O(k); the result is one value, not a sorted heap array.`,
  checklist: ['I select a min-heap for the largest-k retention task.', 'I compare both children during sift-down.', 'I handle invalid ranks and count repeated values.'],
  pitfalls: ['Returning heap[k - 1] assumes the heap array is sorted.', 'Using a max-heap of k values evicts the wrong candidate.', 'Ignoring a right child can break the heap invariant.'],
  walkthrough: [
    { title: 'Two invariants cooperate', body: 'The structural invariant says the buffer is a valid min-heap. The selection invariant says its multiset is the best retained k values. A perfectly repaired heap of the wrong candidates would satisfy only the first. Conversely, keeping the correct candidates in an arbitrary array would require scanning for the minimum on every update. Trace both the threshold and the heap relation so the selection proof and data-structure proof remain distinct.' },
    { title: 'Understand the k extremes', body: 'At k = 1 the heap acts like a running maximum, using constant space and linear work. At k = n it retains all values and the root becomes the minimum of the entire input. Sorting also answers this rank query, but retains and orders more information than needed when k is small. If many rank queries follow on the same static array, paying once for full sorting may become a reasonable alternative.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Repair one insertion', prompt: 'Insert 1 into min-heap [2,4,3] and show its final array.', hints: ['Append at index 3 to preserve complete shape.', 'Compare with parent indices 1, then 0.'], solution: 'Append to get [2,4,3,1], swap with 4 to get [2,1,3,4], then with 2 to get [1,2,3,4]. Only the new ancestor path can violate order. Time O(log(h + 1)) for heap size h, O(1) repair variables besides heap storage; this particular insertion performs two swaps.', checklist: ['I append before sifting.', 'I stop at a valid parent relation or the root.'] },
    { id: 'stretch', title: 'Merge several ordered feeds', prompt: 'Merge r sorted arrays with a heap of current heads. For [[1,4],[1,3],[]], return [1,1,3,4].', hints: ['Store value, source ID, and position together.', 'After emitting a head, insert only its source’s next item.'], solution: 'Initialize one heap entry per nonempty source. Repeatedly extract the minimum, emit it, and add that source’s successor if any. Every source head is its smallest remaining value, so the smallest head is globally next. Tie-break by source ID and position if deterministic equal-value order is required. For N total values, time O(r + N log(r + 1)), auxiliary heap O(r), output O(N).', checklist: ['I keep source identity with each value.', 'I skip empty sources safely.'] },
  ],
  followUps: [
    { question: 'Can heap construction be linear?', answer: 'Yes, sifting internal nodes downward from the last parent builds a heap in O(n) time because most nodes have very small height. Repeated insertion has a simpler O(n log n) bound but is not the optimal bulk construction.' },
    { question: 'Does rejecting an equal root lose a duplicate?', answer: 'No for a value-only kth-rank result: replacing one equal occurrence by another leaves the retained multiset unchanged. Returning specific occurrence identities would require an explicit tie policy.' },
  ],
  takeaways: ['Heap order exposes an extremum, not a sorted sequence.', 'Keep the weakest retained candidate cheaply accessible.', 'Prove candidate selection separately from structural repair.'],
})

const bfs = enrich('graph-bfs-shortest-hops', {
  minutes: 55,
  prerequisites: [arrays.id, queues.id, trees.id],
  prerequisiteNotes: 'Know FIFO queues, indexed visited state, and tree traversal. Graphs may contain cycles and disconnected vertices, unlike trees.',
  concepts: [
    { title: 'Representation belongs in the algorithm', body: 'An adjacency matrix stores O(V squared) entries and scans O(V) potential neighbors per vertex, even for sparse graphs. Adjacency lists scan only actual entries. “Linear BFS” therefore describes vertices plus adjacency entries, not every possible representation.' },
    { title: 'A discovery tree explains paths', body: 'Record parent[v] = u on first discovery to reconstruct one shortest route backward from destination. Parent links form a tree despite graph cycles. Neighbor order may change the chosen route without changing distances; store parents only when a witness is needed.' },
  ],
  walkthrough: [
    { title: 'Why enqueue-time marking is decisive', body: 'In the diamond, 1 and 2 both lead to 3. Discovering 3 from 1 assigns its distance before enqueueing, so 2 cannot enqueue another copy. Waiting until removal permits duplicates; the worklist should correspond to unique discoveries.' },
    { title: 'Explain unreachable and zero separately', body: 'The start has distance zero, while an unreachable vertex retains -1. Initializing everything to zero merges these meanings and breaks discovery. Initializing the full distance array still costs O(V) even when the reachable component is tiny.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'One layer only', prompt: 'For n = 4 and edges [[0,1],[0,2]], list vertices one hop from 0 and the unreachable vertex.', hints: ['Build both adjacency directions.', 'A start neighbor needs exactly one edge.'], solution: 'The one-hop set is {1,2}; vertex 3 is unreachable, while 0 has distance zero. Construction uses O(V + E) time and space; listing neighbors takes O(degree(0)) time plus output. This edge list proves isolation; one-layer exploration alone generally cannot.', checklist: ['I exclude the start.', 'I account for isolated vertices.'] },
    { id: 'stretch', title: 'Several starting points', prompt: 'Find nearest-source distances. For path 0-1-2-3-4 and sources [0,4], return [0,1,2,1,0].', hints: ['Initialize distinct sources at distance zero.', 'Enqueue all sources before expanding neighbors.'], solution: 'Initialize -1 distances, then mark and enqueue distinct sources at zero before running BFS. Increasing layers now measure distance from the source set, proving first discovery minimal. Empty sources leave -1 everywhere. Time O(V + E + supplied sources), adjacency space O(V + E), auxiliary O(V).', checklist: ['I deduplicate sources.', 'I initialize all sources before expansion.'] },
  ],
  followUps: [
    { question: 'Can target-only search stop early?', answer: 'Yes, on target discovery. Its distance is final; the core all-distances task must continue.' },
    { question: 'Why not weighted edges?', answer: 'Queue layers count edges, not weight. A two-edge route might cost less; weighted paths need another ordering argument.' },
  ],
  takeaways: ['Mark discovery before scheduling future work.', 'FIFO order is the reason hop distances are shortest.', 'Include representation construction and unreachable-state initialization in costs.'],
})

const dfs = lesson({
  id: 'graph-dfs-components',
  title: 'Graph DFS: explore connected components',
  minutes: 45,
  summary: 'Use an explicit stack and a whole-graph outer scan to discover every undirected component.',
  prerequisites: [stack.id, recursion.id, bfs.id],
  prerequisiteNotes: 'Know adjacency lists, undirected edges, and marking on discovery. DFS changes worklist order, not the meaning of reachability.',
  objectives: ['Implement iterative depth-first exploration without recursive stack limits.', 'Cover disconnected vertices using an outer loop.', 'Distinguish reachability claims from shortest-path claims.'],
  concepts: [
    { title: 'A stack follows the newest frontier', body: 'Depth-first exploration uses last-in, first-out scheduling, tending to pursue recently discovered branches before older pending branches. An explicit stack avoids relying on the runtime’s call-depth limit. Its exact visitation order depends on neighbor order and push order. For component sizes, no particular order is required: all that matters is that each reachable vertex is eventually processed once. Do not attach BFS’s shortest-hop guarantee to a different scheduling policy.' },
    { title: 'One search covers one component', body: 'A component is a maximal set of vertices connected by undirected paths. Starting from an unseen root reaches exactly that root’s component. After its stack empties, scan for another unseen root. Isolated vertices are components of size one, not missing data. The outer scan is essential: a correct traversal from vertex zero can still produce an incomplete whole-graph result if other components exist.' },
    { title: 'Visited state outlives one search', body: 'Keep one visited array for the entire graph, marking a vertex before pushing it. If a discovered vertex has several neighbors leading back to it, they all observe it as already scheduled. Resetting visited for each root would explore old components repeatedly and double-count them. The stack may empty between components, but global classification must remain. The same distinction appears in many algorithms with per-component work and whole-input bookkeeping.' },
  ],
  example: 'componentSizes(6, [[0,1],[1,2],[2,0],[3,4]]) returns [3,2,1], ordered by the smallest vertex in each component.',
  task: 'Write componentSizes(n, edges) for an undirected graph with vertices 0 through n - 1. Return sizes in the order obtained by scanning possible roots in increasing ID order. n may be zero and is at most 100000; endpoints are valid, and duplicate edges and self-loops are permitted. Include adjacency construction. Use an explicit stack and do not mutate edges.',
  starter: `function componentSizes(n, edges):
    neighbors = n empty lists
    // Add both directions.
    seen = array of n copies of false
    sizes = empty list
    // Start a new exploration for each unseen root.
    return sizes`,
  hints: ['The outer loop must include every vertex, even those absent from the edge list.', 'Mark each root and neighbor when pushing, not when popping.'],
  solution: `function componentSizes(n, edges):
    neighbors = n empty lists
    for [a, b] in edges:
        append b to neighbors[a]
        append a to neighbors[b]
    seen = array of n copies of false
    sizes = empty list
    for root from 0 to n - 1:
        if seen[root]:
            continue
        stack = [root]
        seen[root] = true
        size = 0
        while stack is not empty:
            u = pop stack
            size = size + 1
            for v in neighbors[u]:
                if not seen[v]:
                    seen[v] = true
                    push v onto stack
        append size to sizes
    return sizes

The triangle 0,1,2 yields size 3 despite its cycle. The next unseen root is 3, reaching 4 for size 2; root 5 yields size 1. Every pushed vertex has a path to its root. Conversely, if a reachable vertex were omitted, the first missing vertex on its path would have been discovered by its processed predecessor. Components are disjoint and roots are considered increasingly. Time O(n + E), adjacency space O(n + E), auxiliary seen/stack O(n), and output O(number of components).`,
  checklist: ['I retain visited state across component searches.', 'I include isolated nodes and n = 0.', 'I never claim stack discovery gives shortest distances.'],
  pitfalls: ['Starting from only vertex zero misses disconnected components.', 'Counting pushes without discovery marking can count a vertex repeatedly.', 'Treating a directed graph as undirected changes the question.'],
  walkthrough: [
    { title: 'Trace the cycle without repetition', body: 'At root 0, mark before scheduling. Scanning its neighbors discovers 1 and 2. Whichever is popped next sees the other already marked, so the triangle cannot multiply stack entries. A self-loop is also harmless because its endpoint is already seen. Duplicate edges cost extra adjacency scans but do not change the output. Count E as the number of supplied entries, including duplicates, when stating the bound.' },
    { title: 'Understand what iterative DFS does not reproduce', body: 'This compact worklist traversal is sufficient for reachability and component sizes. It does not preserve recursive entry-and-exit events exactly: several siblings can be marked before one is processed. Algorithms needing postorder, active-path cycle detection, or discovery finishing times require richer explicit frames or another carefully defined traversal. Replacing recursion with a stack is not automatically equivalent for every observable event.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Reachable membership', prompt: 'For edges [[0,1],[1,2]] on four vertices, determine whether 2 and 3 are reachable from 0.', hints: ['Maintain a single visited set from source 0.', 'An absent edge path leaves vertex 3 unmarked.'], solution: 'A stack starts with 0, then discovers 1 and 2. Thus 2 is reachable and 3 is not. DFS or BFS is sufficient because only existence, not shortest length, is asked. With adjacency already built, traversal time is O(reachable vertices + their adjacency entries), auxiliary space O(V) in the worst case.', checklist: ['I use visited state to avoid repeats.', 'I do not infer reachability from vertex numbering.'] },
    { id: 'stretch', title: 'Largest land region', prompt: 'In a rectangular 0/1 grid, find the largest four-directionally connected region of ones without mutating the grid. For [[1,0,1],[1,1,0]], return 3.', hints: ['Treat each land cell as a vertex with at most four neighbors.', 'Start a stack only at unseen land cells.'], solution: 'Scan cells; for unseen land, mark and flood with an explicit stack, counting that region and updating a maximum. The left region has three cells; the upper-right cell is isolated because diagonal touching does not count. Empty or all-water grids return zero. For R rows and C columns, time O(RC), auxiliary visited/stack O(RC); implicit neighbors avoid storing an adjacency list.', checklist: ['I use four directions rather than diagonals.', 'I mark before pushing and preserve the input.'] },
  ],
  followUps: [
    { question: 'Can this count strongly connected directed components?', answer: 'No. Undirected components use symmetric reachability. Strong connectivity requires mutual directed reachability and a different algorithm; adding reverse edges would erase the distinction.' },
    { question: 'Why are results ordered by smallest component vertex?', answer: 'The increasing outer scan starts each component at its smallest unseen ID. All smaller IDs either belong to earlier components or would already have triggered this component’s traversal.' },
  ],
  takeaways: ['Choose DFS for reachability when layer distances are unnecessary.', 'Separate global visited state from one component’s worklist.', 'Model grid neighbors implicitly when topology is regular.'],
})

const topological = lesson({
  id: 'graphs-topological-order',
  title: 'Directed graphs: schedule prerequisites',
  minutes: 50,
  summary: 'Remove zero-indegree work in dependency order and detect cycles through unfinished vertices.',
  prerequisites: [queues.id, bfs.id, dfs.id, heaps.id],
  prerequisiteNotes: 'Know directed versus undirected edges, adjacency lists, and FIFO queues. Here [a,b] means a must precede b.',
  objectives: ['Translate a prerequisite relation into directed edges.', 'Maintain indegree relative to the unfinished subgraph.', 'Distinguish a valid topological order from proof that no order exists.'],
  concepts: [
    { title: 'Dependencies are directional', body: 'An edge a to b says a must appear before b. Unlike the undirected component lesson, do not add a reverse edge: doing so invents a dependency cycle. A valid topological order need not be unique because unrelated vertices may be scheduled in either order. The task asks for any valid order, with a deterministic FIFO trace for the example. Vertex numbers are labels, not an ordering guarantee.' },
    { title: 'Indegree counts unresolved prerequisites', body: 'Initialize indegree[v] to the number of incoming edges. A vertex with zero indegree can be scheduled because all its prerequisites have already been removed, or it had none. When scheduling u, decrement indegree for each outgoing neighbor to remove precisely those dependencies. Enqueue a neighbor only when its count becomes zero. The invariant is about edges remaining among unfinished vertices, not about the original graph forever.' },
    { title: 'A stuck remainder certifies a cycle', body: 'If unfinished vertices remain but none has indegree zero, each has an incoming edge from another unfinished vertex. Repeatedly following such predecessors in a finite set must revisit a vertex, yielding a directed cycle. Conversely, a directed cycle can never have all its vertices removed by zero-indegree choices, because each waits on another. Comparing processed count with n therefore distinguishes successful scheduling from impossibility.' },
  ],
  example: 'dependencyOrder(4, [[0,2],[1,2],[2,3]]) returns [0,1,2,3] with increasing initial queue order. dependencyOrder(2, [[0,1],[1,0]]) returns absent.',
  task: 'Write dependencyOrder(n, edges), returning any permutation of vertices respecting every directed edge, or absent if impossible. n is 0 through 100000; endpoints are valid; no duplicate edges are supplied, but self-loops may occur. Empty input returns [] rather than absent. Initialize zero-indegree vertices in increasing ID order and process outgoing entries in their input order for the worked trace.',
  starter: `function dependencyOrder(n, edges):
    outgoing = n empty lists
    indegree = array of n zeros
    // Build directed edges and enqueue initially ready vertices.
    order = empty list
    // Remove ready work and release its dependents.`,
  hints: ['An edge increments its destination’s indegree only.', 'If fewer than n vertices are emitted, return an explicit failure rather than a partial schedule.'],
  solution: `function dependencyOrder(n, edges):
    outgoing = n empty lists
    indegree = array of n zeros
    for [a, b] in edges:
        append b to outgoing[a]
        indegree[b] = indegree[b] + 1
    queue = empty list
    for v from 0 to n - 1:
        if indegree[v] == 0:
            append v to queue
    head = 0
    order = empty list
    while head < length(queue):
        u = queue[head]
        head = head + 1
        append u to order
        for v in outgoing[u]:
            indegree[v] = indegree[v] - 1
            if indegree[v] == 0:
                append v to queue
    if length(order) != n:
        return absent
    return order

The sample starts with queue [0,1]. Removing 0 leaves vertex 2 with one prerequisite; removing 1 releases 2, which later releases 3. Each emitted vertex has no unfinished predecessor, so every edge points forward in the result. A cycle leaves a nonempty remainder. Time O(n + E), adjacency storage O(n + E), auxiliary indegree/queue space O(n), and output O(n). A self-loop prevents its vertex from becoming ready.`,
  checklist: ['I interpret every edge in the documented direction.', 'I enqueue only when the remaining count becomes zero.', 'I reject incomplete output while accepting an empty graph.'],
  pitfalls: ['Adding reverse edges creates false cycles.', 'Decrementing once per vertex instead of once per edge releases work incorrectly.', 'Returning a partial order hides unresolved cyclic work.'],
  walkthrough: [
    { title: 'Trace the join point', body: 'Vertex 2 depends on both 0 and 1, so releasing it after just one predecessor would be premature. Its count moves from two to one to zero; only the final transition enqueues it. This is why a plain visited boolean is insufficient for the scheduling decision. BFS distance discovery needs one path, while prerequisite scheduling needs all incoming obligations satisfied. Similar queue syntax can encode very different invariants.' },
    { title: 'Validate an order independently', body: 'Build position[v] from the returned list. Confirm each vertex occurs once, then verify position[a] < position[b] for every edge. This certificate accepts alternative valid schedules and catches reversed edges. To test cycle rejection, include a cycle in one component and ready work in another: processing some vertices must not be mistaken for complete success. A failed result need not identify the exact cycle under this contract.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Find initially ready work', prompt: 'For vertices 0..3 and edges [[0,2],[1,2]], list initial indegrees and ready vertices.', hints: ['Count incoming edges separately for every vertex.', 'An isolated vertex has zero prerequisites.'], solution: 'Indegrees are [0,0,2,0] and initial ready vertices are [0,1,3]. Vertex 2 is not ready until both incoming dependencies are removed. Computing these values takes O(n + E) time, O(n) indegree storage, and O(n) ready output in the worst case.', checklist: ['I include isolated vertex 3.', 'I count both prerequisites of 2.'] },
    { id: 'stretch', title: 'Smallest available ID first', prompt: 'Require the lexicographically smallest valid order. Explain why the FIFO core needs a min-heap instead. For edges [[0,1]] on vertices 0..2, return [0,1,2].', hints: ['The initial ready set is {0,2}.', 'After removing 0, newly ready 1 should precede waiting 2.'], solution: 'Use a min-heap of ready IDs and always extract the smallest. Any valid order must choose a ready vertex next; choosing the smallest gives the smallest possible next position, and the same argument applies to the remainder. The sample FIFO order would be [0,2,1], while the heap gives [0,1,2]. Time O(E + n log(n + 1)), auxiliary O(n) beyond adjacency, output O(n).', checklist: ['I reconsider all currently ready IDs at each step.', 'I preserve the same cycle detection.'] },
  ],
  followUps: [
    { question: 'Does topological order minimize total completion time?', answer: 'No. It only respects precedence. Durations, parallel worker limits, and optimization objectives require additional scheduling models; a valid order alone makes no optimality claim.' },
    { question: 'How can we tell whether the order is unique?', answer: 'For a DAG, if more than one vertex is ready at any step, either can be chosen next and multiple orders exist. Exactly one ready choice at every step implies uniqueness.' },
  ],
  takeaways: ['Model prerequisite direction before choosing a traversal.', 'Indegree tracks remaining obligations, not mere reachability.', 'Validate output by edge order and detect incomplete processing.'],
})

const backtracking = lesson({
  id: 'backtracking-subsets',
  title: 'Backtracking: choose, explore, undo',
  minutes: 50,
  summary: 'Enumerate subsets with a reusable path while separating search state from saved results.',
  prerequisites: [recursion.id, dfs.id, sorting.id],
  prerequisiteNotes: 'Know recursive frames and depth-first traversal. The core input contains distinct values; subsets preserve input order.',
  objectives: ['Define a search state and its legal next choices.', 'Restore mutable path state after each recursive branch.', 'Include output volume when analyzing enumeration.'],
  concepts: [
    { title: 'The search tree is implicit', body: 'At index i, decide whether to exclude or include values[i], then recurse to i + 1. Every root-to-leaf sequence of decisions specifies one subset. There is no need to construct a separate tree of objects: recursive frames encode its position. Because each decision advances the index, the search terminates and no input position can be selected twice. Distinct input values make decision sequences and value subsets one-to-one.' },
    { title: 'Undo restores the caller’s world', body: 'Keep one mutable path containing included values from earlier indices. An include branch appends the current value, explores descendants, then removes that value before returning. The caller must receive the same path contents it had before the child branch. Missing the undo contaminates later branches with choices they never made. A path local to the overall enumeration is shared across frames intentionally; the restoration invariant makes that sharing safe.' },
    { title: 'A result needs a snapshot', body: 'At a leaf, append a copy of path to output. Saving the same mutable list reference repeatedly would leave many outputs pointing at whatever the path contains later. Enumeration costs cannot be summarized by recursion depth alone: n distinct elements have 2^n subsets, and copying their members takes O(n * 2^n) time overall. Auxiliary path and stack are O(n), separate from potentially exponential returned output.' },
  ],
  example: 'subsets([2,5]) returns [[],[5],[2],[2,5]] using exclude-before-include order. subsets([]) returns [[]].',
  task: 'Write subsets(values) for up to 18 distinct integers. Return all subsets as independent arrays, preserving original input order inside each subset. Follow exclude-before-include traversal so the worked output is deterministic. Do not mutate values. Empty input has one subset, the empty subset. Explain why exponential output is unavoidable.',
  starter: `function subsets(values):
    output = empty list
    path = empty list
    // Explore a decision at each index.
    return output`,
  hints: ['At index n, all include/exclude decisions are complete.', 'Copy the current path at a leaf; undo each append after exploring its branch.'],
  solution: `function subsets(values):
    output = empty list
    path = empty list
    function visit(index):
        if index == length(values):
            append copy of path to output
            return
        visit(index + 1)
        append values[index] to path
        visit(index + 1)
        remove last value from path
    visit(0)
    return output

For [2,5], excluding 2 first yields [] and [5]. Including 2 then yields [2] and [2,5]. Each leaf corresponds to one distinct decision vector; every vector is explored once. The path contains exactly the included positions before index, and undo restores it after a branch. Time O(n * 2^n) for nonempty input including snapshots; auxiliary path/stack O(n), output O(n * 2^n). Empty input still performs constant work and stores one empty result.`,
  checklist: ['I save independent snapshots rather than shared path references.', 'I restore path state after inclusion.', 'I return the empty subset and separate output space from working space.'],
  pitfalls: ['Appending path without copying aliases all saved answers.', 'Forgetting to pop includes a choice in unrelated branches.', 'Reporting O(n) runtime counts depth but ignores the number of leaves.'],
  walkthrough: [
    { title: 'Use a decision table to prove coverage', body: 'Two positions have four decision vectors: exclude/exclude, exclude/include, include/exclude, and include/include. They map to the four explicit sample outputs in that order. For n positions, extending every length n minus one decision vector by either decision doubles the count. This gives both a completeness proof and an output-size lower bound. No pruning can remove a legal branch when the contract asks for every subset.' },
    { title: 'Know when pruning is justified', body: 'In a constrained search, a branch can stop early only if no extension can become a valid answer. For example, with strictly positive values, a partial sum already above a nonnegative target cannot fall back down by adding more. With negative values that proof fails. Backtracking is not “try everything quickly”; it is an organized enumeration where each pruning condition needs a reason grounded in the input constraints.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Two-position decisions', prompt: 'List every binary decision string of length two in zero-before-one order. Explain the length-zero result.', hints: ['Choose 0 or 1 at each position.', 'A completed empty decision sequence is still one result.'], solution: 'The outputs are 00,01,10,11. For length zero, return one empty string, not zero strings. Recurse by appending each bit and undoing it afterward, snapshotting at the required length. For length n, time O(n * 2^n) including output copying, auxiliary O(n), and output O(n * 2^n), with constant work at n = 0.', checklist: ['I produce every decision combination once.', 'I distinguish no choices from no solutions.'] },
    { id: 'stretch', title: 'Unique subsets with repeated values', prompt: 'Allow duplicates and return each value subset once. For [1,1,2], the six subsets are [],[1],[1,1],[1,1,2],[1,2],[2], in any order.', hints: ['Sort a copy to group equal values.', 'In a choose-next-index traversal, skip equal candidates only at the same recursion depth.'], solution: 'Sort a copy. At visit(start), emit a path copy, then loop i from start onward. Skip i when i > start and values[i] equals values[i - 1]; otherwise append it, recurse on i + 1, and undo. Same-depth skipping removes equivalent first choices while deeper selection still permits two 1s. Worst-case time O(n log(n + 1) + n * 2^n), auxiliary O(n), output exponential; duplicates can reduce actual output.', checklist: ['I sort a copy, not the input.', 'I allow equal values at different depths.'] },
  ],
  followUps: [
    { question: 'Could bit masks enumerate the same subsets?', answer: 'Yes. Each n-bit mask encodes inclusion decisions. It has similar output-scale work and avoids recursion, but backtracking more naturally accommodates partial-state constraints and pruning.' },
    { question: 'Can we stream results instead of retaining them?', answer: 'Yes. Yield snapshots or invoke a consumer at leaves, retaining only O(n) search state plus the current result. Total output work remains exponential; reduced storage does not eliminate enumeration time.' },
  ],
  takeaways: ['A branch is a choice under an explicit search-state contract.', 'Undo restores shared working state; copying preserves completed answers.', 'Output size can dominate any possible algorithm.'],
})

const greedy = lesson({
  id: 'greedy-interval-selection',
  title: 'Greedy: prove an earliest-finish choice',
  minutes: 50,
  summary: 'Select the largest compatible interval set using an exchange argument rather than a plausible heuristic.',
  prerequisites: [sorting.id, backtracking.id],
  prerequisiteNotes: 'Know sorting with a comparator and subset enumeration as a baseline. Intervals use [start,end), so touching endpoints are compatible.',
  objectives: ['Choose an ordering that supports a safe local decision.', 'Prove a greedy choice by exchanging it into an optimal solution.', 'Identify variants where the same choice no longer optimizes the objective.'],
  concepts: [
    { title: 'Specify what is being maximized', body: 'The goal is the number of nonoverlapping intervals, with every interval worth one. It is not total occupied duration, total reward, or minimum idle time. Greedy algorithms are particularly sensitive to this distinction: a locally sensible decision for one objective may be disastrous for another. Positive duration and half-open endpoints are explicit assumptions here. Two intervals can meet at one endpoint without overlapping.' },
    { title: 'Earliest finish leaves the most room', body: 'Among currently compatible intervals, choose the one with smallest end time. Consider an optimal remaining schedule whose first interval is different. The greedy interval finishes no later, so replacing that first interval with the greedy one leaves every later scheduled interval feasible and preserves the count. Thus some optimal schedule begins with the greedy choice. Reapply the same exchange argument to the suffix after its end.' },
    { title: 'Sorting exposes the next safe choice', body: 'Sort a copy of interval records by end, breaking ties by original index for deterministic output. Then scan once, accepting an interval when its start is at least the last chosen end. Rejected intervals overlap the chosen frontier and cannot extend that particular valid schedule. The exchange proof, not the scan itself, shows that retaining this frontier does not sacrifice a globally larger answer. Track original IDs because sorting rearranges positions.' },
  ],
  example: 'selectIntervals([[0,4],[1,2],[2,3],[3,5]]) returns [1,2,3]. Touching intervals [1,2), [2,3), [3,5) are compatible.',
  task: 'Write selectIntervals(intervals), returning original indices of a maximum-cardinality compatible subset in scheduled order. Each integer pair has start < end; negative times are allowed. n is 0 through 100000. Touching endpoints are compatible. Sort a copy by end then original index, do not mutate input, and return [] for no intervals.',
  starter: `function selectIntervals(intervals):
    records = intervals paired with original indices
    sort records by end, then index
    chosen = empty list
    lastEnd = absent
    // Accept each compatible earliest finisher.
    return chosen`,
  hints: ['Earliest start can trap you in one long interval.', 'Use start >= lastEnd, and keep a separate absent state before any choice.'],
  solution: `function selectIntervals(intervals):
    records = intervals paired with original indices
    sort records by end, then index
    chosen = empty list
    lastEnd = absent
    for record in records:
        if lastEnd is absent or record.start >= lastEnd:
            append record.index to chosen
            lastEnd = record.end
    return chosen

The sample sorts IDs as 1,2,0,3 by ends 2,3,4,5. Choose 1 then 2, reject 0 because its start 0 is before lastEnd 3, and choose 3 because it starts at 3. The result has three intervals. An optimal schedule’s first interval can be exchanged for the earliest finisher without losing any later interval; induction proves the full greedy count optimal. Sorting time O(n log(n + 1)), scanning time O(n), copied records O(n) auxiliary space, and output O(n).`,
  checklist: ['I maximize count rather than time or reward.', 'I explain the exchange argument for the first choice.', 'I preserve original indices and accept touching endpoints.'],
  pitfalls: ['Sorting by earliest start can choose one long blocking interval.', 'Using > instead of >= incorrectly rejects touching intervals.', 'Returning sorted-array positions loses original interval identity.'],
  walkthrough: [
    { title: 'Disprove competing intuitions', body: 'In the main example, earliest-start selection chooses [0,4) and blocks both [1,2) and [2,3), yielding fewer intervals. Shortest duration is not a universal fix either: with [0,3), [3,6), and [2,4), the shortest interval overlaps both members of a compatible pair. A counterexample rejects a heuristic; an exchange proof establishes the chosen rule for all valid inputs. Collect both kinds of reasoning rather than trusting a few favorable traces.' },
    { title: 'Keep the frontier meaning precise', body: 'lastEnd is the finish time of the final chosen interval, not the most recent interval inspected. Updating it after a rejection would erase the actual compatibility boundary. Since accepted intervals are ordered by finish and each starts after the previous end, they form a valid schedule. Negative starting times require an absent initial frontier or a genuine negative-infinity abstraction; initializing lastEnd to zero would incorrectly discard legal early intervals.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Check compatibility', prompt: 'Are [1,3) and [3,6) compatible? Are [1,4) and [3,6)? State a symmetric condition for two positive-duration intervals.', hints: ['An interval excludes its end boundary.', 'Either interval may come first in the input.'], solution: 'The first pair is compatible and the second overlaps. For [a,b) and [c,d), compatibility is b <= c or d <= a. Two comparisons take O(1) time and O(1) space. This is a pairwise check, not an optimization algorithm for choosing among many intervals.', checklist: ['I allow equality at touching boundaries.', 'I check both possible temporal orders.'] },
    { id: 'stretch', title: 'Rewards break the exchange', prompt: 'Intervals [0,2), [2,4), [0,4) have rewards 3,3,10. Explain why earliest-finish selection fails to maximize reward, and outline a correct dynamic program.', hints: ['Replacing an interval can preserve count but change reward.', 'After sorting by finish, compare skipping interval i with taking it plus a compatible prefix.'], solution: 'Greedy selects the first two for reward 6, while the long interval yields 10. Sort by end, find p(i), the last earlier interval ending at or before start[i], using binary search. Let best[i] be max(best[i - 1], reward[i] + best[p(i)]), with empty-prefix reward zero. This considers the two exhaustive cases for an optimum. Time O(n log(n + 1)), auxiliary O(n); reconstruction needs saved choices or retracing the table.', checklist: ['I identify the failed reward-preservation step.', 'I restrict the take case to a compatible prefix.'] },
  ],
  followUps: [
    { question: 'Is greedy simply backtracking without undo?', answer: 'No. Removing alternatives is justified only by a proof that at least one optimal solution remains. Backtracking explores alternatives explicitly; an unproved one-branch search is merely a heuristic.' },
    { question: 'Could two valid maximum schedules differ?', answer: 'Yes. The task allows any maximum-cardinality subset. The end/index comparator makes the worked implementation deterministic, but optimality tests should also verify count and compatibility rather than assume uniqueness.' },
  ],
  takeaways: ['Tie an optimization proof to the exact objective.', 'Exchange an optimal solution toward the greedy choice.', 'A convincing counterexample is enough to reject a heuristic, not enough to prove another.'],
})

const dp = lesson({
  id: 'dp-nonadjacent-sum',
  title: 'One-dimensional DP: summarize the best prefix',
  minutes: 55,
  summary: 'Replace exponential include-or-skip search with a recurrence for the maximum nonadjacent sum.',
  prerequisites: [arrays.id, recursion.id, backtracking.id, greedy.id],
  prerequisiteNotes: 'Know include/exclude decisions and prefix boundaries. Empty selection is allowed, so the answer is never negative.',
  objectives: ['Define each DP state independently of implementation indices.', 'Derive exhaustive take-or-skip transitions and base cases.', 'Compress storage only after identifying which earlier states remain live.'],
  concepts: [
    { title: 'A state is a question with one answer', body: 'Let best[k] be the maximum sum selectable from the first k values with no two selected positions adjacent. The state stores an optimal value, not one particular selected set. Many recursive paths ask the same prefix question; memoization can answer it once, while bottom-up tabulation computes states in dependency order. A vague state such as “best so far” hides which inputs and constraints it actually summarizes.' },
    { title: 'Partition by the final decision', body: 'For a nonempty prefix, an optimal selection either skips its final value or takes it. Skipping leaves best[k - 1]. Taking values[k - 1] forbids the preceding position, leaving best[k - 2] plus that value. These alternatives cover all valid selections and each uses an optimal independent prefix. Empty selection gives base value zero and safely handles all-negative arrays. The recurrence is a proof by cases, not a pattern to memorize without a state.' },
    { title: 'Rolling storage follows dependency lifetime', body: 'Only the previous two prefix answers are needed to compute the next. Keep them as twoBack and oneBack, calculate current before overwriting either, then shift them forward. This reduces auxiliary space from O(n) to O(1), but loses the history useful for reconstructing selected indices. Start with a full table when learning; compression is a separate optimization whose correctness depends on reading old values before replacing them.' },
  ],
  example: 'maxNonAdjacent([4,1,1,4]) returns 8 by selecting indices [0,3]. Prefix optima are [0,4,4,5,8]. maxNonAdjacent([-5,-2]) returns 0.',
  task: 'Write maxNonAdjacent(values), returning the maximum sum of values at nonadjacent indices. Any number of positions, including zero, may be selected. n is 0 through 100000; each value is between -1000000 and 1000000. Return 0 for []. Do not mutate input. Use O(n) time and O(1) auxiliary space, with an accumulator wide enough for the result.',
  starter: `function maxNonAdjacent(values):
    twoBack = 0
    oneBack = 0
    // Compare excluding and including each arriving value.
    return oneBack`,
  hints: ['If you include the current position, which preceding prefix remains usable?', 'Calculate the next optimum before shifting the two saved states.'],
  solution: `function maxNonAdjacent(values):
    twoBack = 0
    oneBack = 0
    for value in values:
        current = max(oneBack, twoBack + value)
        twoBack = oneBack
        oneBack = current
    return oneBack

Starting at zero, [4,1,1,4] produces current values 4,4,5,8. At the final 4, taking it uses the optimum 4 from the first two positions rather than the adjacent prefix optimum 5. Skipping and taking are exhaustive and feasible, so their maximum equals the prefix optimum. Both saved values begin at zero to represent the empty prefix and the virtual empty prefix before the first position. Time O(n), auxiliary space O(1), scalar output O(1). Input bounds permit sums around 50000000000, so avoid a 32-bit signed accumulator.`,
  checklist: ['I state what each saved prefix answer means.', 'I allow the empty selection for negative inputs.', 'I compute current before overwriting needed states.'],
  pitfalls: ['Choosing the largest remaining value greedily can block a better pair.', 'Using oneBack + value can select adjacent positions.', 'Initializing with the first value forces an unwanted negative selection.'],
  walkthrough: [
    { title: 'From branching search to shared states', body: 'A recursive solver can branch on taking or skipping each final position. The skip branch asks about one shorter prefix, while the take branch asks about two shorter positions. Those recursive trees repeatedly revisit identical prefix lengths. Because a prefix optimum depends only on that prefix length and the fixed input, a table can share the answers. This reuse is the key difference from subset enumeration, where distinct completed subsets must all be returned.' },
    { title: 'Try a greedy counterexample', body: 'For [4,5,4], choosing the largest value first gives 5, but the two endpoints give 8. The DP evaluates both possibilities: after two positions the optimum is 5, then taking the final 4 combines it with the first-prefix optimum 4. This trace demonstrates why a locally best element does not summarize the impact of adjacency. Small exhaustive subset checks are a strong test oracle for larger-looking DP logic.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'Fill the uncompressed table', prompt: 'Write all prefix optima for [2,7,3], including the empty prefix, and identify the final answer.', hints: ['Begin best[0] = 0 for the empty prefix.', 'For each prefix compare its last value plus the two-shorter optimum with skipping it.'], solution: 'The table is [0,2,7,7]. Taking the final 3 yields 2 + 3 = 5, while skipping it retains 7. A full table takes O(n) time and O(n) auxiliary space. It is easier to inspect than rolling variables and produces the same value, making it useful for explaining the recurrence before optimizing storage.', checklist: ['I include the empty-prefix entry.', 'I use the two-shorter prefix in the take case.'] },
    { id: 'stretch', title: 'Return a witness selection', prompt: 'Return selected indices as well as the optimum sum. For [4,1,1,4], one witness is [0,3]. Define a tie rule.', hints: ['Retain the full prefix table.', 'Walk backward: if skipping preserves the optimum, skip; otherwise take and jump two positions.'], solution: 'Build best[0..n]. Set k = n; while k > 0, skip to k - 1 when best[k] equals best[k - 1]. Otherwise record k - 1 and move to max(0,k - 2). Reverse the recorded indices. Preferring skip on ties makes reconstruction deterministic and avoids selecting zero-gain positions. The witness has the optimal sum and no adjacent indices. Time O(n), auxiliary table O(n), output O(n) worst case.', checklist: ['I move back two positions after taking.', 'I verify the witness sum matches the reported optimum.'] },
  ],
  followUps: [
    { question: 'What changes if at least one value must be chosen?', answer: 'The empty-selection base is no longer sufficient by itself. Track whether anything has been selected, or handle the all-nonpositive case with the largest single value under a carefully revised recurrence.' },
    { question: 'Can memoization give the same complexity?', answer: 'Yes. Cache the optimum for each prefix length so each state is solved once. It uses O(n) cache and potentially O(n) call stack, whereas bottom-up rolling storage avoids both.' },
  ],
  takeaways: ['Define the subproblem before deriving the recurrence.', 'Exhaustive final-decision cases establish correctness.', 'Compress storage only after tracing dependency lifetimes.'],
})

const grid = lesson({
  id: 'dp-grid-paths',
  title: 'Two-dimensional DP: count paths through a grid',
  minutes: 55,
  summary: 'Count right-and-down routes around obstacles, then compress a two-dimensional recurrence to one row.',
  prerequisites: [arrays.id, dfs.id, topological.id, dp.id],
  prerequisiteNotes: 'Know DP states, row/column indices, and directed dependencies. Movement is right or down only; cells with value 1 are blocked.',
  objectives: ['Define a two-coordinate state and its incoming transitions.', 'Choose a traversal order that satisfies dependencies.', 'Explain what a rolling cell means before and after update.'],
  concepts: [
    { title: 'Count paths, not reachable cells', body: 'Let ways[r][c] count valid routes from the upper-left cell to cell (r,c). A reachable cell may have many routes, so a visited boolean cannot represent this answer. Every route into a nonstart open cell arrives either from above or from the left. These sets are disjoint because their final moves differ, so their counts add. Obstacles have zero ways regardless of how many routes approach them.' },
    { title: 'The grid is a directed acyclic graph', body: 'Each legal move increases row plus column by one, so no route can cycle. Row-major processing visits both incoming predecessors before a cell, making it a topological evaluation order. This is why no recursive cycle detection or repeated relaxation is needed. Allowing arbitrary four-directional movement would change the problem substantially: unrestricted walks can revisit cells and may be infinite in number.' },
    { title: 'One row stores two moments at once', body: 'Before updating column c, rowWays[c] still refers to the previous row, so it supplies the count from above. rowWays[c - 1] has already been updated for the current row, so it supplies the count from the left. The array therefore mixes old and new rows intentionally. Iterate left to right, and reset blocked positions to zero; otherwise stale routes from above would leak through obstacles.' },
  ],
  example: 'countGridPaths([[0,0,0],[0,1,0],[0,0,0]]) returns 2. Rolling rows become [1,1,1], [1,0,1], [1,1,2].',
  task: 'Write countGridPaths(blocked), counting routes from (0,0) to (R - 1,C - 1) using only right or down steps through zero-valued cells. Return 0 for no rows, no columns, a blocked start, or a blocked destination. The rectangular 0/1 grid has at most 20 rows and 20 columns. Do not mutate it. Use exact integer arithmetic, O(RC) time, and O(C) auxiliary space.',
  starter: `function countGridPaths(blocked):
    // Handle empty dimensions before reading the first cell.
    rowWays = array of C zeros
    rowWays[0] = 1
    // Update one row left to right, clearing obstacles.
    return rowWays[C - 1]`,
  hints: ['The initial one is a seed for the start, and a blocked start must erase it.', 'At an open nonfirst column, add the current-row left count to the still-stored above count.'],
  solution: `function countGridPaths(blocked):
    R = length(blocked)
    if R == 0:
        return 0
    C = length(blocked[0])
    if C == 0:
        return 0
    rowWays = array of C zeros
    rowWays[0] = 1
    for r from 0 to R - 1:
        for c from 0 to C - 1:
            if blocked[r][c] == 1:
                rowWays[c] = 0
            else if c > 0:
                rowWays[c] = rowWays[c] + rowWays[c - 1]
    return rowWays[C - 1]

For the example, the first row has one route to each cell. The center obstacle clears its count, producing [1,0,1]. The last row combines its incoming routes to give [1,1,2]. Each update sums disjoint last-step alternatives, and the seed represents the single empty route at an open start. A blocked start erases it before propagation. Time O(RC), auxiliary space O(C), scalar output O(1). The largest 20-by-20 open-grid count is 35345263800, requiring more than a 32-bit signed integer but fitting exactly in a safe 64-bit integer.`,
  checklist: ['I distinguish path counts from reachability.', 'I explain old-row versus current-row meanings in the same array.', 'I clear blocked cells and use a sufficiently wide count.'],
  pitfalls: ['Iterating right to left reads stale left counts.', 'Skipping an obstacle without clearing it preserves invalid routes.', 'Initializing every cell to one bypasses obstacle and boundary logic.'],
  walkthrough: [
    { title: 'Start with the full table', body: 'Put one at an open start, zero at obstacles, and otherwise add above and left, treating missing neighbors as zero. A single open cell returns one: the route starts at its destination without moving. A one-row grid has one route until its first obstacle and zero afterward. These cases explain initialization without ad hoc patches.' },
    { title: 'Prove the rolling update order', body: 'At the start of a row, every entry holds the above-cell count. After columns before c are updated, they hold the current row, while columns c onward still hold the old row. Updating c reads exactly the two dependencies needed, then extends the processed prefix by one. This loop invariant justifies both storage reuse and direction. It is the two-dimensional version of computing current before shifting one-dimensional DP state.' },
  ],
  extraPractice: [
    { id: 'warmup', title: 'An obstacle-free rectangle', prompt: 'Count routes through a two-row, three-column open grid and show the full count table.', hints: ['The first row and first column each have one route per cell.', 'Each remaining cell adds its above and left neighbors.'], solution: 'The table is [[1,1,1],[1,2,3]], so the answer is 3. The routes place the one downward move before, between, or after the two rightward moves. Tabulation takes O(RC) time and O(RC) table storage; rolling storage reduces it to O(C). No path enumeration is necessary.', checklist: ['I count three routes rather than six cells.', 'I include the start’s empty route.'] },
    { id: 'stretch', title: 'Minimum-cost right/down route', prompt: 'Replace obstacles with nonnegative cell costs and return the minimum sum including both endpoints. For [[1,4,1],[2,1,1]], return 5. Explain the recurrence and boundary initialization.', hints: ['Use minimum instead of addition to combine alternative predecessors.', 'Add the current cell cost after choosing the cheaper incoming route.'], solution: 'Set cost at the start to its own value. For other cells, best[r][c] = cellCost + min(best above, best left), with unavailable predecessors treated as infinity. The sample route 1 -> 2 -> 1 -> 1 costs 5. Initialize a rolling row to infinity and seed the start explicitly; careless zeros create nonexistent free entrances. Time O(RC), auxiliary O(C), scalar output O(1). An empty grid needs a separately documented absent-route result.', checklist: ['I include both endpoint costs.', 'I do not count a missing predecessor as a zero-cost route.'] },
  ],
  followUps: [
    { question: 'Why is adding route counts correct but adding minimum costs wrong?', answer: 'Counting combines disjoint sets of alternatives by addition. Optimization selects the better alternative by minimum, then adds the cost common to entering the current cell. The state meaning determines the combining operation.' },
    { question: 'Can the smaller dimension determine storage?', answer: 'Yes. Traverse the grid with rows and columns conceptually exchanged so the rolling buffer spans min(R,C). Preserve valid dependency order and avoid allocating a transposed copy if claiming only that smaller auxiliary bound.' },
  ],
  takeaways: ['A multidimensional state can follow an acyclic dependency graph.', 'Specify boundary and unreachable values as part of the recurrence.', 'Rolling storage is safe only with a proven read/write order.'],
})

export const dsaLessons: Lesson[] = [
  arrays,
  complements,
  pointers,
  window,
  stack,
  queues,
  linked,
  binary,
  sorting,
  recursion,
  trees,
  heaps,
  bfs,
  dfs,
  topological,
  backtracking,
  greedy,
  dp,
  grid,
]
