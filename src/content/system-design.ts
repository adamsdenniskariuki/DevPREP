import type { Lesson, LessonCore } from '../curriculum-types'
import { starterLessons } from './starter'

function original(id: string): LessonCore {
  const lesson = starterLessons.find(candidate => candidate.id === id)
  if (!lesson) throw new Error(`Missing original system-design lesson: ${id}`)
  return lesson
}

const requirements = original('design-requirements-capacity')
const caching = original('design-cache-data-flow')

export const systemDesignLessons: Lesson[] = [
  {
    ...requirements,
    minutes: 40,
    prerequisites: [],
    prerequisiteNotes: 'Start here. Bring arithmetic with units and the ability to describe an HTTP request; no distributed-systems experience is assumed.',
    concepts: [
      ...requirements.concepts,
      {
        title: 'Turn uncertainty into a range',
        body: `An average is a budget input, not a safety boundary. The bookmark exercise assumes a tenfold peak because no observed arrival distribution exists yet. Record that assumption beside the estimate, then ask whether a launch notification concentrates traffic into one minute. Separate user demand from retries: two attempts per logical request can double the offered traffic without adding users. Plan a load experiment with bursts, skewed owners, and representative page sizes rather than only a smooth stream of tiny requests. Revise the estimate when measurements disagree; the purpose of arithmetic is to expose consequences, not defend the first guess.`,
      },
      {
        title: 'Latency, durability, and capacity are different promises',
        body: `A database that fits all retained bytes may still miss the latency target because indexes do not fit its working memory or a hot owner causes contention. Likewise, a fast acknowledgement says nothing about crash survival unless the storage acknowledgement policy is specified. Distinguish a request availability objective from a recovery objective: a service can return many successful reads while its backups are unusable. Write down who observes latency, which requests count toward availability, and what failures acknowledged data must survive. Measure these independently before using any single number to claim that the design meets its contract.`,
      },
    ],
    walkthrough: [
      {
        title: 'Trace one bookmark creation before drawing boxes',
        body: `A signed-in reader submits a URL. The API derives the owner from the authenticated identity, validates length and allowed URL format, and assigns a bookmark identifier. Storage inserts one record and confirms its configured durable commit before the API returns success. A later list request uses that same authenticated owner and a bounded page size. This trace exposes decisions hidden by a diagram: an untrusted owner parameter cannot select somebody else's records, and a lost success response can cause a duplicate unless a retry contract is added. That retry question becomes the next lesson, not an excuse to ignore it.`,
      },
      {
        title: 'Review the estimate as a design experiment',
        body: `At 400000 new bookmarks per day, retention is the multiplier that turns a daily write budget into a stock of records. Deletion lag creates additional live bytes, so the exercise's 72 GB is a lower-level raw model, not a disk purchase recommendation. Test the p95 target with the proposed owner/time index, a nearly full retention window, and large but allowed pages. Then repeat during a recovery or replica outage. Document which bottleneck appears first and one intervention tied to evidence. A defensible brief can reject sharding today while naming a measured storage or throughput threshold that would reopen the decision.`,
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'A units audit',
        prompt: 'Before the core brief, estimate storage for 12000 new 500-byte records per day retained for 30 days. Show raw bytes and decimal GB, then distinguish storage from reading each record ten times.',
        hints: ['Multiply creations, size, and retention.', 'One decimal GB is one billion bytes; repeated reads do not create retained records.'],
        solution: '12000 × 500 × 30 = 180000000 bytes = 0.18 GB raw. Ten reads per record affect transfer and query work, not this stored-record count. Copies, indexes, and backups require separate estimates.',
        checklist: ['I carry bytes and days through the calculation.', 'I distinguish stored records from requests.', 'I name at least one excluded cost.'],
      },
      {
        id: 'stretch',
        title: 'Challenge the peak assumption',
        prompt: 'After the core brief, replace the tenfold traffic peak with a twentyfold peak without changing users, retention, or daily creations. Explain what changes, what does not, and how you would validate the revised design.',
        hints: ['A peak multiplier redistributes demand; it does not necessarily change daily volume.', 'Check contention and request sizes as well as total throughput.'],
        solution: 'Peak reads become about 926 requests/s and peak writes about 92.6 requests/s. Raw retained storage remains 72 GB under the unchanged daily-creation assumption. Re-run burst and mixed-read/write tests, inspect queue growth and tail latency, and set admission limits below observed saturation rather than assuming twice the hardware always gives twice the capacity.',
        checklist: ['I change both traffic peaks.', 'I leave storage unchanged and explain why.', 'I propose a measurable mixed-workload test.'],
      },
    ],
    followUps: [
      { question: 'Why not size hardware from requests per second alone?', answer: 'Request cost depends on page size, query shape, contention, payload size, and cache state. Benchmark the actual operation mix before mapping demand to a machine count.' },
      { question: 'Does 99.9% monthly request availability imply a fixed outage allowance?', answer: 'It gives a failed-request budget when defined over requests. Converting it into minutes assumes a time-based definition or uniform traffic; a peak-hour outage can spend a request budget much faster.' },
    ],
    takeaways: ['State scope and measurable targets before architecture.', 'Keep rates, stored bytes, copies, and retention separate.', 'Use uncertainty to choose experiments, not to manufacture precision.'],
  },
  {
    id: 'design-api-data-model',
    track: 'system-design',
    title: 'APIs and data models: make retries safe',
    minutes: 45,
    summary: 'Define ownership, pagination, and retry semantics together so the interface and stored invariants agree.',
    prerequisites: ['design-requirements-capacity'],
    prerequisiteNotes: 'Use the bookmark workload and owner isolation from the requirements brief. This lesson adds a contract, not a running backend.',
    objectives: ['Specify a bounded create/list API.', 'Model ownership and uniqueness as invariants.', 'Trace a lost response and an idempotent retry.'],
    concepts: [
      {
        title: 'The interface is an agreement about outcomes',
        body: `Specify who may create a bookmark, maximum field sizes, durable success, and retry behavior. Ownership comes from verified identity; reject a supplied owner field. Distinguish malformed input from temporary dependency failure: unchanged invalid requests should not be retried, whereas temporary failures may permit retries within a deadline. Keep database-specific errors out of the public contract so a storage migration does not break clients.`,
      },
      {
        title: 'Store the invariants you promise',
        body: `Bookmark contains owner_id, bookmark_id, created_at, URL, and title. Intentional repeated saves are allowed; URL is not unique. RetryRecord contains owner_id, idempotency_key, request_fingerprint, bookmark_id, and expiry. Enforce unique owner/key pairs and commit bookmark plus replay information atomically. Otherwise concurrent retries or a crash can create duplicates. Owner scoping prevents unrelated users choosing the same key from colliding or learning each other's result.`,
      },
      {
        title: 'Bound both pagination and the retry window',
        body: `Order by created_at and bookmark_id to break ties. An integrity-protected opaque cursor identifies the last pair; query strictly earlier pairs under the authenticated owner, at most 50 records. This boundary is not a frozen snapshot. Retain replay records for 24 hours and document that later retries may create another bookmark. Unlimited replay would require unlimited history or a different identity rule.`,
      },
    ],
    example: `POST /bookmarks uses an Idempotency-Key and a body containing URL and title, not owner.
First success: 201 with bookmark_id B17. Same owner, key, and normalized body: replay B17.
Same owner and key but different body: 409 conflict, not silent reuse.
GET /bookmarks?limit=50&cursor=opaque returns at most 50 records and a next cursor.
At 400000 creates per day, 24-hour retry retention, and 200 bytes per retry record, raw retry storage is 80000000 bytes = 0.08 decimal GB, before indexes and replication.`,
    walkthrough: [
      {
        title: 'The response disappears after commit',
        body: `Request A authenticates owner O7 and presents key K9. The transaction claims O7/K9, inserts B17, and stores the normalized-body fingerprint with the replay result. The database commits, but the network drops the response. Request B repeats K9 with the same body. It reads the committed retry record and returns B17 without another insertion. If B races before A commits, the uniqueness constraint makes B wait or retry the transaction instead of independently passing a check-then-insert test. A client timeout therefore means an unknown outcome, not proof that nothing was written.`,
      },
      {
        title: 'A tied timestamp meets a changing list',
        body: `Suppose B19 and B18 share the same creation timestamp. A page ending at B19 carries both that timestamp and identifier. The next request filters for pairs below that exact boundary and still includes B18. A new B20 inserted above the boundary does not shift an offset and duplicate yesterday's page. Deleting B19 after the cursor was issued also need not invalidate the boundary because its values, not a live-row lookup, define the comparison. This gives stable traversal boundaries, not a historical snapshot: deletions and edits can still change what the user sees.`,
      },
    ],
    task: `Write a design-level create/list contract for the private bookmark workload. Include request and response shapes, authentication-derived ownership, size and page bounds, replay lifetime, and statuses for malformed input, conflicting key reuse, and temporary overload. Sketch both tables and the atomic transaction boundary. Trace a response lost after commit and a concurrent duplicate request. Explain list behavior when two bookmarks share a timestamp and another is inserted between pages.`,
    hints: ['Decide the uniqueness scope before describing a retry lookup.', 'A cursor needs a total ordering; a timestamp alone may tie.'],
    solution: `Choose owner-scoped keys and a unique constraint on RetryRecord(owner_id, idempotency_key). Validate a bounded request, compute a stable fingerprint of accepted fields, and atomically create B17 plus its replay record. Return the same stable result on a matching replay; return 409 for different content using a retained key. Specify 400 for malformed input and a retryable 503 with bounded backoff guidance for temporary overload. Keep successful replays for 24 hours and tell clients what expiry means. List at most 50 rows using the authenticated owner and a descending (created_at, bookmark_id) boundary. Newer inserts appear on refresh; this is not snapshot isolation across HTTP requests. The rubric rewards an explicit atomic boundary and honest cursor semantics, not a particular identifier format.`,
    checklist: ['I derive ownership from authentication on every operation.', 'I specify bounded payloads, pages, and replay retention.', 'I trace duplicate attempts across an atomic commit.', 'I explain timestamp ties and concurrent list changes.'],
    pitfalls: ['A check followed by an insert is not atomic uniqueness.', 'An opaque cursor can still be reused by an unauthorized caller.', 'Keeping keys forever silently creates an unbounded data set.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Separate identity from content',
        prompt: 'Before the core task, decide whether two intentional saves of the same URL should share an identifier, and distinguish that from a retry of one save.',
        hints: ['Product identity and request identity need not be the same.', 'Ask whether the second action is intentional.'],
        solution: 'Two deliberate saves may create different bookmark identifiers. Two attempts at one action share an owner-scoped idempotency key and return one identifier. URL uniqueness would conflate these cases.',
        checklist: ['I distinguish actions from attempts.', 'I choose an owner scope.', 'I explain why URL equality is insufficient.'],
      },
      {
        id: 'stretch',
        title: 'Retry after deletion',
        prompt: 'After the core contract, consider deleting B17 during its replay window and then retrying the original create. Define behavior without resurrecting the bookmark unexpectedly.',
        hints: ['A replay result need not re-execute the action.', 'Retain enough history to distinguish deletion from a new request.'],
        solution: 'Retain the retry mapping until expiry and return a documented replay outcome indicating the original identifier and its deleted state, or a documented gone response. Do not create another bookmark merely because the target row disappeared. Test deletion racing a retry and clarify behavior after the key expires.',
        checklist: ['I avoid resurrection.', 'I document the response after deletion.', 'I identify a race and retention boundary.'],
      },
    ],
    followUps: [
      { question: 'Must every response field be byte-for-byte identical on replay?', answer: 'No, but the contract must identify stable outcome fields. If exact replay is promised, persist the required response representation rather than recomputing changing fields.' },
      { question: 'Why not return every bookmark in one call?', answer: 'Unbounded responses make memory, latency, and transfer cost depend on an owner’s entire history. Pagination gives the service and client a bounded unit of work.' },
    ],
    takeaways: ['Define retries at the interface and enforce them in storage.', 'Authorization survives every cursor and cache layer.', 'A pagination boundary is not automatically a snapshot.'],
  },
  {
    id: 'design-databases-indexes',
    track: 'system-design',
    title: 'Databases and indexes: design for a query',
    minutes: 45,
    summary: 'Choose a store and index from access patterns, then account for retention, write amplification, and recovery.',
    prerequisites: ['design-api-data-model'],
    prerequisiteNotes: 'Bring the owner-scoped bookmark tables, atomic retry transaction, and ordered cursor contract from the previous lesson.',
    objectives: ['Choose storage from required invariants and access patterns.', 'Explain a composite index using a concrete list request.', 'Estimate index storage separately and plan safe retention.'],
    concepts: [
      {
        title: 'Begin with access patterns, not database labels',
        body: `Bookmarks need owner-isolated ordered lists, point lookups, and atomic bookmark/retry insertion. A relational store maps these to transactions and indexes. Alternatives can work if they support the same invariants: a key-value store needs suitable transactions and ordered range reads. Embedding an owner's entire history in one document instead creates growing-write and size-limit problems. Compare operation costs, not database labels.`,
      },
      {
        title: 'A composite index is an ordered route',
        body: `Index owner_id followed by descending created_at and bookmark_id. Owner equality narrows the range; remaining columns match cursor order. A time-first index may inspect unrelated owners before finding 50 rows. Verify bounded range scans in query plans. Covering title and URL can reduce row fetches but duplicates large values and increases writes; measure the tradeoff using realistic field sizes.`,
      },
      {
        title: 'Logical size is not physical headroom',
        body: `Budget indexes, replay records, free space, logs, replicas, and backups separately. Deletion may not immediately reclaim disk bytes and propagates work to copies. Retention here uses creation age, not last edit, preventing indefinite retention through edits. Delete in bounded batches while monitoring lock waits and replica lag. Time-partition dropping can help cleanup but must preserve query locality and uniqueness.`,
      },
    ],
    example: `For the core workload, 400000 bookmarks/day × 180 days = 72000000 retained rows.
Assume one secondary index costs 64 bytes/row: 72000000 × 64 = 4608000000 bytes = 4.608 decimal GB.
Raw records plus this index: 72 + 4.608 = 76.608 GB per full copy.
Three full copies: 76.608 × 3 = 229.824 GB, excluding logs, free space, backups, and retry records.
Conceptual access path: owner_id = authenticated owner AND (created_at, bookmark_id) < cursor, ordered descending, limit 50.`,
    walkthrough: [
      {
        title: 'Follow a list through the index',
        body: `Owner O7 asks for the next 50 bookmarks below timestamp T and identifier B19. The storage engine seeks to O7/T/B19 in the composite index, scans that owner's earlier entries, and retrieves permitted fields. It stops at the limit instead of sorting millions of unrelated rows. Confirm with an execution plan and measured rows examined; authorization must also constrain a subsequent row fetch, not only an application-side filter. Test owners with very different history sizes and tied timestamps. The same global row count can produce quite different latency when one account owns most of the data.`,
      },
      {
        title: 'Trace an insert during retention work',
        body: `Creating B20 writes the base row, its secondary-index entry, the replay mapping, and a commit log before acknowledgement under the chosen durability policy. Meanwhile, a retention worker deletes a bounded batch of old rows. Excessive batch size holds locks longer, generates more replication work at once, and can make a previously fast create miss its deadline. Start with conservative batches, measure commit latency and lag, and pause cleanup when foreground work is threatened. Track oldest retained row age as well as disk usage so pausing cleanup does not silently break the retention promise.`,
      },
    ],
    task: `Prepare a storage decision for the bookmark create/list contract. Compare a relational option with one alternative using transactions, ordered access, and operational recovery rather than brand names. Specify keys and one list index. Show retained-row, secondary-index, and three-copy storage arithmetic using the example assumptions. Describe the request path and a bounded retention process. Propose measurements that could disprove the choice, including a nearly full data set and retention running concurrently with creates.`,
    hints: ['Column order should follow equality filtering before cursor ordering.', 'A secondary index adds work on writes even when no reads use it.'],
    solution: `Start with a transactional relational store and the owner/time/id index because the service requires an atomic bookmark/replay insert and descending owner lists. A partitioned key-value alternative needs an explicit way to keep that transaction inside one partition and provide range reads; otherwise additional coordination is introduced without a demonstrated need. The model contains 72 million retained rows and a 4.608 GB index per copy; three copies of records plus this index require 229.824 GB before other overhead. Keep large values out of the index initially, fetch at most a bounded page, and benchmark the extra row reads. Delete by creation age in short batches, monitoring foreground latency, lock waits, lag, and cleanup backlog. Restore a backup into an isolated environment to verify the recovery plan; a successful backup job alone is insufficient.`,
    checklist: ['I connect a store choice to transaction and query requirements.', 'I explain composite-index order using one cursor request.', 'I separate records, index bytes, copies, and excluded overhead.', 'I test retention alongside foreground writes and recovery.'],
    pitfalls: ['An index on each individual column is not necessarily equivalent to the composite ordering.', 'Deleting data does not guarantee immediate disk reclamation.', 'A fast empty-database benchmark says little about retained production-scale data.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Spot the wrong leading column',
        prompt: 'Before the core task, compare (created_at, owner_id) with (owner_id, created_at, bookmark_id) for private recent lists. Describe rows each may inspect.',
        hints: ['The owner filter is equality.', 'A cursor needs a tie breaker.'],
        solution: 'The owner-first index seeks directly into one owner’s ordered range and supports a total cursor order. The time-first index groups all owners by time and may inspect unrelated rows; without bookmark_id the proposed ordering also leaves timestamp ties unresolved.',
        checklist: ['I name the equality prefix.', 'I explain unrelated-row work.', 'I include a tie breaker.'],
      },
      {
        id: 'stretch',
        title: 'Price a covering index',
        prompt: 'After the core task, suppose a covering index adds 300 bytes per retained row. Estimate extra bytes per copy and explain what latency evidence would justify it.',
        hints: ['Use 72 million rows.', 'Compare fewer row fetches against larger writes and cache footprint.'],
        solution: '72000000 × 300 = 21600000000 bytes, or 21.6 GB extra per copy and 64.8 GB across three copies. Adopt it only if representative list tests show useful tail-latency or I/O improvement without unacceptable write latency, memory pressure, or recovery time.',
        checklist: ['I show per-copy and replicated growth.', 'I name a measurable read benefit.', 'I name a write or recovery cost.'],
      },
    ],
    followUps: [
      { question: 'Should every foreign-key or filter column have an index?', answer: 'Not automatically. Assess actual queries, cardinality, and write cost, then verify plans. Unused indexes still require maintenance and storage.' },
      { question: 'Can a replica replace a backup?', answer: 'No. Accidental deletion or corrupted application writes can propagate to replicas. Recovery needs independently retained history and a tested restore procedure.' },
    ],
    takeaways: ['Choose a database by the operations and invariants it must support.', 'Explain index order with the real request predicate.', 'Include maintenance and restoration in the storage decision.'],
  },
  {
    ...caching,
    minutes: 45,
    prerequisites: ['design-databases-indexes'],
    prerequisiteNotes: 'Understand the authoritative query and its measured capacity before adding a cache. The original public-description exercise remains separate from private bookmark data.',
    concepts: [
      ...caching.concepts,
      {
        title: 'Budget fallback globally',
        body: `A local connection pool protects one process, not the database as a whole. If six API instances each permit 200 source reads per second, they already consume the entire 1200-per-second tested ceiling before background work. Choose a smaller aggregate budget and divide or coordinate it across the actual instance count. Autoscaling the API must not automatically increase this source budget. Admission can bound rate and concurrent work separately: a slow database may have too many in-flight queries even while starts per second remain modest. Reject excess work promptly instead of letting waiting requests consume every connection and memory slot.`,
      },
      {
        title: 'Cache identity is part of correctness',
        body: `The product-description key contains locale because two users may legitimately need different representations of the same product. Include every public variation that affects the response, normalize allowed values, and cap key cardinality. Do not simply cache a full authenticated response in a public namespace. Negative caching also needs a contract: caching a missing product can reduce repeated lookups but hide a newly created product until invalidation or expiry. Keep negative lifetimes short, distinguish not-found from a source timeout, and never cache a dependency failure as if it proved that the product does not exist.`,
      },
    ],
    walkthrough: [
      {
        title: 'Make the stale-insertion race visible',
        body: `At time zero, reader A misses and starts a source read of description version 4. Writer B commits version 5 and successfully deletes the cache entry. Reader A then resumes and stores version 4, so reader C receives the old description despite successful invalidation. Source-read deadlines and refusing insertion after an excessive delay reduce this window but do not constitute a linearizable protocol. In this exercise browsing can tolerate the outcome; checkout cannot reuse the same path for stock decisions. Explain which response can be stale and why the business action remains safe instead of claiming every read has magically become current.`,
      },
      {
        title: 'Rehearse a cache outage as a controlled experiment',
        body: `Disable cache access in a test while maintaining the original 5000 reads per second. Permit at most 900 source reads per second across the fleet, leaving 300 below the tested ceiling for headroom under the stated model. Excess distinct-key requests receive a retryable response with backoff guidance; same-key requests may share in-flight work. Measure actual database admission, saturation, and client-visible errors. Restore cache access gradually, avoiding a synchronized refill storm. A design that remains inside the source budget may still miss the browsing availability target, so record that limitation and decide whether more source capacity is worth its cost.`,
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Translate hits into source work',
        prompt: 'Before the core exercise, use 3000 reads per second and an 80% hit rate to calculate source reads. Explain why a high hit rate says nothing by itself about the age of a returned description.',
        hints: ['The miss fraction is one minus the hit fraction.', 'A successful cache lookup may return an old value.'],
        solution: '3000 × 0.20 = 600 source reads per second in the simplified model. Hit rate measures reuse, not freshness; source versions and update/invalidation timing are needed to reason about age.',
        checklist: ['I calculate misses with units.', 'I identify the steady-state assumption.', 'I distinguish reuse from freshness.'],
      },
      {
        id: 'stretch',
        title: 'Scale instances without scaling overload',
        prompt: 'After the original core exercise, allocate a 900-source-read/s fleet budget over six instances, then twelve instances. Describe a safe transition and the effect of skewed traffic.',
        hints: ['Divide the fixed budget, not the tested database ceiling.', 'Static equal shares can waste capacity when instances receive unequal demand.'],
        solution: 'Equal allocation gives 150 reads/s per instance at six instances and 75 at twelve. Update allocations conservatively so old and new processes do not temporarily spend more than 900 combined. Static shares are simple but underutilize spare capacity under skew; a coordinated limiter uses capacity better but becomes another dependency requiring a failure policy.',
        checklist: ['I retain the same aggregate cap.', 'I address overlapping old and new allocations.', 'I explain a skew or coordination tradeoff.'],
      },
    ],
    followUps: [
      { question: 'Does jitter reduce normal source work?', answer: 'Its main purpose is spreading expirations over time. It can smooth refill bursts without reducing the total misses caused by expiration; measure both rate and burst concentration.' },
      { question: 'Should a failed invalidation undo the committed edit?', answer: 'Usually not for this browsing contract. Record and retry invalidation, expose its failures operationally, and keep the source authoritative. Stronger atomic visibility needs a different protocol.' },
    ],
    takeaways: ['A cached copy has an explicit identity and staleness policy.', 'Protect the source with a fleet-wide fallback budget.', 'Rehearse cold-cache recovery as well as normal hits.'],
  },
  {
    id: 'design-replication-partitioning',
    track: 'system-design',
    title: 'Replication and partitioning solve different problems',
    minutes: 50,
    summary: 'Separate copies for recovery from shards for capacity, then reason about routing, skew, and migration.',
    prerequisites: ['design-databases-indexes', 'design-cache-data-flow'],
    prerequisiteNotes: 'Use the storage access pattern and source-load budget. Replication does not repair inefficient queries or remove cache-outage demand.',
    objectives: ['Distinguish replication from partitioning in storage arithmetic.', 'Choose and critique a partition key.', 'Trace routing and safe ownership transfer during a shard move.'],
    concepts: [
      {
        title: 'Copies preserve data; partitions divide ownership',
        body: `Replication copies the same records for failover and selected reads; every copy still receives writes, so write capacity does not automatically grow. Partitioning assigns different subsets to owners, distributing work but adding routing and cross-partition operations. Each partition may itself have replicas. Label logical bytes, per-copy bytes, and replicated fleet bytes separately to avoid multiplying an already replicated estimate again.`,
      },
      {
        title: 'A key chooses which work stays together',
        body: `Hashing owner_id keeps bookmarks and retry records together for local transactions and lists. Time ranges instead concentrate new writes in today's range. Hashing balances many owners but cannot split one hot owner. Secondary buckets can divide that owner's writes, at the cost of merging lists and carefully placing retry uniqueness. Add this complexity only when measured skew exceeds the original design's capacity.`,
      },
      {
        title: 'Placement requires a protocol, not just a hash',
        body: `Version the bucket-to-owner routing map to detect stale clients during migration. Copy records and capture concurrent changes through a durable stream or bounded write pause. Verify catch-up, fence the old writer, and publish the new owner. Fencing prevents writes under an expired ownership generation. Two writable copies without a conflict protocol create split-brain, not a safe handoff.`,
      },
    ],
    example: `Consider 72 GB of logical bookmark records split evenly across 4 shards with 3 full copies of each shard.
Logical records per shard: 72 / 4 = 18 GB.
Replicated records across the fleet: 18 × 4 × 3 = 216 GB.
Assume 800 peak writes/s: uniform placement gives 200 writes/s per shard.
If one owner produces 400 writes/s and the remaining 400 distribute evenly, its shard receives 500 writes/s while each other shard receives 100 writes/s. These are planning models, not guaranteed balance.`,
    walkthrough: [
      {
        title: 'One owner-scoped write reaches its replicas',
        body: `Owner O7 hashes to bucket 23, whose routing generation 8 points to shard S2. The API sends its bookmark and retry transaction to S2's leader. The leader validates its ownership and acknowledges only after the configured replication durability condition is satisfied. A follower may still lag and is not automatically safe for the immediate read-after-write journey. If the leader fails, the election and log-recovery protocol must select an eligible replacement; a router cannot safely nominate an arbitrary machine merely because it responds quickly. Separate client retry handling from database leadership recovery.`,
      },
      {
        title: 'A move encounters an old router',
        body: `Copy bucket 23 to S4 and replay changes until it catches up. Briefly fence old writes, finish the handoff, and publish generation 9. An API still using generation 8 contacts S2. S2 rejects or redirects the stale generation rather than accepting another write. The API refreshes routing and retries its same idempotency key at S4. Keep enough migration metadata and replay records for that retry to recognize any pre-handoff commit. Verify row counts and sampled content, but also verify ownership: identical copies are not safe if both can independently accept new writes.`,
      },
    ],
    task: `Design partition placement for the example workload, preserving owner-list locality and atomic retries. Draw four logical shards with three copies each and label logical versus replicated bytes. Compare owner hashing with time ranges. Trace one normal create and one request using stale routing during a bucket move. Identify the hot-owner limit using the skewed workload and propose an evidence-based response. Describe one replica-loss case and one ownership-transfer failure; do not assume these are the same failure.`,
    hints: ['A replicated shard contains copies of its subset, not the entire logical database.', 'Uniform hashing balances keys; it cannot divide a single hot key.'],
    solution: `Hash owner_id into movable logical buckets and maintain a versioned bucket map. Each shard holds about 18 GB of logical records in the idealized even case; fleet record storage remains 216 GB across three copies, excluding indexes and logs. Owner hashing keeps transactions local, whereas time ranges favor chronological deletion but concentrate new writes and scatter long-lived owner lists. The hot shard receives 400 owner writes plus 100 ordinary writes per second, or 500, not 200. First inspect skew and apply appropriate per-owner admission; consider splitting large owners only with a merge and uniqueness design. During migration, catch up changes, fence the previous generation, and redirect stale routers. Recover replica failure through the database's supported election protocol and test acknowledged-write preservation separately from routing correctness.`,
    checklist: ['I separate logical shards from full copies.', 'I calculate uniform and hot-owner load.', 'I justify locality and identify its hot-key limit.', 'I fence stale ownership and preserve idempotent retries.'],
    pitfalls: ['More replicas do not necessarily increase write throughput.', 'A hash does not divide a single owner’s load.', 'Copying bytes without transferring exclusive write ownership permits conflicting writes.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Count the right bytes',
        prompt: 'Before the core task, divide 120 GB of logical records into six equal shards with two copies each. State per-shard logical bytes and fleet bytes.',
        hints: ['Divide before multiplying copies.', 'Shard count does not create new logical records.'],
        solution: 'Each shard owns 20 GB logically. Six shards with two copies use 240 GB of record storage across the fleet, before overhead.',
        checklist: ['I label logical storage.', 'I count each copy once.', 'I exclude overhead explicitly.'],
      },
      {
        id: 'stretch',
        title: 'Split a very large owner',
        prompt: 'After the core task, propose two buckets for one hot owner. Explain how a list of 50 newest bookmarks and an idempotent create would work, including a downside.',
        hints: ['Merge ordered results rather than concatenating them.', 'The same key must always reach the same uniqueness boundary.'],
        solution: 'Route creates using a deterministic rule that also fixes replay-record placement. Fetch bounded ordered candidates from both buckets and merge by time/id, returning a cursor with each stream’s boundary. Parallel reads add fan-out and partial-failure handling; random retry routing would violate uniqueness.',
        checklist: ['I preserve retry placement.', 'I merge with a total order.', 'I explain fan-out or partial failure.'],
      },
    ],
    followUps: [
      { question: 'Is partitioning required just because records exceed memory?', answer: 'No. Databases can use disks and buffer frequently accessed pages. Measure query latency, I/O, and recovery limits before introducing distributed ownership.' },
      { question: 'Why use logical buckets rather than modulo the current shard count?', answer: 'Changing a direct modulo can move most keys. A stable bucket layer lets operators move selected subsets, though the mapping itself needs reliable distribution and versioning.' },
    ],
    takeaways: ['Replication and partitioning have different purposes.', 'Partition keys determine locality and concentrated load.', 'Safe rebalancing transfers ownership as well as bytes.'],
  },
  {
    id: 'design-consistency',
    track: 'system-design',
    title: 'Consistency: choose guarantees per operation',
    minutes: 50,
    summary: 'Use timelines to distinguish stale reads, atomic updates, and decisions that cannot tolerate overselling.',
    prerequisites: ['design-replication-partitioning'],
    prerequisiteNotes: 'Know leaders, lagging replicas, and ownership fencing. Reuse the cache lesson’s distinction between browsing and authoritative checkout.',
    objectives: ['Translate a user journey into a consistency guarantee.', 'Trace stale reads and concurrent conditional writes.', 'Explain the availability cost of coordination during a partition.'],
    concepts: [
      {
        title: 'Guarantees apply to observations',
        body: `Eventual consistency promises convergence after updates stop and communication succeeds, not a maximum lag. Read-your-writes makes subsequent session reads reflect that client's completed writes. Linearizability places each operation between invocation and response while respecting real-time order. Choose guarantees per operation: browsing may tolerate older descriptions while last-item reservation cannot tolerate competing successful sales. Name the observer and allowed anomaly first.`,
      },
      {
        title: 'Atomic conditions protect an invariant',
        body: `Two buyers can read stock one and both write zero, leaving a valid-looking counter but two promises. Atomically decrement only positive stock and transactionally store a uniquely identified reservation. Idempotency protects retries of one intent; isolation protects competing intents. Neither replaces the other. Process-local locks cannot coordinate multiple API instances, and cached stock cannot authorize the authoritative reservation.`,
      },
      {
        title: 'Partitions force an explicit response policy',
        body: `Reject or defer reservation when authoritative coordination is unreachable; browsing can remain available with stale descriptions. Accepting reservations independently would require a different bounded-allocation protocol to preserve stock. This tradeoff depends on operations and failures, not a universal two-letter slogan. Majority acknowledgements help specific replication protocols, but quorum arithmetic alone cannot prove linearizability: fencing, commit rules, and authoritative read behavior matter.`,
      },
    ],
    example: `Initially stock = 1. Clients A and B use different reservation keys.
A: atomic reserve-if-stock-positive commits reservation RA and stock = 0.
B: the same conditional operation observes stock = 0 and fails without a reservation.
A retries after losing the response: its reservation key returns RA; stock stays 0.
For three voting replicas, a majority is 2. At most one failed replica can be tolerated for progress if the other two can communicate and the protocol's leadership requirements are met.`,
    walkthrough: [
      {
        title: 'A bookmark vanishes immediately after creation',
        body: `A create commits on the leader and returns bookmark B17 with commit version 42. The next list is sent to a replica at version 40 and omits B17. No data loss has occurred, but the user journey is confusing. A session token can require reads at least through version 42, waiting within a deadline or routing to an authoritative read path. Always routing this session to the leader is simpler but adds leader load. A fixed sleep is not a guarantee because lag varies during failures. State what happens when no replica can reach the required version before the deadline.`,
      },
      {
        title: 'The isolated old leader receives a reservation',
        body: `A network partition leaves the former leader alone while the other two voters can communicate. The isolated node must not acknowledge a new reservation as committed under the majority protocol. A newly elected leader also needs the protocol's log-safety and fencing rules before serving authoritative operations. The client may see a timeout and an unknown result, so it retries the same reservation key against the recovered owner. The response can be slower or unavailable during this transition; that is preferable here to selling an item twice. Observe leadership changes and unresolved attempts instead of reporting every timeout as a definite rejection.`,
      },
    ],
    task: `Compare browsing, bookmark create-then-list, and last-item reservation by observer, allowed anomaly, authority, and unreachable-source behavior. Trace competing reservations, a lost-response retry, and a lagging bookmark read. Propose bounded read-your-writes and explain why three-voter majority arithmetic is insufficient to prove the protocol correct. Assess observable outcomes, not terminology alone.`,
    hints: ['Separate duplicate attempts from two genuinely different buyers.', 'A guarantee must specify what happens when waiting for it exceeds the deadline.'],
    solution: `Allow eventual public descriptions and keep checkout decisions outside that cache. Give bookmark creators read-your-writes using a minimum commit version with a bounded wait and authoritative fallback; on deadline expiry return a documented retryable outcome, not a falsely current list. Reserve stock in a transaction that checks positive stock, decrements once, and stores a unique reservation key. Competing buyers get at most one successful reservation when stock is one; matching retries replay the original result. Require supported authoritative reads and commits from the replication protocol, rejecting or deferring reservations when coordination is unavailable. Two of three voters can form a majority, but safe leader selection and committed-log handling remain necessary. Assess the table by its observable outcomes and failure policy rather than its terminology alone.`,
    checklist: ['I choose guarantees per operation and observer.', 'I distinguish idempotency from concurrency isolation.', 'I trace a lagging read and an atomic reservation race.', 'I define deadline and partition behavior without promising universal availability.'],
    pitfalls: ['Waiting an arbitrary second does not guarantee replica catch-up.', 'A valid final counter does not prove that only one reservation succeeded.', 'Overlapping quorum sizes alone do not specify a correct replication algorithm.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Identify an observation',
        prompt: 'Before the core task, a user edits a title successfully and immediately sees the previous title on refresh. State which session guarantee is missing and whether this alone proves data loss.',
        hints: ['The observer is the writer.', 'An old replica may still hold the earlier version.'],
        solution: 'Read-your-writes is missing for this journey. The observation does not itself prove data loss; trace commit state and the read source before deciding whether the write disappeared or the read lagged.',
        checklist: ['I name the observer.', 'I identify the missing guarantee.', 'I avoid inferring loss from one stale read.'],
      },
      {
        id: 'stretch',
        title: 'Two independent stock allocations',
        prompt: 'After the core task, could two regions each sell offline from a preallocated stock budget of five items? Explain the new invariant and limits.',
        hints: ['A bounded allocation differs from both regions sharing an unchecked counter.', 'Transfers between budgets require coordination.'],
        solution: 'With ten total items, disjoint durable budgets of five per region can allow independent sales without exceeding ten, provided each region enforces its local limit and cannot spend the other budget. A region may reject sales while the other has unused stock. Moving allocation safely requires coordinated, nonduplicating transfer and recovery rules.',
        checklist: ['I conserve total allocation.', 'I enforce local uniqueness and limits.', 'I identify stranded capacity and transfer risk.'],
      },
    ],
    followUps: [
      { question: 'Does serializable always mean linearizable?', answer: 'No. Serializable transactions correspond to some serial order. Respecting real-time order is an additional property often called strict serializability for transactions; check the actual database guarantee.' },
      { question: 'Can a stale description be correct behavior?', answer: 'Yes, if the browsing contract permits it and correctness-critical fields are validated elsewhere. Correctness means honoring the specified contract, not making every observation equally fresh.' },
    ],
    takeaways: ['Describe allowed anomalies before choosing a guarantee.', 'Retries and competing intents require different protections.', 'Strong decisions need an honest unavailability policy.'],
  },
  {
    id: 'design-queues-events',
    track: 'system-design',
    title: 'Queues and events: durable work, bounded delay',
    minutes: 50,
    summary: 'Decouple slow work without losing events, duplicating effects, or hiding a growing backlog.',
    prerequisites: ['design-consistency', 'design-api-data-model'],
    prerequisiteNotes: 'Understand atomic commit, retries, and uncertainty after a timeout. Apply those ideas to a worker rather than another HTTP attempt.',
    objectives: ['Trace an outbox event from transaction to acknowledgement.', 'Make duplicate delivery safe at the effect boundary.', 'Calculate backlog growth and drain time with explicit service-rate assumptions.'],
    concepts: [
      {
        title: 'Asynchronous changes the promise',
        body: `Asynchronous thumbnail generation makes create success mean durable bookmark plus scheduled work, not finished thumbnail. Expose pending, ready, and failed states with a bounded completion expectation and delayed-result policy. A queue absorbs temporary arrival/service imbalance but cannot fix permanent undercapacity. Backlog age and storage grow indefinitely when arrivals exceed useful completions, even while enqueue latency looks healthy.`,
      },
      {
        title: 'Use a durable handoff, not a dual-write hope',
        body: `Commit-then-publish can lose work on a crash; publish-then-commit can schedule nonexistent bookmarks. Store bookmark and outbox intent atomically. A relay publishes committed intent with a stable event identifier and records progress. Crashing between publish and progress can cause duplicate publication: expect at-least-once delivery. Monitor unpublished outbox lag separately because broker health cannot reveal a stalled relay.`,
      },
      {
        title: 'Acknowledge after the effect is safe',
        body: `Durably record results before acknowledgement to avoid lost work. A crash afterward causes redelivery, so use unique event identifiers and atomic result transitions. Local deduplication cannot eliminate uncertainty between an external email's success and local recording; use destination-supported idempotency or document duplicates. Bound retry attempts and age, apply backoff, and quarantine poison messages rather than letting them consume capacity forever.`,
      },
    ],
    example: `During a 120-second burst, arrivals are 300 jobs/s and successful worker capacity is 200 jobs/s.
Starting empty, backlog growth is (300 - 200) × 120 = 12000 jobs.
After the burst, arrivals drop to 100 jobs/s while capacity remains 200 jobs/s.
Net drain is 100 jobs/s, so the 12000-job backlog drains in 120 seconds.
This fluid estimate assumes constant service rates, no retries, no preexisting backlog, and no per-key ordering bottleneck.`,
    walkthrough: [
      {
        title: 'The relay publishes twice',
        body: `A create transaction stores B17 and outbox event E42. The relay publishes E42, then crashes before marking it sent. Its replacement publishes E42 again. Worker W1 generates the thumbnail and transactionally records the ready result under E42. Worker W2 receives the duplicate and detects the committed result, so it acknowledges without regenerating a different visible result. The queue still delivered twice, but the durable transition occurred once. Keep deduplication history at least as long as the possible redelivery/replay window, and define how manually replayed older events are handled.`,
      },
      {
        title: 'A poison event meets an overloaded queue',
        body: `Event E43 references an invalid image format. Repeated immediate retries consume capacity that could finish valid jobs. Classify the failure as permanent, persist an explanatory failed state, and quarantine the message with restricted diagnostic metadata. A transient source outage instead gets bounded retries with jitter. Monitor oldest eligible job age, successful throughput, and retry volume together: falling queue length can mean messages are failing, not that useful work is completing. If backlog delay exceeds the product bound, pause optional work or reject new jobs explicitly rather than returning an undeliverable completion promise.`,
      },
    ],
    task: `Design an asynchronous thumbnail workflow for private bookmarks. Define the user-visible create and status contract, atomic outbox transaction, relay behavior, worker effect boundary, and deduplication retention. Trace crashes before publish, after publish, and after result commit but before acknowledgement. Calculate backlog and drain time for the example burst. Describe retry classification, quarantine handling, and metrics that distinguish successful completion from merely removing messages. Keep the design conceptual and do not implement a broker or worker.`,
    hints: ['Every transition between durable systems has a crash window.', 'Drain time uses spare capacity after ongoing arrivals, not total processing capacity.'],
    solution: `Commit bookmark B17 and outbox E42 together, return a durable bookmark with thumbnail status pending, and let a monitored relay publish stable event IDs. A crash before publish leaves recoverable intent; a crash afterward can create a duplicate. Store the worker's result with an E42 uniqueness boundary before acknowledging. A repeat observes ready and safely acknowledges again. Define a bounded replay window and keep effect history through it. Quarantine permanent format errors; back off transient dependencies and cap retry age. The burst produces 12000 queued jobs and requires 120 seconds to drain once arrivals fall to 100/s with 200/s successful capacity. Measure oldest pending age, outbox lag, useful completions, and retries. If the agreed completion target cannot be met, show delayed status and reduce optional admissions rather than disguising the backlog.`,
    checklist: ['I commit durable work intent with the bookmark.', 'I trace duplicates through the actual effect boundary.', 'I compute growth and drain using net rates.', 'I define retries, quarantine, retention, and user-visible delay.'],
    pitfalls: ['A queue acknowledgement before the durable effect can lose work.', 'Exactly-once delivery claims often conceal an unprotected external effect.', 'Queue length alone cannot distinguish success from fast permanent failure.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Find spare processing capacity',
        prompt: 'Before the core task, a backlog is 600 jobs, new arrivals are 40/s, and successful capacity is 60/s. Estimate drain time and name an assumption.',
        hints: ['Ongoing arrivals consume part of capacity.', 'Use the net rate.'],
        solution: 'Spare capacity is 20 jobs/s, so 600 / 20 = 30 seconds assuming stable rates and no retries or ordering constraints.',
        checklist: ['I subtract arrivals.', 'I include seconds.', 'I state a simplifying assumption.'],
      },
      {
        id: 'stretch',
        title: 'An older edit finishes last',
        prompt: 'After the core task, two thumbnail jobs for bookmark versions 4 and 5 execute out of order. Prevent the older job from overwriting the newer result without demanding global queue ordering.',
        hints: ['Carry the source version.', 'Condition the final visible-state update, not only job startup.'],
        solution: 'Include bookmark version and event ID. At result commit, update the visible thumbnail only if the source version is still current or newer than the installed result under the chosen rule. Version 4 can complete its job record without replacing version 5. Global ordering would unnecessarily serialize unrelated bookmarks.',
        checklist: ['I carry a source version.', 'I guard the commit boundary.', 'I preserve parallelism for unrelated work.'],
      },
    ],
    followUps: [
      { question: 'Why monitor outbox lag separately from broker lag?', answer: 'Work can be durable in the database but unpublished. Broker metrics cannot see that backlog, so they can appear healthy while users wait indefinitely.' },
      { question: 'Should a quarantined message be replayed automatically forever?', answer: 'No. Diagnose the cause, repair data or code as appropriate, and replay with bounded scope while retaining event identity. Replaying blindly recreates the same failure load.' },
    ],
    takeaways: ['Asynchrony changes when success is visible.', 'Durable intent and idempotent effects close different crash windows.', 'Backlog drains only through capacity left after new arrivals.'],
  },
  {
    id: 'design-rate-limiting',
    track: 'system-design',
    title: 'Rate limiting: protect capacity and fairness',
    minutes: 45,
    summary: 'Turn a capacity boundary into an admission policy with explicit burst, distribution, and failure semantics.',
    prerequisites: ['design-cache-data-flow', 'design-queues-events'],
    prerequisiteNotes: 'Bring the fleet-wide fallback budget and the distinction between arrivals, in-flight work, and backlog.',
    objectives: ['Calculate token-bucket admission over time.', 'Separate per-owner fairness from global protection.', 'Define distributed limiter and retry failure behavior.'],
    concepts: [
      {
        title: 'An average rate needs a burst rule',
        body: `A token bucket holds at most B tokens and refills at r tokens/s. Requests spend tokens or are rejected; B bounds immediate bursts and r sustained admission. Fixed windows are simpler but permit nearly double bursts across boundaries. Sliding windows smooth that boundary with more state or approximation. Choose the resource and user contract first, including whether expensive operations spend multiple tokens.`,
      },
      {
        title: 'Fairness and source safety are different limits',
        body: `Per-owner limits cannot stop thousands of individually compliant owners overloading the database. Add fleet-level dependency admission and a concurrent-work cap. Use authenticated identity for private fairness; IP-only limits can group unrelated users behind shared networks. Bound unauthenticated limiter state separately. Decide explicitly how valid throttled demand affects availability reporting instead of hiding user failures behind healthy backend metrics.`,
      },
      {
        title: 'Distributed state has a failure contract',
        body: `Full per-instance owner buckets multiply allowance across instances. Shared atomic state tightens enforcement but adds latency and a dependency. Conservative local leases reduce coordination while stranding spare capacity. Failing open during coordinator loss risks source overload; failing closed rejects legitimate users. For cache fallback, allow only bounded emergency allocations within the source budget, preventing stale leases or scale-out from multiplying capacity.`,
      },
    ],
    example: `A per-owner token bucket has capacity 20 tokens and refill rate 5 tokens/s, initially full.
At t = 0, 25 simultaneous one-token requests admit 20 and reject 5.
At t = 2 seconds, with no intervening requests, 10 tokens have refilled.
A batch of 12 then admits 10 and rejects 2.
Immediately after that batch, one token requires 0.2 seconds to refill. If Retry-After is expressed as whole seconds, round up to 1 second; this is guidance, not a reservation.`,
    walkthrough: [
      {
        title: 'An owner request passes two gates',
        body: `Owner O7 submits a list. The API authenticates O7, checks a per-owner token bucket, and then checks admission for the source path only if a source read is needed. A cache hit need not consume the database-read budget, although it still consumes the API fairness budget. If the source gate rejects, the request must not enter a hidden database queue anyway. Decide whether a rejected second gate refunds the owner token; either policy can be defensible if implemented consistently, but refund races must not mint extra tokens. Emit a structured reason so operations can distinguish unfair demand from an exhausted dependency.`,
      },
      {
        title: 'A limiter outage meets an API scale-out',
        body: `Six instances currently have conservative source allowances totaling 900 reads/s. If the shared coordinator fails, hold those bounded grants rather than creating fresh full-size grants on six new instances. New instances can serve eligible cache hits but should not invent fallback capacity. Expiring grants require conservative clock and ownership rules so replacement grants do not overlap an old holder's spending. This sacrifices some availability and utilization to protect the database. Trace the recovery transition too: reconnecting every process must not refill every owner bucket to full simultaneously or release a synchronized flood of waiting retries.`,
      },
    ],
    task: `Specify a rate-limiting policy for bookmark list requests and public-description source fallback. Use the example owner bucket and compute both bursts. Define identity, token cost, refill behavior, response status, retry guidance, and whether rejected requests are queued. Add a global source gate and in-flight bound. Explain state placement across API instances and behavior during coordinator loss plus scale-out. Provide a request trace that distinguishes a cache hit from a source miss and discuss fairness versus utilization.`,
    hints: ['Cap accumulated tokens at bucket capacity before spending.', 'A rate gate and a concurrent-work gate constrain different quantities.'],
    solution: `Use an authenticated-owner bucket for fair API admission, with 20-token capacity and 5 tokens/s refill. The initial burst admits 20 of 25; two seconds later it admits 10 of 12. Reject excess owner demand with 429 and rounded-up Retry-After guidance; clients retry with jitter and a deadline, not immediately in lockstep. Apply a separately budgeted source gate to misses and bound in-flight source work so slower queries cannot fill memory indefinitely. A temporary source-protection failure may use a documented retryable 503 rather than misleading clients about their personal quota. Enforce fleet admission atomically or through conservative nonoverlapping allowances. During coordinator outage, retain only known bounded emergency allocations and disallow scale-out from multiplying them. Report rejected demand and gate reasons alongside successful latency.`,
    checklist: ['I compute token balances and admitted/rejected counts.', 'I distinguish owner fairness, global rate, and concurrency.', 'I specify retry behavior without an unbounded queue.', 'I explain coordinator loss and changing instance count.'],
    pitfalls: ['A per-instance limit silently grows when the service scales out.', 'Fast retries can turn controlled rejection into a retry storm.', 'Rate limiting does not by itself bound slow in-flight requests.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Discard excess refill',
        prompt: 'Before the core task, an empty bucket has capacity 8 and refill rate 2 tokens/s. After ten idle seconds, how many one-token requests can it admit immediately?',
        hints: ['Refill cannot exceed capacity.', 'Elapsed time does not create unlimited saved credit.'],
        solution: 'The bucket reaches 8 tokens after four seconds and remains at 8. It admits eight immediate requests, not twenty.',
        checklist: ['I apply the capacity cap.', 'I state the immediate burst.', 'I distinguish idle credit from sustained rate.'],
      },
      {
        id: 'stretch',
        title: 'Weight expensive operations',
        prompt: 'After the core task, give exports a cost of five tokens and lists a cost of one. Explain whether one shared owner bucket protects both fairness and database safety.',
        hints: ['A cost estimate may differ from actual work.', 'Exports may need a separate concurrency budget.'],
        solution: 'Weighted tokens can make an export consume more of the owner’s allowance, but the ratio needs measured resource costs. Large exports may hold resources much longer than lists, so use bounded export sizes and separate job/concurrency admission. A shared owner bucket still cannot replace the global dependency budget.',
        checklist: ['I explain weighted spending.', 'I connect weights to measurement.', 'I retain independent dependency protection.'],
      },
    ],
    followUps: [
      { question: 'Can Retry-After guarantee the next attempt succeeds?', answer: 'No. Other requests may spend newly available capacity before the retry arrives. It is a minimum delay recommendation, not a reserved token.' },
      { question: 'Why separate attempted from admitted rates?', answer: 'Admission can keep backend metrics healthy while legitimate users are being rejected. Attempted demand reveals unmet need and whether limits should be revised after capacity testing.' },
    ],
    takeaways: ['Specify both burst capacity and sustained rate.', 'Fairness limits do not replace global resource budgets.', 'Limiter failure and scale-out must not create capacity from nothing.'],
  },
  {
    id: 'design-reliability-observability',
    track: 'system-design',
    title: 'Reliability and observability: test the promise',
    minutes: 50,
    summary: 'Define user-visible success, budget time and errors, and connect failure signals to recovery actions.',
    prerequisites: ['design-rate-limiting', 'design-replication-partitioning'],
    prerequisiteNotes: 'Use admission, replication, and bounded retries as mechanisms. This lesson asks how you know those mechanisms actually protect users.',
    objectives: ['Define availability and latency indicators with honest denominators.', 'Budget deadlines and retry work.', 'Use traces and recovery exercises to validate failure handling.'],
    concepts: [
      {
        title: 'Measure the user journey',
        body: `Count eligible authenticated create/list requests, including dependency failures and capacity rejections as unsuccessful. Document exclusions for malformed or unauthorized attempts beforehand. Define latency boundaries including admission waits; service latency excludes client network delay. Aggregate indicators can hide affected groups, so use bounded breakdowns by operation and region. Avoid owner identifiers as unbounded metric labels and do not equate healthy processes with successful journeys.`,
      },
      {
        title: 'Deadlines are budgets, not independent timeouts',
        body: `Allocate one request deadline across authentication, cache, source, response, and margin. Propagate remaining time and safely cancel abandoned work. Independent full-length dependency timeouts can exceed the caller's entire budget. Choose one retry owner; permit only suitable failures and idempotent operations within the original deadline. Circuit breakers reduce repeated calls to failing dependencies, but probes and recovery must also remain bounded.`,
      },
      {
        title: 'Durability must survive a recovery exercise',
        body: `Recovery time objective bounds restoration time; recovery point objective bounds acceptable historical loss for a specified disaster. Replicas and backup schedules prove neither. Restore independently retained backups, replay logs, validate records and authorization, and measure elapsed time. State which failures durable acknowledgement survives, distinguishing node loss from regional disaster. Untested recovery is an unknown rather than a demonstrated guarantee.`,
      },
    ],
    example: `For 1000000 eligible requests in a reporting window and a 99.9% success objective, the budget is 1000 unsuccessful requests.
If 400 eligible requests have failed, 600 failures remain in that window's budget.
A separate time-based 99.9% objective over 30 days permits 43.2 minutes unavailable: 30 × 24 × 60 × 0.001.
Do not substitute that time budget for the request-based budget when traffic varies.
Illustrative 300 ms service budget: authentication 20 ms + cache 10 ms + source 180 ms + response 30 ms + margin 60 ms.`,
    walkthrough: [
      {
        title: 'Follow one slow list with a trace',
        body: `A valid list gets a correlation identifier, spends 18 ms authenticating, and times out its cache lookup after 10 ms. The source gate admits it, but a database span reveals 170 ms of execution and 40 ms waiting for a connection. That wait must count against the request deadline; hiding it outside the span makes the database look fast while users time out. Record outcome, operation, bounded error category, and timings without logging bookmark URLs or titles. Trace sampling should retain useful failures while respecting privacy and storage limits. Compare traces with rate and saturation metrics rather than diagnosing from one slow example alone.`,
      },
      {
        title: 'Turn an alert into a recovery action',
        body: `A cache outage raises source admission rejections while database latency remains bounded. This is successful containment but degraded user availability, not complete health. Alert on error-budget consumption and valid rejected demand, then follow a runbook that confirms source headroom, checks cache connectivity, and restores cache gradually. During a database failover exercise, verify that successful create responses remain readable afterward and retry keys still replay the same identifiers. Measure recovery duration and lost or ambiguous outcomes. A dashboard is useful only when each signal supports a decision, an owner, and a next diagnostic step.`,
      },
    ],
    task: `Define bookmark create/list eligibility, success, latency boundaries, and the example 99.9% error budget. Allocate 300 ms without double-spending and decide whether retry fits. Select demand, error, latency, and saturation signals plus a trace. Design cache-outage and recovery exercises with pass/stop conditions. Distinguish containment from user availability.`,
    hints: ['A rejected valid request still represents an unsuccessful user journey under this exercise’s definition.', 'Include pool waiting and retry attempts in the same elapsed-time budget.'],
    solution: `Count valid authenticated create/list attempts at the defined service boundary and include dependency errors and capacity shedding as failures. One million eligible requests allow 1000 failures; after 400, 600 remain. Track attempts and outcome categories, end-to-end tail latency including waits, source saturation, and outbox or cache-fallback backlog as appropriate. Allocate 20/10/180/30/60 ms to authentication/cache/source/response/margin; a second full 180 ms source attempt does not fit after the first consumes its allocation. Prefer a fast documented failure unless a safe retry fits the remaining deadline. Rehearse cache loss under load and verify the source cap, then rehearse failover and restore while checking acknowledged writes and replay behavior. Stop the exercise if isolation fails or the agreed error ceiling is reached; record measured recovery gaps rather than asserting that replicas solved them.`,
    checklist: ['I define the indicator denominator and unsuccessful outcomes.', 'I distinguish request and time availability budgets.', 'I allocate one deadline including waits and attempts.', 'I connect signals to recovery actions and measurable exercises.'],
    pitfalls: ['Dropping throttled valid demand from reports can conceal an outage.', 'Independent full-duration retries at several layers multiply load and latency.', 'A backup that has never been restored is unverified recovery evidence.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Spend a request budget',
        prompt: 'Before the core task, compute the failed-request allowance for 200000 eligible requests at 99.5% success. Does that number reveal how many minutes an outage may last?',
        hints: ['Multiply by the unsuccessful fraction.', 'Request volume can vary by minute.'],
        solution: '200000 × 0.005 = 1000 failures. Without a traffic distribution or separate time-based definition, this does not establish a fixed outage duration.',
        checklist: ['I use the failure fraction.', 'I preserve request units.', 'I avoid converting to minutes without assumptions.'],
      },
      {
        id: 'stretch',
        title: 'A hidden retry multiplier',
        prompt: 'After the core task, suppose the client makes two attempts, the API makes two dependency attempts per client attempt, and a proxy makes two attempts per dependency call. Calculate worst-case source attempts and propose one retry owner.',
        hints: ['Multiply nested attempts, including originals.', 'Keep idempotency and one deadline across retries.'],
        solution: '2 × 2 × 2 = 8 source attempts per logical request. Give one layer an explicitly bounded retry policy and disable overlapping retries elsewhere; propagate the deadline and request identity. Actual safe attempt count depends on remaining time and dependency load.',
        checklist: ['I compute the multiplicative bound.', 'I nominate one retry owner.', 'I retain deadline and identity constraints.'],
      },
    ],
    followUps: [
      { question: 'Can individual component p95 values simply be added?', answer: 'Not to obtain an exact end-to-end p95; percentile observations need not occur on the same requests. Use allocation as a planning tool and measure the end-to-end distribution directly.' },
      { question: 'Why set stop conditions for a failure exercise?', answer: 'Testing should be bounded and reversible. Stop conditions limit harm, prevent unrelated failures from being mistaken for the scenario, and make recovery ownership explicit.' },
    ],
    takeaways: ['An objective needs an honest measurement boundary.', 'Retries spend the same latency and capacity budgets as original attempts.', 'Recovery confidence comes from measured, bounded rehearsals.'],
  },
  {
    id: 'design-end-to-end-bookmarks',
    track: 'system-design',
    title: 'End-to-end design: a bounded bookmark service',
    minutes: 55,
    summary: 'Synthesize an architecture from a small set of user needs, then defend it with request traces, numbers, and failure drills.',
    prerequisites: ['design-api-data-model', 'design-databases-indexes', 'design-cache-data-flow', 'design-replication-partitioning', 'design-consistency', 'design-queues-events', 'design-rate-limiting', 'design-reliability-observability'],
    prerequisiteNotes: 'Complete the earlier design exercises. Reuse their reasoning, but do not add a component unless this particular service has a requirement that needs it.',
    objectives: ['Derive an architecture from bounded user and workload needs.', 'Connect data, request, and recovery paths without contradictory guarantees.', 'Defend omissions and identify measurement-based evolution triggers.'],
    concepts: [
      {
        title: 'Scope creates the architecture',
        body: `Serve 200000 daily users making two creates and twenty lists each. Retain 1000-byte records for 180 days; cap pages at 50. Exclude sharing, search, offline edits, recommendations, and webpage fetching. Target p95 service list latency below 300 ms at tenfold average peak, 99.9% monthly eligible-request success, and acknowledged-write survival through one database-node loss. Regional disaster recovery remains a separate requirement, not a consequence of local replication.`,
      },
      {
        title: 'Choose the smallest justified data path',
        body: `Start with stateless authenticated APIs and a transactional owner/time/id-indexed database with supported failover. Atomically store bookmarks and owner-scoped replay mappings. Direct indexed reads are a baseline to test, not assumed proof of capacity. Add caching only for a measured bottleneck with identity, freshness, and fallback policies. Excluding thumbnail fetching avoids unnecessary worker infrastructure; the current workload alone justifies neither sharding nor a broker.`,
      },
      {
        title: 'Evolution is a decision with a trigger',
        body: `Use measured saturation, recovery duration, and tail latency as review triggers. Inspect query plans and page sizes before adding caches. Owner admission may address skew that ordinary sharding cannot. Introducing asynchronous features requires durable intent, bounded workers, and a completion contract together. Preserve assumptions, rejected alternatives, and evidence that would reverse a decision so maintainers can evolve the baseline deliberately.`,
      },
    ],
    example: `Daily reads = 200000 × 20 = 4000000; daily writes = 200000 × 2 = 400000.
Peak reads = 4000000 / 86400 × 10 ≈ 463 requests/s.
Peak writes = 400000 / 86400 × 10 ≈ 46.3 requests/s.
Records retained = 400000 × 180 = 72000000.
At 1000 bytes/record plus one assumed 64-byte index entry, three full copies require 229.824 decimal GB before logs, retry records, backups, and headroom.
Architecture: client → authenticated bounded API → transactional indexed database with replicated durability; independently retained backups support tested restoration.`,
    walkthrough: [
      {
        title: 'Create, lose the response, then list',
        body: `Owner O7 sends URL/title with K9. Authenticate, validate bounds, apply owner/source admission, and atomically commit B17 plus replay metadata under the durable replication policy. A lost response leads to a same-body K9 retry returning B17, not B18. List through an authoritative or minimum-version read-your-writes path with an owner/time/id cursor and 50-row bound. Propagate one remaining deadline; cursor and replay lookups never bypass authorization.`,
      },
      {
        title: 'Lose a node while retention runs',
        body: `During mixed load and cleanup, lose one database node. Let supported failover restore an eligible leader; APIs reject or retry within deadlines. Verify acknowledged identifiers and replay records afterward. Pause cleanup if foreground latency or lag worsens; alert on retention backlog. Separately restore backups and validate records and ownership. Count valid failed attempts even when shedding prevented cascading failure. Passing only with every node healthy means recovery headroom remains unproven.`,
      },
    ],
    task: `Produce a brief covering scope, targets, arithmetic, API/schema, two requests, and one failure timeline. Explain authorization, pagination, replay retention, read-your-writes, durable acknowledgement, admission, and recovery. Justify included and omitted components, especially cache, shards, and queues. Validate mixed peak load, owner skew, retention, and node loss. Use the rubric, not an automated architecture grade.`,
    hints: ['Reuse earlier calculations, but carry every excluded byte category into the final brief.', 'A component earns its place by satisfying an explicit requirement or measured bottleneck.'],
    solution: `Use an authenticated bounded API, owner-indexed transactional database with supported three-copy durability/failover, and independently restorable backups. Plan 463 peak lists/s, 46.3 creates/s, and 229.824 GB of replicated records/index before overhead. Preserve 24-hour owner-scoped replay and authoritative or minimum-version immediate reads. Benchmark without cache, shards, or workers initially. Keep rate and concurrency admission below measured mixed-workload saturation with recovery headroom; count valid rejection as failure. Verify lost-response retries and node loss preserve acknowledged identifiers without duplicates. Leave disaster recovery targets unresolved until requirements and rehearsals support them. Alternatives must satisfy the same contract and justify their operational cost.`,
    checklist: ['I connect every component to a scoped need or evidence.', 'I show rates and replicated indexed storage with units and exclusions.', 'I preserve ownership, replay, pagination, and read-your-writes across traces.', 'I specify durable acknowledgement and honest failure outcomes.', 'I propose measurable load and recovery experiments and name unresolved targets.'],
    pitfalls: ['A catalog of technologies is not an explanation of one request.', 'Adding optional features changes capacity, security, and recovery scope.', 'Passing a steady-state benchmark does not establish behavior during node loss.'],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Remove a box',
        prompt: 'Before the core brief, someone adds a queue between the API and every bookmark insert. Explain which original acknowledgement promise would change and whether this is necessary.',
        hints: ['Queued acceptance and a durable bookmark are different states.', 'No slow optional work is required by the current scope.'],
        solution: 'Returning after enqueue promises only durable intent if the queue supports it, not a committed bookmark ready for immediate listing. Keeping synchronous transactional creation avoids introducing pending-state and queue-recovery contracts without a demonstrated need.',
        checklist: ['I identify the changed promise.', 'I connect the decision to scope.', 'I avoid adding asynchronous complexity without evidence.'],
      },
      {
        id: 'stretch',
        title: 'Introduce one feature deliberately',
        prompt: 'After the core brief, add an optional daily export with a five-minute completion target. Describe only the necessary architecture changes, capacity questions, and failure semantics.',
        hints: ['Separate export acceptance from completion.', 'Bound record count and concurrent export work so lists remain protected.'],
        solution: 'Add durable export intent through an outbox, a bounded worker pool, owner-authorized status/download access, and expiring output storage. Estimate arrival bursts, records and bytes per export, successful worker throughput, and output retention before committing to five minutes. Use stable job identity and retry-safe publication, monitor oldest pending age, and shed or delay optional exports when foreground capacity is threatened.',
        checklist: ['I add an explicit asynchronous status contract.', 'I estimate new workload and retention rather than reusing list QPS.', 'I protect foreground work and owner access.'],
      },
    ],
    followUps: [
      { question: 'What would make this initial design unacceptable?', answer: 'Measured failure to meet peak latency, node-loss durability, recovery, or owner-isolation requirements. The number of boxes is not a quality criterion; failing an explicit contract is.' },
      { question: 'What belongs in a handoff besides the diagram?', answer: 'Assumptions, calculations, request/race timelines, data invariants, operational indicators, recovery procedures, rejected alternatives, and open validation questions so another engineer can challenge and evolve the design.' },
    ],
    takeaways: ['Synthesize by tracing requirements through decisions, not by collecting components.', 'A simple baseline is valid only when its assumptions are tested.', 'Keep unknowns and evolution triggers explicit alongside the architecture.'],
  },
]
