export type Track = 'dsa' | 'system-design' | 'ml' | 'behavioral';

export interface Lesson {
  id: string;
  track: Track;
  title: string;
  minutes: number;
  summary: string;
  objectives: string[];
  concepts: { title: string; body: string }[];
  example: string;
  task: string;
  starter?: string;
  hints: string[];
  solution: string;
  checklist: string[];
  pitfalls: string[];
}

export const tracks: { id: Track; title: string; description: string }[] = [
  {
    id: 'dsa',
    title: 'Data structures & algorithms',
    description: 'Build six reusable problem-solving patterns, starting with lookup tables and ending with shortest paths.',
  },
  {
    id: 'system-design',
    title: 'System design',
    description: 'Turn product requirements into capacity estimates, then reason about data flow, caching, and failure.',
  },
  {
    id: 'ml',
    title: 'Machine learning',
    description: 'Choose trustworthy evaluation methods and use learning curves to guide your next experiment.',
  },
  {
    id: 'behavioral',
    title: 'Behavioral interviews',
    description: 'Practice specific, honest accounts of your contribution, decisions, and collaboration.',
  },
];

export const lessons: Lesson[] = [
  {
    id: 'hash-map-complements',
    track: 'dsa',
    title: 'Hash maps: remember what you have seen',
    minutes: 20,
    summary: 'Replace repeated pair comparisons with a lookup table while preserving distinct indices.',
    objectives: [
      'Explain how a complement lookup avoids a nested scan.',
      'Maintain a map from a previously seen value to its index.',
      'Handle duplicates, negative values, and a missing answer.',
    ],
    concepts: [
      {
        title: 'Ask a smaller question',
        body: 'For a current value x and target t, the needed partner is t minus x. Instead of asking whether every possible pair works, ask whether that partner appeared earlier. A hash map supports expected constant-time lookup, trading extra memory for less repeated work.',
      },
      {
        title: 'Make the invariant explicit',
        body: 'Before processing index j, the map contains only values at indices smaller than j. Look up the complement before inserting the current value. This prevents a single element from being used twice, even when twice its value equals the target.',
      },
      {
        title: 'Separate correctness from performance',
        body: 'The first successful lookup returns two valid, distinct indices. If no lookup succeeds, no pair exists because each possible later endpoint was checked. Expected runtime is O(n) and extra space is O(n); this runtime assumes ordinary well-behaved hash-map operations.',
      },
    ],
    example: `Input: values = [4, 9, 1, 6], target = 10.
At index 0, partner 6 is absent; remember 4 at index 0.
At index 1, partner 1 is absent; remember 9 at index 1.
At index 2, partner 9 is present at index 1.
Return [1, 2], because 9 + 1 = 10. Stop without processing 6.`,
    task: `Write pairIndices(values, target), returning any two distinct zero-based indices [i, j] with i < j whose values sum to target. Return [] if none exists. Do not modify values.
Input: an integer array of length 0 through 100000 and an integer target. Each integer, including target, is between -1000000 and 1000000.
Required examples: pairIndices([8, 3, 8, -2], 16) returns [0, 2]; pairIndices([5], 10) returns []; pairIndices([], 0) returns [].
Multiple valid answers are allowed. Aim for expected O(n) time and O(n) extra space.`,
    starter: `function pairIndices(values, target):
    seen = empty map
    for j from 0 to length(values) - 1:
        // Find a previously seen partner before remembering values[j].
    return []`,
    hints: [
      'At each index, calculate the exact value needed to complete the target. What information must you remember to return indices rather than values?',
      'Check seen for target minus values[j] before inserting values[j]. A later duplicate can then match an earlier occurrence without matching itself.',
    ],
    solution: `Keep a map from value to an earlier index. Replacing an old index for the same value is safe because any valid pair is accepted.

function pairIndices(values, target):
    seen = empty map
    for j from 0 to length(values) - 1:
        need = target - values[j]
        if seen contains key need:
            return [seen[need], j]
        seen[values[j]] = j
    return []

For [8, 3, 8, -2] with target 16, store 8 at index 0 and 3 at index 1. The second 8 needs 8, so return [0, 2]. For [5] with target 10, the map is empty during lookup; storing 5 afterward cannot create a pair.
Every pair has a later endpoint. When that endpoint is processed, its partner is already in the map, so an existing pair cannot be missed. Expected time is O(n); space is O(n). A nested scan saves auxiliary memory but takes O(n squared) time.`,
    checklist: [
      'I can state what is in the map before each iteration.',
      'I return indices, not the matching values.',
      'I can trace both a repeated-value match and a one-element non-match.',
      'I can explain the expected time and extra-space costs.',
    ],
    pitfalls: [
      'Inserting before lookup can return the current index twice.',
      'Testing an index for truthiness can incorrectly reject index 0; test key membership instead.',
      'Returning a default pair when no answer exists violates the empty-array contract.',
    ],
  },
  {
    id: 'two-pointers-sorted-pairs',
    track: 'dsa',
    title: 'Two pointers: use sorted order',
    minutes: 20,
    summary: 'Use an ordering argument to eliminate many impossible pairs with one pointer move.',
    objectives: [
      'Explain why the sum determines which pointer moves.',
      'Find a pair in a sorted array with constant extra space.',
      'Distinguish sorted-input assumptions from the hash-map approach.',
    ],
    concepts: [
      {
        title: 'Start at opposite ends',
        body: 'In a nondecreasing array, the leftmost candidate is the smallest and the rightmost candidate is the largest. Compare their sum with the target. A match is an answer; otherwise order tells you which endpoint cannot participate in any remaining match.',
      },
      {
        title: 'Justify each discarded endpoint',
        body: 'If the sum is too small, pairing the left value with any smaller right value is also too small. Discard the left endpoint. If the sum is too large, pairing the right value with any larger left value is also too large. Discard the right endpoint. This argument works with negative values and duplicates.',
      },
      {
        title: 'Respect the input contract',
        body: 'Stop when left is no longer smaller than right so that an element is never paired with itself. Each step shrinks the candidate interval, giving O(n) time and O(1) extra space. Sorting an unsorted array first adds work and changes index meanings, so do not silently apply this method to an unsorted-index task.',
      },
    ],
    example: `Input: values = [-5, -1, 3, 7, 11], target = 10.
The endpoints sum to 6, so move left from -5 to -1.
Now -1 + 11 = 10. Return [1, 4].
Discarding -5 was safe: no remaining value exceeds 11, so no partner could make its sum reach 10.`,
    task: `Write sortedPair(values, target). The input array is already sorted in nondecreasing order. Return any distinct zero-based indices [i, j] with i < j whose values sum to target, or [] if none exists. Do not sort or modify the input.
Constraints: length 0 through 100000; integer values and target between -1000000 and 1000000.
Required examples: sortedPair([-4, 0, 2, 5, 9], 7) returns [2, 3]; sortedPair([2, 2], 4) returns [0, 1]; sortedPair([2], 4) returns [].
Use O(n) time and O(1) extra space.`,
    starter: `function sortedPair(values, target):
    left = 0
    right = length(values) - 1
    while left < right:
        sum = values[left] + values[right]
        // Match, discard left, or discard right.
    return []`,
    hints: [
      'If the current sum is too small, can moving the right pointer inward ever increase it?',
      'A too-small sum eliminates the current left endpoint entirely. A too-large sum eliminates the current right endpoint entirely.',
    ],
    solution: `function sortedPair(values, target):
    left = 0
    right = length(values) - 1
    while left < right:
        sum = values[left] + values[right]
        if sum == target:
            return [left, right]
        if sum < target:
            left = left + 1
        else:
            right = right - 1
    return []

For [-4, 0, 2, 5, 9] and target 7, sums are 5, 9, 5, and 7. The pointer pairs are [0, 4], [1, 4], [1, 3], and [2, 3], so return [2, 3].
Every discarded endpoint is ruled out with all remaining partners by sorted order. At most n minus 1 moves occur, giving O(n) time. Only pointers and a sum are stored, giving O(1) extra space. Unlike a hash map, this memory advantage depends on the sorted-input guarantee.`,
    checklist: [
      'I can justify both pointer directions using sorted order.',
      'I stop before the pointers refer to the same element.',
      'I can trace a negative-value example and a duplicate-value example.',
      'I can explain why sorting is not a free preprocessing step for index-based answers.',
    ],
    pitfalls: [
      'Moving left when the sum is too large removes useful small candidates.',
      'Using left <= right can pair one element with itself.',
      'Applying the method to unsorted input invalidates the elimination argument.',
    ],
  },
  {
    id: 'sliding-window-distinct',
    track: 'dsa',
    title: 'Sliding windows: maintain a valid interval',
    minutes: 25,
    summary: 'Find a longest contiguous segment by expanding once and repairing its invariant.',
    objectives: [
      'Distinguish a contiguous substring from a subsequence.',
      'Maintain a window containing no repeated characters.',
      'Explain why nested pointer loops can still take linear time.',
    ],
    concepts: [
      {
        title: 'A window is a contiguous range',
        body: 'A substring occupies consecutive positions; you cannot skip an inconvenient character. Represent it with inclusive left and right indices. Expand right to consider a new endpoint, then move left only as far as necessary to restore validity.',
      },
      {
        title: 'Repair before measuring',
        body: 'Keep a set of characters in the current window. If the incoming character already appears, repeatedly remove the leftmost character and advance left until the duplicate is gone. Insert the incoming character, then update the best length. The set and the interval must describe the same characters.',
      },
      {
        title: 'Count total movement',
        body: 'Although shrinking happens inside the expansion loop, each position enters once and leaves at most once. Expected runtime is O(n) with ordinary hash-set operations. Space is O(min(n, alphabet size)). For lowercase English input, at most 26 characters are stored.',
      },
    ],
    example: `Input: text = "abcaef".
After reading a, b, c, the valid window is "abc", length 3.
The next a repeats. Remove the first a, then insert the new a; the window is "bca".
Adding e and f produces "bcaef", length 5.
Output: 5. "abcaef" is not valid because it contains two a characters.`,
    task: `Write longestDistinct(text), returning the length of the longest contiguous substring with no repeated characters.
Input contains only lowercase English letters and has length 0 through 100000. Return an integer; returning the substring itself is not required.
Required examples: longestDistinct("pwwkew") returns 3, using "wke" or "kew"; longestDistinct("abba") returns 2; longestDistinct("") returns 0; longestDistinct("aaaa") returns 1.
Aim for O(n) expected time. Do not generate every substring.`,
    starter: `function longestDistinct(text):
    present = empty set
    left = 0
    best = 0
    for right from 0 to length(text) - 1:
        // Shrink until text[right] can be added safely.
        // Measure the repaired window.
    return best`,
    hints: [
      'When an incoming character is already in the set, removing just one leftmost character may not remove its earlier occurrence.',
      'Use a while loop for repair. After inserting the incoming character, the inclusive window length is right minus left plus 1.',
    ],
    solution: `function longestDistinct(text):
    present = empty set
    left = 0
    best = 0
    for right from 0 to length(text) - 1:
        while present contains text[right]:
            remove text[left] from present
            left = left + 1
        add text[right] to present
        best = max(best, right - left + 1)
    return best

For "pwwkew", the second w forces removal of p and then the earlier w. The window becomes "w", then "wk", then "wke", reaching length 3. The final w removes the old w and produces "kew", also length 3.
The repaired window is the longest valid suffix ending at right: any earlier starting point would include the duplicate that forced shrinking. Taking the maximum across endpoints finds the global answer. Each character is inserted once and removed at most once, so expected time is O(n). With the specified alphabet, extra space is O(26), or O(1).`,
    checklist: [
      'I can explain why "pwke" is not a substring of "pwwkew".',
      'My set matches exactly the characters in the current valid window.',
      'I can trace a duplicate that requires more than one removal.',
      'I explain linear time by total pointer movement rather than loop nesting.',
    ],
    pitfalls: [
      'Using an if instead of a while can leave a repeated character in the window.',
      'Measuring before repair can record an invalid maximum.',
      'Resetting the whole window discards useful characters and can miss the best answer.',
    ],
  },
  {
    id: 'binary-search-lower-bound',
    track: 'dsa',
    title: 'Binary search: find a boundary',
    minutes: 25,
    summary: 'Search for the first qualifying position, including duplicates and absent targets.',
    objectives: [
      'Express a sorted-array query as a false-to-true boundary.',
      'Maintain a half-open search interval without off-by-one errors.',
      'Return a useful insertion position even when a target is absent.',
    ],
    concepts: [
      {
        title: 'Search a monotone predicate',
        body: 'For a sorted array and target t, the statement values[i] >= t is false for an initial prefix and true for the remaining suffix. Lower bound asks for the first true position. If every position is false, the answer is n, one past the last element.',
      },
      {
        title: 'Use a half-open interval',
        body: 'Initialize low = 0 and high = n. Positions below low are known to be too small; positions at or above high, when inside the array, are known to qualify. The unclassified interval is [low, high). When the middle qualifies, keep it as a possible boundary by setting high = middle. Otherwise set low = middle + 1.',
      },
      {
        title: 'Termination is part of the design',
        body: 'While low < high, middle always refers to a real array element. Each update strictly shrinks the interval. When low equals high, all earlier positions are too small and this is the first qualifying position or n. The array is never read at index n.',
      },
    ],
    example: `Input: values = [1, 3, 3, 7], target = 3.
Start low = 0, high = 4. Middle 2 contains 3, so high becomes 2.
Middle 1 contains 3, so high becomes 1.
Middle 0 contains 1, so low becomes 1.
Return 1, the first occurrence, not the arbitrary matching position 2.`,
    task: `Write lowerBound(values, target), returning the smallest zero-based index i where values[i] >= target. Return values.length when no element qualifies.
Input is a nondecreasing integer array of length 0 through 1000000. Values and target are between -1000000000 and 1000000000. Do not modify the array.
Required examples: lowerBound([2, 4, 4, 4, 9], 4) returns 1; with target 6 returns 4; with target 10 returns 5; lowerBound([], 3) returns 0.
Use O(log(n + 1)) time and O(1) extra space.`,
    starter: `function lowerBound(values, target):
    low = 0
    high = length(values)
    while low < high:
        middle = low + floor((high - low) / 2)
        // Classify middle and shrink the unclassified interval.
    return low`,
    hints: [
      'Finding an equal value does not prove it is the first qualifying value. Which side could contain an earlier one?',
      'If values[middle] >= target, set high to middle. Otherwise middle cannot be the answer, so set low to middle + 1.',
    ],
    solution: `function lowerBound(values, target):
    low = 0
    high = length(values)
    while low < high:
        middle = low + floor((high - low) / 2)
        if values[middle] >= target:
            high = middle
        else:
            low = middle + 1
    return low

For [2, 4, 4, 4, 9] with target 6, middle 2 contains 4, so low becomes 3. Middle 4 contains 9, so high becomes 4. Middle 3 contains 4, so low becomes 4. Return 4.
With target 10, every inspected value is too small and low eventually reaches 5. Empty input starts with both bounds at 0 and returns 0 without reading an element.
Sorted order makes each classification apply to an entire side. The invariant therefore survives each update, and termination identifies the boundary. The interval roughly halves each time, giving O(log(n + 1)) time and O(1) extra space.`,
    checklist: [
      'I can state what is known below low and at or above high.',
      'I return the first qualifying position when duplicates exist.',
      'I handle empty input and a target larger than all values without reading past the array.',
      'Both branches strictly shrink the interval.',
    ],
    pitfalls: [
      'Returning immediately on equality can return a later duplicate.',
      'Combining half-open bounds with high = middle - 1 can skip the answer.',
      'Setting low = middle can fail to make progress when the interval has one element.',
    ],
  },
  {
    id: 'stack-balanced-delimiters',
    track: 'dsa',
    title: 'Stacks: match nested obligations',
    minutes: 20,
    summary: 'Use last-in, first-out order to validate correctly nested brackets.',
    objectives: [
      'Explain why balanced counts do not imply valid nesting.',
      'Represent unfinished opening brackets with a stack.',
      'Handle early mismatches and unfinished input separately.',
    ],
    concepts: [
      {
        title: 'The newest opener must close first',
        body: 'Nested structures create obligations in reverse order. If a square bracket opens inside parentheses, it must close before the parentheses do. A stack stores these outstanding openers, with the most recent on top.',
      },
      {
        title: 'Match type as well as count',
        body: 'On an opener, push it. On a closer, require a nonempty stack and a matching top element, then pop. A string such as "([)]" has equal opening and closing counts but invalid nesting, so counters alone are insufficient.',
      },
      {
        title: 'Validate the end state',
        body: 'Reject an incompatible closer immediately because no future character can repair the prefix. After all input is consumed, accept only if the stack is empty. Remaining openers represent unfinished obligations. Each character is processed once; maximum nesting depth determines stack space.',
      },
    ],
    example: `Input: "([]{})".
Push (, then [. The ] matches [ and pops it.
Push {. The } matches { and pops it.
The final ) matches ( and leaves an empty stack. Return true.
For "([)]", the ) encounters [ on top, so return false immediately.`,
    task: `Write isBalanced(text), returning true exactly when all brackets are matched by type and correctly nested.
Input length is 0 through 100000 and contains only these six characters: ( ) [ ] { }. No other characters need handling. Empty input is valid.
Required examples: isBalanced("{[()]}[]") returns true; isBalanced("[(])") returns false; isBalanced("]") returns false; isBalanced("((") returns false; isBalanced("") returns true.
Use O(n) time and at most O(n) extra space.`,
    starter: `function isBalanced(text):
    stack = empty stack
    matchingOpener = map from each closer to its opener
    for character in text:
        // Push an opener or validate and pop a closer.
    return stack is empty`,
    hints: [
      'The stack only needs unmatched openers, not the entire processed prefix.',
      'Before popping for a closer, check both that the stack is nonempty and that its top equals the closer’s required opener.',
    ],
    solution: `function isBalanced(text):
    stack = empty stack
    matchingOpener = { ")": "(", "]": "[", "}": "{" }
    for character in text:
        if character is "(" or "[" or "{":
            push character onto stack
        else:
            if stack is empty:
                return false
            if top(stack) != matchingOpener[character]:
                return false
            pop stack
    return stack is empty

For "{[()]}[]", the first three openers push {, [, (. The next three closers pop (, [, { in that order. The final [] pushes and pops [, leaving no obligations. Return true.
For "[(])", ] requires [ but the top is (, so return false. For "((", no closer fails, but the nonempty final stack still requires false.
The stack is exactly the sequence of unmatched openers in encounter order. Matching its top enforces proper nesting. Time is O(n), and extra space is O(d) for maximum nesting depth d, which can be n.`,
    checklist: [
      'I can explain why "[(])" fails despite balanced counts.',
      'I guard against popping an empty stack.',
      'I check the final stack rather than assuming every processed prefix is complete.',
      'I can relate space usage to maximum nesting depth.',
    ],
    pitfalls: [
      'Counting each bracket type ignores cross-type nesting.',
      'Accepting after the loop without checking the stack allows unfinished openers.',
      'Removing the oldest opener uses queue order instead of nesting order.',
    ],
  },
  {
    id: 'graph-bfs-shortest-hops',
    track: 'dsa',
    title: 'Graph BFS: shortest paths by layers',
    minutes: 25,
    summary: 'Discover unweighted graph distances with a queue and a visited-state invariant.',
    objectives: [
      'Model connections as an adjacency list.',
      'Explain why first discovery gives the shortest unweighted distance.',
      'Avoid repeated work on cycles and disconnected graphs.',
    ],
    concepts: [
      {
        title: 'Distance means edge count',
        body: 'In an unweighted graph, every edge costs one hop. Breadth-first search explores all nodes at distance 0, then 1, then 2, and so on. A first-in, first-out queue preserves this layer order. Weighted edges require a different shortest-path method.',
      },
      {
        title: 'Mark on discovery',
        body: 'Use a distance array initialized to -1 as both result and visited state. Set the start distance to 0 before enqueueing it. For an undiscovered neighbor, set its distance before enqueueing. This prevents multiple parents from adding the same node repeatedly.',
      },
      {
        title: 'Make queue operations cheap',
        body: 'An array plus a moving head index provides constant-time dequeue without shifting remaining elements. In an adjacency list, BFS processes each reachable node once and scans its neighbor entries once. Initialization plus traversal takes O(V + E) time and O(V) extra space.',
      },
    ],
    example: `Nodes 0 through 4 have undirected edges [0,1], [0,2], [1,3], [2,3]. Node 4 is isolated.
Starting at 0: discover 1 and 2 at distance 1. Processing 1 discovers 3 at distance 2. Processing 2 does not enqueue 3 again because it already has a distance.
Distances are [0, 1, 1, 2, -1]. The shortest route from 0 to 3 has two hops; node 4 is unreachable.`,
    task: `Write hopDistances(n, edges, start), returning an array of n shortest hop counts from start. Use -1 for unreachable nodes.
Nodes are integers 0 through n - 1. Each pair [a, b] is an undirected, unweighted edge, so it must appear in both adjacency lists. Constraints: 1 <= n <= 100000; 0 <= edges.length <= 200000; start and endpoints are valid node IDs. No self-loops or duplicate edges are supplied.
Required example: n = 6, edges = [[0,1],[1,2],[2,0],[2,3],[3,4]], start = 1 returns [1,0,1,2,3,-1].
For n = 1, edges = [], start = 0, return [0]. Include adjacency-list construction and aim for O(n + edges.length) time.`,
    starter: `function hopDistances(n, edges, start):
    neighbors = n empty lists
    // Add both directions of every edge.
    distance = array of n copies of -1
    queue = [start]
    head = 0
    distance[start] = 0
    while head < length(queue):
        // Read queue[head], advance head, and discover neighbors.
    return distance`,
    hints: [
      'Store every undirected connection twice. A node’s distance changes from -1 only on its first discovery.',
      'When visiting node u, every newly discovered neighbor gets distance[u] + 1. Assign that value before enqueueing the neighbor.',
    ],
    solution: `function hopDistances(n, edges, start):
    neighbors = n empty lists
    for [a, b] in edges:
        append b to neighbors[a]
        append a to neighbors[b]
    distance = array of n copies of -1
    distance[start] = 0
    queue = [start]
    head = 0
    while head < length(queue):
        u = queue[head]
        head = head + 1
        for v in neighbors[u]:
            if distance[v] == -1:
                distance[v] = distance[u] + 1
                append v to queue
    return distance

Starting at 1 in the practice graph, discover 0 and 2 at distance 1. Their connecting edge does not add either again. Node 2 discovers 3 at distance 2; node 3 discovers 4 at distance 3. Node 5 stays -1. The result is [1,0,1,2,3,-1].
Because the queue processes distances in nondecreasing order, any shorter path to a newly discovered node would have reached it from an earlier layer already. Thus first discovery is shortest. Construction and traversal take O(n + E) time. Adjacency storage uses O(n + E); the distance array and queue use O(n) additional space.`,
    checklist: [
      'I add both directions for each undirected edge.',
      'I mark a node before enqueueing it and can trace the triangle without duplicate work.',
      'I preserve -1 for unreachable nodes and 0 for the start.',
      'I can explain why this algorithm does not solve arbitrary weighted shortest paths.',
      'I include adjacency storage when reporting total memory.',
    ],
    pitfalls: [
      'Marking visited only when dequeuing allows duplicate queue entries.',
      'A stack explores depth-first and does not guarantee shortest first discovery.',
      'Repeatedly removing the first array element may turn queue maintenance into quadratic work.',
    ],
  },
  {
    id: 'design-requirements-capacity',
    track: 'system-design',
    title: 'Requirements before architecture',
    minutes: 25,
    summary: 'Scope a service, estimate its load, and connect each assumption to a design decision.',
    objectives: [
      'Separate product behavior from measurable quality targets.',
      'Estimate average traffic, peak traffic, and storage with explicit units.',
      'Choose an initial architecture without treating estimates as precise forecasts.',
    ],
    concepts: [
      {
        title: 'Start with the user contract',
        body: 'Functional requirements describe operations, such as creating a note or opening a shared note. Quality requirements describe acceptable latency, availability, durability, and privacy. Name the critical user journey and explicit non-goals before selecting databases or queues.',
      },
      {
        title: 'Keep the units visible',
        body: 'Daily operations divided by 86400 seconds gives average operations per second. A stated peak multiplier produces a planning estimate, not a guaranteed maximum. Storage is records per day multiplied by bytes per record and retention days. Replicas, indexes, backups, and protocol overhead are separate costs.',
      },
      {
        title: 'Let assumptions drive decisions',
        body: 'A modest average load can still have bursts or a hot record. Start with the simplest design that meets the stated contract, then identify which metric would trigger a change. Capacity estimates alone do not establish latency or availability; use representative load tests and operational measurements.',
      },
    ],
    example: `Consider a private note service with 40000 daily active users, 15 reads and 2 writes per user per day, and a 6-times peak multiplier.
Reads: 600000 per day / 86400 = about 6.94 per second on average, or 41.7 at assumed peak.
Writes: 80000 per day / 86400 = about 0.93 per second on average, or 5.6 at assumed peak.
If each write creates a new retained 2000-byte record and retention is 90 days, raw storage is 14.4 billion bytes, or 14.4 decimal GB. Three full copies require 43.2 GB before indexes and backups.
A stateless API and a managed database are a plausible starting point. These figures do not justify sharding by themselves.`,
    task: `Prepare a short design brief for a private bookmark service. Users create bookmarks and list their own recent bookmarks. Public sharing, search, and offline synchronization are out of scope.
Assume 200000 daily active users, 20 list requests and 2 new bookmarks per user per day, a 10-times peak multiplier for both operations, 1000 bytes per stored bookmark, 180-day retention, and three full data copies. Use decimal GB and exclude indexes, backups, and request payload overhead from the storage calculation.
Product targets: p95 list latency under 300 ms at the assumed peak, 99.9% monthly request availability, and durable acknowledged writes. Authorization must prevent access to another user’s bookmarks.
Deliver: a scope statement; average and peak read/write estimates; raw and replicated storage; a request flow; two risks or unknowns with validation steps. Use the self-assessment checklist, not a numerical grade.`,
    hints: [
      'Calculate daily reads and writes separately before converting either to requests per second. List requests are not new storage records.',
      'Storage grows by new bookmarks per day, not by active users alone. Explain authorization and durability in the request flow, and identify assumptions a load test must check.',
    ],
    solution: `One reasonable brief scopes the service to authenticated create and recent-list operations. Every database query is constrained to the authenticated owner; ownership is not accepted from an untrusted request parameter.
Reads: 200000 × 20 = 4000000 per day, about 46.3 per second average and 463 per second peak.
Writes: 200000 × 2 = 400000 per day, about 4.63 per second average and 46.3 per second peak.
Raw storage: 400000 × 1000 × 180 = 72000000000 bytes, or 72 GB. Three full copies require 216 GB before omitted overhead.
Flow: client authenticates to a stateless API; the API validates input and owner identity; a database stores bookmarks indexed by owner and creation time; lists use bounded pagination. A create response is sent only after the chosen database durability policy confirms the write. Replication configuration and recovery tests must support that policy.
Start with a managed relational database rather than speculative sharding. Risk one is uneven activity: load-test bursty users, pagination sizes, and index behavior against p95 latency. Risk two is storage and recovery overhead: measure real index size and test backup restoration and failover. Monitor availability rather than inferring it from replica count.
Other architectures can be reasonable if they preserve the same contract and explain their tradeoffs. This is a discussion checklist, not a uniquely correct diagram.`,
    checklist: [
      'I state the two supported operations and at least two non-goals.',
      'I show separate average and peak traffic estimates with requests-per-second units.',
      'I distinguish 72 GB of raw records from 216 GB of replicated records and name excluded overhead.',
      'My flow explains owner authorization, pagination, and when a write is acknowledged.',
      'I connect two uncertainties to specific measurements or recovery tests.',
    ],
    pitfalls: [
      'Treating daily traffic as requests per second overstates load dramatically.',
      'Multiplying read traffic by record size and retention confuses transfer volume with stored data.',
      'A replica count alone is not proof of durability, availability, or successful recovery.',
      'Choosing distributed components before clarifying requirements adds unexplained complexity.',
    ],
  },
  {
    id: 'design-cache-data-flow',
    track: 'system-design',
    title: 'Caching: trace hits, misses, and writes',
    minutes: 25,
    summary: 'Design a cache as a fallible copy, not an unexplained box between clients and data.',
    objectives: [
      'Trace cache-aside read hits, read misses, and updates.',
      'Describe stale-data races and distinguish freshness from correctness.',
      'Plan for cache outages and hot-key bursts without overwhelming the database.',
    ],
    concepts: [
      {
        title: 'Name the source of truth',
        body: 'In cache-aside, the application checks the cache, reads the database on a miss, and optionally stores the result with an expiration. The database remains authoritative. A cached response can be stale; the product contract must say where that is acceptable and where authoritative validation is required.',
      },
      {
        title: 'Invalidation has races',
        body: 'Writing the database and then deleting a cache entry is useful but not a complete consistency protocol. An earlier read can fetch old data, pause, and repopulate the cache after deletion. Expiration limits an entry’s lifetime after insertion, not necessarily its age since the database changed. Strict freshness needs stronger coordination or an authoritative read.',
      },
      {
        title: 'A cache failure changes downstream load',
        body: 'A high hit rate can conceal a database that cannot handle all incoming reads. Short cache timeouts, bounded fallback concurrency, request coalescing, and load shedding protect the source. Coalescing means multiple misses for one key share one in-flight source read; coordinating across API instances requires an explicit design.',
      },
    ],
    example: `A public article service receives 2000 reads per second with a 95% hit rate. In a simplified steady-state model, database reads are 2000 × 0.05 = 100 per second.
A cold cache could send all 2000 reads per second to the database: 20 times its usual read load.
With cache-aside, a hit returns the article immediately. A miss reads the database and caches the article for 60 seconds. An edit commits to the database, then attempts cache deletion.
A paused miss can still repopulate an old article after that deletion. A 60-second expiration alone is therefore not proof that every response is at most 60 seconds behind an edit.`,
    task: `Design the read and update flow for public product descriptions. Normal traffic is 5000 reads per second, expected hit rate is 90%, and the database has been load-tested for at most 1200 reads per second under the relevant write load.
Descriptions may be briefly stale during browsing. Checkout must validate current price and stock against the authoritative service; neither is served from this description cache.
Deliver: cache key and contents; hit, miss, and description-update flows; an expiration policy; one stale-repopulation timeline; a cache-outage protection plan; and three operational metrics. Estimate normal database reads and the cache-outage overload factor.
Do not promise a hard freshness bound from expiration alone. Use the checklist to discuss tradeoffs; multiple designs are acceptable.`,
    hints: [
      'Normal misses are the fraction not served by the cache. Compare full incoming traffic, not normal misses, with the tested database capacity.',
      'Trace a reader fetching an old value before an update but inserting it after invalidation. Then decide how to prevent, detect, or tolerate that race without using cached price or stock at checkout.',
    ],
    solution: `A reasonable key is description:v1:productId:locale, with a canonical validated locale. Cache only public description fields, source version, and source-read metadata; do not include user-specific content or checkout decisions.
On a hit, return the description. On a miss, coalesce concurrent requests for the same key, read the authoritative store through a bounded concurrency pool, and cache a successful result with a nominal 60-second expiration plus small randomized jitter. Jitter spreads expirations; it is not a freshness guarantee.
For updates, commit to the source first, then delete relevant description keys. Record and retry failed invalidations. A possible race is: reader A fetches version 4; writer B commits version 5 and deletes the cache key; A stores version 4. For this browsing contract, accept brief staleness, bound source-read time, and skip cache insertion for overdue reads. Stronger requirements could use coordinated version-aware insertion or bypass the cache for critical reads.
Normal database reads are 5000 × 0.10 = 500 per second. An unprotected outage sends 5000 per second, about 4.17 times the tested 1200-per-second capacity, and 10 times normal database read load.
Use short cache timeouts and a circuit breaker. Bound aggregate fallback traffic across API instances below the tested capacity with headroom for other work, coalesce hot keys, and reject excess browsing requests with a retryable response instead of allowing an unbounded queue. Per-instance limits must account for instance count.
Track cache hit rate, source-read rate and saturation, and end-to-end p95 latency with error rate. Also alert on invalidation failures. At checkout, the authoritative service validates price and stock independently of this cache.
The chosen policy favors browsing availability and simplicity over strict freshness; that tradeoff is explicit rather than hidden.`,
    checklist: [
      'I can trace a hit, a miss, and an update without treating the cache as authoritative.',
      'I calculate 500 normal source reads per second and about 4.17 times capacity during an unprotected outage.',
      'I describe a stale-repopulation race and avoid claiming expiration alone eliminates it.',
      'My outage plan bounds aggregate database traffic and defines an overload response.',
      'I keep authoritative checkout validation separate and name at least three useful metrics.',
    ],
    pitfalls: [
      'Including private fields in a public shared cache can expose data across users.',
      'Treating cache failure as unlimited database fallback can cause a second outage.',
      'Saying “invalidate after writes” without a race timeline overstates freshness.',
      'A global hit-rate average can hide a single hot key or a poorly performing locale.',
    ],
  },
  {
    id: 'ml-evaluation-leakage',
    track: 'ml',
    title: 'Evaluation: measure the decision you will make',
    minutes: 25,
    summary: 'Choose useful classification metrics and keep future information out of model development.',
    objectives: [
      'Calculate precision and recall from a confusion matrix.',
      'Choose an evaluation split that resembles deployment.',
      'Recognize feature, preprocessing, and model-selection leakage.',
    ],
    concepts: [
      {
        title: 'Start with the cost of mistakes',
        body: 'Precision asks what fraction of predicted positives are truly positive. Recall asks what fraction of actual positives are found. Accuracy can be misleading when positives are rare: predicting no positives can look strong while finding nothing. Select a metric and operating constraint that reflect the real intervention.',
      },
      {
        title: 'Only use information available at prediction time',
        body: 'A feature is not safe merely because it is stored in a table. Confirm when it becomes available relative to the prediction. Refund status, eventual resolution, and future activity can reveal outcomes. Build historical features with a cutoff at the prediction timestamp.',
      },
      {
        title: 'Keep evaluation data out of fitting',
        body: 'Fit imputation, scaling, encoders, and learned feature selection on training data only. Use validation data for thresholds and model choices, then evaluate the fixed pipeline once on an untouched test set. Choose temporal or group-aware splits to match whether deployment predicts future events, new entities, or both.',
      },
    ],
    example: `A review model evaluates 1000 transactions, of which 40 are actually fraudulent. It flags 50 transactions: 30 are fraud and 20 are legitimate.
True positives = 30; false positives = 20; false negatives = 10; true negatives = 940.
Precision = 30 / 50 = 60%. Recall = 30 / 40 = 75%. Accuracy = 970 / 1000 = 97%.
An always-legitimate classifier has 96% accuracy but 0% recall. The 97% model may be useful, but usefulness also depends on review cost, missed-fraud cost, and the threshold.`,
    task: `You predict whether a newly opened support ticket will need escalation within seven days. Prediction happens at ticket creation. The deployment population is future tickets, including repeat customers.
A validation set has 2000 tickets with 100 actual escalations. At one threshold, 160 are flagged: 80 actual escalations and 80 non-escalations.
Candidate features are initial message length, queue at creation, customer escalation count strictly before creation, final resolution code, and total messages exchanged before closure.
Deliver: all four confusion-matrix counts; precision, recall, and accuracy; safe and unsafe features with reasons; a time-based train/validation/test plan that respects the seven-day label delay; and a threshold-selection plan if reviewers can inspect at most 100 of every 2000 tickets.
No training or code execution is needed. State what the supplied counts cannot tell you.`,
    hints: [
      'Subtract the 80 detected escalations from the 100 actual escalations, then derive true negatives from the 1900 non-escalations.',
      'A threshold that flags 160 tickets exceeds the review budget. You need validation scores to evaluate a higher threshold or top-100 policy; the existing confusion matrix cannot reveal its performance.',
    ],
    solution: `True positives = 80; false positives = 80; false negatives = 20; true negatives = 1820.
Precision = 80 / 160 = 50%. Recall = 80 / 100 = 80%. Accuracy = (80 + 1820) / 2000 = 95%. An always-negative baseline also has 95% accuracy but 0% recall.
Initial message length and queue at creation are available at prediction time. Historical escalation count is usable only if each included escalation was already known before creation; a reconstructed history containing later outcomes would leak. Final resolution code and total messages before closure are unsafe because they describe the future.
Choose chronological windows: train on older tickets, tune on a later window, and reserve the latest window for final testing. At each simulated training or selection cutoff, include only examples whose seven-day outcome window has fully elapsed. Leave the needed maturity gap before the next simulated deployment, and wait for test labels to mature before scoring. Build features as of each ticket’s creation, not the extraction date.
Fit preprocessing on training only. Tune using validation scores and labels; lock the pipeline before test evaluation. Since deployment includes repeat customers, chronological splitting is the primary match. Also report new-customer performance as a slice, and check near-duplicate tickets rather than assuming a random split is safe.
The current threshold violates the 100-ticket budget. Compare candidate thresholds or a defined top-100 policy on validation scores, maximizing escalations found within that budget. Specify tie-breaking and whether review happens in batches; a live queue needs an appropriate capacity policy. The supplied counts cannot determine precision or recall at a different threshold, score calibration, or future traffic performance.`,
    checklist: [
      'I derive 80 true positives, 80 false positives, 20 false negatives, and 1820 true negatives.',
      'I calculate 50% precision and 80% recall and explain why 95% accuracy is insufficient.',
      'I reject future-dependent features and verify availability of historical outcomes.',
      'My split and preprocessing plan respect time order and label maturity.',
      'I recognize the review-budget violation without inventing metrics at another threshold.',
    ],
    pitfalls: [
      'Computing aggregates over a customer’s full history can include events after prediction.',
      'Fitting a scaler or feature selector before splitting leaks evaluation information.',
      'Repeatedly choosing models based on test results turns the test set into validation data.',
      'A confusion matrix at one threshold does not specify the entire precision-recall curve.',
    ],
  },
  {
    id: 'ml-bias-variance',
    track: 'ml',
    title: 'Bias and variance: choose the next experiment',
    minutes: 20,
    summary: 'Use training and validation behavior to form testable hypotheses instead of blindly adding complexity.',
    objectives: [
      'Recognize underfitting and overfitting patterns in comparable errors.',
      'Choose interventions that address an observed learning problem.',
      'Separate diagnostic hypotheses from conclusions about causality.',
    ],
    concepts: [
      {
        title: 'Compare errors on the same basis',
        body: 'Training error measures fit to seen data; validation error estimates performance on unseen data from the chosen evaluation population. Compare the same loss and preprocessing. If both errors are poor, insufficient model capacity, weak features, optimization failure, or noisy labels may be responsible. High bias is a useful hypothesis, not the only explanation.',
      },
      {
        title: 'Look at the generalization gap',
        body: 'Low training error and much higher validation error suggest overfitting, but distribution shift or an unrepresentative split can produce the same pattern. Regularization, simpler models, and more representative training examples can help after checking split integrity. A larger model is not the default response to a large gap.',
      },
      {
        title: 'Use learning curves to test hypotheses',
        body: 'Compare errors as training-set size grows while holding the evaluation set fixed. Falling validation error suggests more representative data may help. A high plateau with little gap points toward features, capacity, optimization, or irreducible noise. Tune on validation, keep the test set untouched, and consider uncertainty across runs and meaningful slices.',
      },
    ],
    example: `On a fixed validation set, a flexible model has these classification error rates:
With 1000 training examples: training 2%, validation 18%.
With 5000 training examples: training 4%, validation 12%.
With 20000 training examples: training 5%, validation 9%.
The shrinking gap and improving validation error support collecting more representative data as a promising experiment. They do not prove that the next batch will improve equally, or that all remaining error is variance.
A separate simple model at training 17% and validation 18% needs a different investigation: verify optimization and features before assuming more of the same data will fix it.`,
    task: `A binary classifier uses the same clean chronological split and classification-error metric across these runs. A simple baseline has training error 19% and validation error 20%. A larger model has training error 1% and validation error 13%. The larger model with regularization has training error 6% and validation error 9%.
The product goal is validation error at most 10%, subject to acceptable errors across important user groups. The untouched test set has not been scored.
Deliver: a tentative diagnosis for each run; a provisional model choice; two next experiments, each with one changed factor and a success criterion; and checks required before claiming readiness.
Do not compute a formal bias/variance decomposition from these three pairs of numbers. No training or code execution is required.`,
    hints: [
      'Compare both the absolute error and the training-to-validation gap. The smallest training error is not necessarily the best candidate.',
      'The regularized model meets the aggregate validation target. A final claim still needs slice checks, uncertainty assessment, and a one-time test evaluation after choices are fixed.',
    ],
    solution: `The simple baseline has a one-percentage-point gap but poor errors on both sets. Underfitting is plausible; first confirm convergence, usable features, and label quality. The larger model fits training extremely well but has a 12-point gap, suggesting overfitting after checking temporal shift and split representativeness. Regularization raises training error to 6% while lowering validation error to 9%, evidence that limiting fit helped generalization in this comparison.
Provisionally choose the regularized model: it has the lowest observed validation error and meets the aggregate 10% goal. Do not choose the 1%-training-error model merely for fitting training best.
Experiment one: vary only regularization strength over a small prespecified range, keeping architecture, data, and training budget fixed. Success is a stable validation improvement below 9% across repeated seeds without worsening predefined critical slices beyond their agreed limits.
Experiment two: keep the selected model configuration fixed and add a larger representative training sample with the same historical cutoff and feature rules. Compare against the current sample on the same validation window. Success is a repeatable reduction in validation error and a narrower gap without harmful slice regressions.
Before readiness, inspect class-specific errors, important user groups, temporal drift, uncertainty from finite evaluation data, and inference cost. Define acceptable slice thresholds with product stakeholders rather than inventing them after seeing results. Lock preprocessing, model, and decision threshold, then evaluate once on the untouched test set. These results support a model-selection hypothesis; they do not identify exact bias, variance, or irreducible error.`,
    checklist: [
      'I describe the gaps as 1, 12, and 3 percentage points.',
      'I select the 9%-validation-error model provisionally rather than optimizing training error.',
      'I name at least one explanation other than model capacity for poor generalization.',
      'Each proposed experiment changes one factor and has a stated success criterion.',
      'I keep the test set out of iteration and include slice and uncertainty checks before readiness.',
    ],
    pitfalls: [
      'Interpreting a training-validation gap as a direct numerical estimate of variance is unjustified.',
      'Comparing different metrics or different evaluation populations makes gaps hard to interpret.',
      'Adding regularization indefinitely can eventually cause underfitting.',
      'An aggregate target can hide unacceptable errors for a smaller group.',
    ],
  },
  {
    id: 'behavioral-star-evidence',
    track: 'behavioral',
    title: 'STAR: make your contribution observable',
    minutes: 20,
    summary: 'Turn a vague success story into a concise account of your actions, evidence, and learning.',
    objectives: [
      'Separate situation, responsibility, actions, and results.',
      'Distinguish personal contribution from team accomplishments.',
      'Use honest evidence and reflection without inventing impact.',
    ],
    concepts: [
      {
        title: 'Give context a time budget',
        body: 'Situation explains why the work mattered; task explains what you personally owned. Keep both brief enough to leave room for actions. The listener needs stakes and constraints, not a full organizational history.',
      },
      {
        title: 'Show decisions, not adjectives',
        body: 'Replace “I communicated well” with the conversation you initiated, the disagreement you clarified, or the artifact you created. Explain why you chose those actions. Use “I” for your contribution and “we” for shared work, giving teammates appropriate credit.',
      },
      {
        title: 'Use evidence with boundaries',
        body: 'A result can be a measured change, an accepted decision, a prevented issue, or a specific lesson. Distinguish observed outcomes from your interpretation of their cause. If there was no reliable measurement, say so and offer concrete qualitative evidence rather than inventing a percentage.',
      },
    ],
    example: `Illustrative fictional story:
Situation: Our volunteer event had six coordinators using different signup lists, and two volunteers arrived for a canceled shift.
Task: I owned a reliable schedule for the next event, due in one week.
Action: I asked each coordinator how changes were recorded, combined their lists into one shared schedule, and added a named owner and confirmation step for every change. I tested the process with one coordinator before asking the others to adopt it.
Result: At the next event, all six coordinators used the shared schedule and no canceled-shift arrivals were reported. I cannot attribute every improvement to the schedule alone. I learned to test the handoff process, not just tidy the document.
The specificity comes from responsibilities and observable actions, not from a dramatic project.`,
    task: `Practice answering: “Tell me about a time you improved a process without being asked.”
Choose a real work, school, community, or personal-project example. Draft a 180-to-250-word answer intended for about two minutes of speaking. Include brief context, your responsibility, at least two specific actions with a reason for one decision, one honest outcome, and one lesson you would reuse.
Mark any unverified number as an estimate or remove it. If you have no relevant real example, rehearse a clearly labeled fictional scenario rather than presenting it as lived experience.
Then prepare short follow-up answers to: “What did you personally do?” and “What would you change next time?”
Use the checklist for reflection; there is no automated grade or single correct story.`,
    hints: [
      'Start by writing two sentences beginning “I did…” with observable verbs. Build only the context needed to understand those actions.',
      'For the result, identify what another person or an artifact could confirm. A limited but honest outcome is stronger than an unsupported large claim.',
    ],
    solution: `Illustrative fictional rehearsal answer, not a script to claim as personal experience:

During a university group project, our four-person team repeatedly discovered incompatible file formats the evening before a weekly demo. We had no shared checklist, and each person interpreted “ready” differently. I was responsible for integrating the demo, but nobody had asked me to change our process.

After one difficult integration, I asked each teammate to show me the files they produced and explain the assumptions behind them. I compared those examples and drafted a small interface checklist covering field names, date formats, and one sample output. I chose a short checklist rather than a new tool because we had only two weeks left and everyone already used the same shared document.

I tested the checklist against my own component, then paired with one teammate to find unclear wording. At our next meeting, I proposed trying it for one demo rather than declaring a permanent rule. The team agreed, and I collected issues during integration.

The next demo integrated without a format-related rework request. We did not measure total time saved, so I would not claim a percentage improvement. My teammates contributed examples and corrections; my contribution was identifying the recurring handoff problem and organizing a lightweight trial. Next time, I would define the interface at the start and make ownership of checklist updates explicit.

For the personal-contribution follow-up, name the investigation, draft, pilot, and proposal. For the improvement follow-up, explain earlier interface agreement and maintenance ownership. Adapt the structure to truthful details from your own experience, not these fictional events.`,
    checklist: [
      'I keep my draft within 180 to 250 words and rehearse it aloud.',
      'A listener can identify my responsibility and at least two concrete actions.',
      'I explain one decision instead of only listing activities.',
      'I distinguish team credit, observed outcomes, and estimates.',
      'I answer both follow-up questions without inventing new facts.',
    ],
    pitfalls: [
      'Spending most of the answer on context leaves no evidence of your contribution.',
      'Using only “we” obscures ownership; using only “I” can erase collaborators.',
      'Invented metrics make an otherwise credible story unreliable.',
      'Memorizing a fictional sample as personal history defeats the purpose of the exercise.',
    ],
  },
  {
    id: 'behavioral-tradeoffs-conflict',
    track: 'behavioral',
    title: 'Disagreement: explain tradeoffs without blame',
    minutes: 25,
    summary: 'Show how you surfaced competing goals, reached a decision, and supported the outcome.',
    objectives: [
      'Represent another person’s concern fairly and concretely.',
      'Compare options using shared criteria rather than personal preferences.',
      'Explain decision ownership, follow-through, and what evidence changed your view.',
    ],
    concepts: [
      {
        title: 'Find the legitimate competing goals',
        body: 'A disagreement often reflects different responsibilities: delivery speed, reliability, cost, or maintainability. Describe the other person’s concern in terms they would recognize. Avoid assigning motives or turning the story into proof that a colleague was foolish.',
      },
      {
        title: 'Make the decision inspectable',
        body: 'Agree on success criteria, compare feasible options, and gather only the evidence needed to resolve the important uncertainty. A reversible trial may be better than a prolonged debate. If disagreement remains, use the accountable decision owner and make risks visible rather than escalating to win.',
      },
      {
        title: 'Support the outcome and learn',
        body: 'Explain what you did after the decision, including when your preferred option was not chosen. Responsible alignment does not mean hiding an unresolved safety or integrity concern; use the appropriate escalation path for those. For ordinary technical tradeoffs, document the decision and define a review trigger.',
      },
    ],
    example: `Illustrative fictional example:
A teammate wanted a new reporting library for flexibility; I preferred extending the existing tool to meet a deadline. We agreed that the release needed three report types, accessible output, and a two-day integration budget.
We tested one report in each option. The new library simplified chart composition but required more accessibility work than the schedule allowed. The release owner chose the existing tool for this release and a later evaluation of the new library.
I implemented the shared output interface so that a later replacement would be less disruptive. My teammate reviewed the accessibility checks. The decision was about release constraints, not who had better taste, and the deferred option retained a clear review point.`,
    task: `Rehearse this explicitly hypothetical scenario: Your team must launch a public event-registration page in ten working days. A teammate proposes rebuilding its form framework, estimated at eight days before integration. You propose extending the current form, estimated at three days. Both estimates are uncertain. The current framework is familiar but has maintenance debt; the new one may simplify future forms. Keyboard accessibility and no duplicate registrations are release requirements.
Prepare a 200-to-300-word response explaining what you would do, not claiming the scenario happened. State the teammate’s strongest concern, compare at least two options, propose one bounded investigation, identify a decision owner, and define a fallback or review trigger.
Then outline a real disagreement using the same structure if you have one. Be explicit about actual outcomes versus hypothetical expectations. Use the checklist for discussion, not grading.`,
    hints: [
      'Before choosing a framework, ask how each option will demonstrate accessibility and prevent duplicate registration. Implementation estimates are not complete release estimates.',
      'Use a short, time-boxed investigation with stop criteria. Explain who decides if evidence remains mixed and what you will do if your preferred option loses.',
    ],
    solution: `Illustrative hypothetical response:

I would first ask my teammate which recurring maintenance problems the new framework would remove. Their strongest concern may be that another extension makes every future form slower to change. I would acknowledge that rather than reducing their proposal to unnecessary work.

I would propose shared release criteria: keyboard-accessible completion, no duplicate registrations, and enough time for integration, testing, and rollback before day ten. The eight-day and three-day estimates are starting assumptions, not guarantees. I would compare extending the current form, adopting the new framework now, and releasing a limited current-form extension while scheduling the broader migration separately.

I would ask the delivery owner to approve a one-day investigation. We would test one representative flow with the proposed framework, check keyboard behavior, and identify how duplicate submissions are prevented by the registration service. We would also inspect the same risks in the current form. A frontend framework alone cannot guarantee uniqueness under concurrent requests.

At the end of that day, I would bring findings, remaining uncertainty, and revised integration estimates to the accountable engineering lead for a decision. If evidence remained weak, I would recommend the smaller extension with documented debt and a dated migration review. If the new framework were selected, I would help implement it and agree on a checkpoint early enough to switch approaches.

If either approach failed the required accessibility or duplicate-registration checks, I would raise that as a release blocker rather than silently lowering the standard. After launch, I would review actual maintenance effort before claiming either option was better.

This response shows a process, not a guaranteed outcome. In a real story, replace predicted steps with actions you actually took and state what happened after the decision.`,
    checklist: [
      'My 200-to-300-word response labels the scenario as hypothetical.',
      'I describe the teammate’s strongest concern without attacking their motives.',
      'I compare at least two options against accessibility, correctness, and delivery criteria.',
      'I time-box an investigation and identify who owns the decision.',
      'I define a fallback or review trigger and explain how I would support a decision I did not prefer.',
    ],
    pitfalls: [
      'Describing conflict as winning an argument hides the decision-making process.',
      'Treating uncertain implementation estimates as full release plans ignores integration and testing.',
      'Claiming a UI framework prevents duplicate records ignores server-side concurrency and persistence.',
      'Saying “disagree and commit” without naming release blockers can imply accepting unmet requirements.',
    ],
  },
];
