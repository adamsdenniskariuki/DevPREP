import type { Lesson } from '../curriculum-types'
import { starterLessons } from './starter'

function originalLesson(id: string) {
  const lesson = starterLessons.find((candidate) => candidate.id === id)
  if (!lesson) throw new Error(`Missing original behavioral lesson: ${id}`)
  return lesson
}

const star = originalLesson('behavioral-star-evidence')
const conflict = originalLesson('behavioral-tradeoffs-conflict')

export const behavioralLessons: Lesson[] = [
  {
    ...star,
    minutes: 35,
    prerequisites: [],
    prerequisiteNotes: 'Start here. Real school, community, or personal-project experience is sufficient.',
    concepts: [
      ...star.concepts,
      {
        title: 'Build an evidence ledger before polishing',
        body: 'List what you remember, what you can verify, and what remains uncertain. Checklist adoption does not prove time saved. Describe supporting evidence without retrieving confidential documents or identifying people. If you cannot remember a number, omit it rather than repairing the story with a plausible invention.',
      },
      {
        title: 'Prepare a flexible account, not a performance',
        body: 'Practice a headline and a two-minute account with consistent responsibility and uncertainty. Questions about initiative and learning need different emphasis, not different facts. If interrupted, answer directly instead of restarting a script. A modest story you can examine honestly beats an impressive story you cannot defend.',
      },
    ],
    walkthrough: [
      {
        title: 'Select and bound the event',
        body: 'Choose one real incident, not an entire role. Write the before state, responsibility, and observable change. The fictional signup example demonstrates adoption, not proof that errors disappeared forever. Substitute your own experience; you may anonymize roles and systems while explicitly noting that details are generalized.',
      },
      {
        title: 'Rehearse, then inspect the evidence',
        body: 'Read your draft aloud. Ask a partner to identify your responsibility and one decision’s reason. Review results as supported, uncertain, or missing evidence: revision signals, not grades. Revise one unsupported claim. Reflect on what you would repeat, change, and what information you lacked at the time.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Replace an adjective with an action',
        prompt: 'Rewrite a true “I was proactive” claim as an action, reason, and evidence boundary.',
        hints: ['Name something you actually initiated.', 'Do not invent a result.'],
        solution: 'Fictional illustration: “I asked how changes reached volunteers to understand the handoff. We produced a checklist but did not measure time saved.” Substitute only actions you actually took.',
        checklist: ['The action is observable.', 'The reason explains the choice.', 'The evidence limit is explicit.'],
      },
      {
        id: 'stretch',
        title: 'Answer an interruption without changing facts',
        prompt: 'Pause your real account. Answer “How do you know that helped?” in two sentences, then resume.',
        hints: ['Separate observation from causation.', 'Admit limited evidence.'],
        solution: 'Fictional illustration: “The next integration had no reported format rework. The checklist may have helped, but we also reviewed examples together.” Do not strengthen an unverified claim.',
        checklist: ['The answer addresses evidence directly.', 'Alternative explanations remain possible.', 'The resumed account preserves the original facts.'],
      },
    ],
    followUps: [
      { question: 'What if my result was small?', answer: 'Explain its local importance and your learning without inflating scope.' },
      { question: 'What if I cannot share the artifact?', answer: 'Describe its purpose without sharing contents. Offer a clearly labeled non-sensitive analogy.' },
    ],
    takeaways: [
      'Build from evidence before polishing.',
      'Preserve facts and uncertainty across versions.',
      'Use reflection to revise, not grade.',
    ],
  },
  {
    id: 'behavioral-ownership-impact',
    track: 'behavioral',
    title: 'Ownership: connect your decisions to bounded impact',
    minutes: 40,
    summary: 'Explain your responsibility, judgment, and evidence without claiming the whole team’s work.',
    prerequisites: ['behavioral-star-evidence'],
    prerequisiteNotes: 'Bring a truthful STAR draft to examine responsibility and results.',
    objectives: [
      'Separate assigned responsibility, chosen initiative, and accountable decision authority.',
      'Explain impact using a baseline, an observation, and appropriate causal limits.',
      'Credit collaborators and describe a sustainable handoff.',
    ],
    concepts: [
      {
        title: 'Ownership is a responsibility boundary',
        body: 'Ownership does not require doing everything yourself or having a management title. Describe what you were accountable for, what you could decide, and where you needed approval. Initiative can mean noticing an unowned problem and proposing a responsible owner, not silently expanding your authority. An interview answer becomes clearer when the listener can distinguish your investigation from another person’s approval and the team’s implementation. Include a handoff if responsibility later moved.',
      },
      {
        title: 'Impact requires an evidence chain',
        body: 'Connect the initial problem to your action and then to an observed outcome. A baseline might be a recurring complaint or a documented failure, not necessarily a dashboard. Explain the observation window and what was not measured. Adoption, a corrected assumption, or a decision to stop wasteful work can be meaningful results. Correlation alone does not establish that your action caused improvement; describe competing changes rather than hiding them behind a confident percentage.',
      },
      {
        title: 'Sustainable ownership includes other people',
        body: 'A rescue that depends on you remaining permanently available may leave the system fragile. Discuss documentation, an agreed owner, support boundaries, and whether anyone could continue the work. Give collaborators credit for their actual contributions. Do not reinterpret asking for help as weakness: explain why expertise or authority was needed and what you did with the guidance. Confidentiality still applies to evidence; summarize the mechanism rather than exposing internal dashboards or customer details.',
      },
    ],
    example: 'Fictional illustration: A community workshop kept losing track of equipment returns. One volunteer investigated the handoff and proposed a return checklist; the coordinator approved it, and other volunteers tested it. The credible ownership claim is the investigation and trial, not sole responsibility for the workshop’s success. Adapt only the structure to your own real experience.',
    task: 'Choose a real project and draft a 200-to-280-word ownership answer. State your responsibility, one decision you could make, one boundary requiring another person, two actions, and the observed result. Add a private evidence ledger with “known,” “uncertain,” and “not measured” entries. Finish with how ownership continued after your involvement. If you lack a matching experience, label the entire rehearsal fictional. Do not submit confidential artifacts or invent measurements to fill gaps.',
    hints: [
      'Use “I investigated; the coordinator approved; we tested” to expose distinct contributions.',
      'For every impact claim, ask what observation supports it and what alternative explanation remains.',
    ],
    solution: `Fictional rehearsal, not personal history:
At a community workshop, returned equipment sometimes remained in an unlabeled box. I volunteered to investigate the return process, while the coordinator retained authority over equipment policy.
I watched a closing handoff with permission and asked two volunteers where they recorded missing parts. Their descriptions differed. I drafted a checklist showing the item, missing parts, and next owner, then asked the coordinator to approve a trial rather than introducing a rule myself. I chose a paper checklist because the closing team already worked beside the storage cabinet.
Other volunteers tested the wording and identified a category I had missed. During the next workshop, the closing team completed the checklist and the coordinator could identify which items needed attention. We did not count previous losses reliably, so I cannot claim a reduction in losses or costs.
I handed the checklist to the closing coordinator and agreed that they would update it when equipment changed. My contribution was discovering the handoff gap and organizing the trial; the team supplied operational knowledge and made the process usable. Next time I would agree on a lightweight baseline before the trial.
For your own answer, substitute only true responsibilities, actions, and observations. A narrower supported outcome is sufficient.`,
    checklist: [
      'My responsibility and decision authority are distinguishable.',
      'I connect at least two actions to the problem they addressed.',
      'I state an observed result and a measurement or attribution limit.',
      'I credit collaborators and explain the handoff.',
    ],
    pitfalls: [
      'Claiming an entire project’s impact because you contributed one component.',
      'Equating long hours or constant availability with sustainable ownership.',
      'Presenting an estimate, hoped-for benefit, or team metric as personal proven impact.',
    ],
    walkthrough: [
      {
        title: 'Draw the responsibility map',
        body: 'Write four labels: my responsibility, my decisions, others’ contributions, and final authority. Populate each with facts from one event. If two labels overlap, explain the overlap rather than manufacturing a clean division. Convert the map into a short opening that makes your scope understandable without revealing company hierarchy or confidential names.',
      },
      {
        title: 'Review claims and handoff',
        body: 'Underline each outcome claim in your draft and attach the observation that supports it. Mark unsupported causal language for revision. Ask a listener what would happen if you left the project; if the answer is unclear, add the actual handoff or acknowledge that it was missing. Reflect on what you would do differently, without pretending you did it then.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Split a shared achievement',
        prompt: 'Rewrite “I delivered the whole project” into three accurate contribution statements from a real experience.',
        hints: ['Separate your work from approval.', 'Name another contribution that changed the outcome.'],
        solution: 'Fictional illustration: “I drafted the return process. The coordinator authorized a trial. Volunteers corrected the categories.” This establishes agency without erasing the team.',
        checklist: ['Personal scope is clear.', 'Authority is accurate.', 'Team credit is specific.'],
      },
      {
        id: 'stretch',
        title: 'Defend an impact claim without metrics',
        prompt: 'Answer “What measurable difference did you make?” when your real project has no trustworthy quantitative baseline.',
        hints: ['Say explicitly what was not measured.', 'Offer a bounded observation, not an invented substitute number.'],
        solution: 'Fictional illustration: “We did not measure losses consistently. The trial did produce a completed handoff record that the coordinator used to assign follow-up.” Explain that this demonstrates usability, not proven savings.',
        checklist: ['The measurement gap is admitted.', 'The observation is concrete.', 'The conclusion stays within the evidence.'],
      },
    ],
    followUps: [
      { question: 'What would have happened without you?', answer: 'Distinguish a plausible counterfactual from an observed fact. Explain the gap you addressed, but acknowledge that someone else might have addressed it differently.' },
      { question: 'Where did you overstep or fail to take ownership?', answer: 'Name a genuine boundary mistake, its consequence, and the adjustment you actually made. Avoid inventing a harmless weakness just to complete the story.' },
    ],
    takeaways: [
      'Ownership is explicit responsibility and judgment, not solitary heroics.',
      'Describe impact at the strength the evidence supports.',
      'A credible handoff can demonstrate more ownership than permanent dependence on you.',
    ],
  },
  {
    ...conflict,
    minutes: 40,
    prerequisites: ['behavioral-ownership-impact'],
    prerequisiteNotes: 'Distinguish your recommendation from the accountable person’s decision. The original scenario remains hypothetical.',
    concepts: [
      ...conflict.concepts,
      {
        title: 'Steelman before advocating',
        body: 'Restate the strongest legitimate argument for the opposing option and check your understanding. This prevents a false comparison where your option gets only benefits and theirs only costs. Distinguish what a colleague actually said from your interpretation; do not invent private motives or pretend that understanding requires agreement.',
      },
      {
        title: 'Separate ordinary disagreement from protected concerns',
        body: 'Maintainability preferences can often use a decision owner and review trigger. Unmet accessibility requirements, unsafe releases, or integrity issues may need another escalation route. Explain the concern without names or private allegations. Collaboration does not require silent acceptance or disclosure of confidential investigations; choose another example if necessary.',
      },
    ],
    walkthrough: [
      {
        title: 'Make the investigation decision-relevant',
        body: 'In the ten-day scenario, one investigation day can expose integration risks, not prove an entire migration safe. Write the decision question first. Reserve remaining time for implementation, integration, testing, and rollback readiness. Keep estimates uncertain: three implementation days do not guarantee seven spare days.',
      },
      {
        title: 'Inspect your behavior after the decision',
        body: 'Rehearse losing the decision: name one constructive action and one review trigger. Reflect using fair representation, criteria, evidence, accountability, and follow-through. Mark missing examples rather than assigning a score. In a real story, distinguish a review that happened from a checkpoint merely planned.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'State the opposing case fairly',
        prompt: 'Explain a reasonable teammate’s preference for rebuilding in two sentences.',
        hints: ['Identify a maintenance cost.', 'Potential benefits need evidence.'],
        solution: 'Hypothetical illustration: “Repeated extensions may complicate future forms. A replacement could help, but accessibility and integration need checking before this release.” Acknowledge the concern without promising results.',
        checklist: ['The concern is legitimate.', 'No motive is assigned.', 'Uncertainty remains explicit.'],
      },
      {
        id: 'stretch',
        title: 'Support a decision and retain a blocker',
        prompt: 'The hypothetical lead chooses rebuilding. Explain your response if duplicate registrations remain possible.',
        hints: ['Help execute legitimate decisions.', 'Distinguish preference from requirements.'],
        solution: 'Hypothetical illustration: “I would help test registration and surface the server-side uniqueness risk. If unmet, I would raise a release blocker with the lead.” This describes intent, not an achieved outcome.',
        checklist: ['Support is concrete.', 'The blocker concerns a requirement.', 'The escalation has an accountable recipient.'],
      },
    ],
    followUps: [
      { question: 'What if the owner refuses another experiment?', answer: 'Summarize evidence, risk, and a recommendation. Request a decision and review trigger, not an unauthorized investigation.' },
      { question: 'What evidence would change your recommendation?', answer: 'Name a shared criterion, such as demonstrated integration readiness. Saying “nothing” makes the investigation performative.' },
    ],
    takeaways: [
      'Fairly representing goals demonstrates collaboration.',
      'Investigate a bounded decision, not everything.',
      'Support decisions while retaining genuine blockers.',
    ],
  },
  {
    id: 'behavioral-failure-learning',
    track: 'behavioral',
    title: 'Failure: explain accountability and changed behavior',
    minutes: 40,
    summary: 'Discuss a real mistake with proportionate accountability, a bounded recovery, and evidence that your working method changed.',
    prerequisites: ['behavioral-tradeoffs-conflict'],
    prerequisiteNotes: 'Use fair descriptions of others and explicit responsibility boundaries. Choose a shareable experience, not a confidential incident you feel pressured to disclose.',
    objectives: [
      'Distinguish your mistake from external conditions without shifting blame.',
      'Separate immediate recovery from prevention and demonstrated learning.',
      'Discuss unresolved consequences without manufacturing a redemption ending.',
    ],
    concepts: [
      {
        title: 'Accountability is specific, not theatrical',
        body: 'Name the decision or omission you controlled and its consequence. Avoid blame shifting or claiming responsibility for everything. A mistaken assumption or missed handoff is sufficient; you need neither catastrophe nor humiliating confession. Choose an experience you can discuss respectfully and safely, including anonymized school or community examples.',
      },
      {
        title: 'Recovery and learning answer different questions',
        body: 'Recovery asks how you limited harm and communicated the current state. Prevention asks what changed in the process. Learning asks whether later behavior demonstrates that change. “I learned to communicate” is too broad unless you identify a new practice, when you used it, and what you observed. If you have not had another opportunity, say the practice is planned or untested rather than inventing a successful second project.',
      },
      {
        title: 'Explain hindsight without rewriting history',
        body: 'Separate what was knowable then from what became clear later. Explain why your choice seemed reasonable and which signal you missed. Context does not excuse the mistake. Preserve uncertainty and costs, including others’ recovery work. An honest account can end with a limited repair and a changed rule rather than a dramatic victory.',
      },
    ],
    example: 'Fictional illustration: A student assumed every teammate used the same timestamp convention. Their integration rejected valid records during rehearsal. They acknowledged the assumption, coordinated a short-term conversion, and later added an explicit data-contract check. This is an illustration of accountability, not an experience or accomplishment to claim as your own.',
    task: 'Draft a 200-to-280-word answer about a real mistake: expectation, your controllable decision, consequence, recovery, and changed practice. Include what you knew at the time and what you learned later. Identify whether the changed practice has actually been tested. Prepare a short answer to “Who was affected?” without names or sensitive details. If practicing fiction, label it throughout. Use the rubric to find omissions, not to rank the severity of your failure.',
    hints: [
      'Replace “things went wrong” with the particular assumption or action you owned.',
      'Separate “I now plan to check” from “I later checked”; only the latter claims demonstrated follow-through.',
    ],
    solution: `Fictional rehearsal only:
In a student project, I owned the import step that combined our sample datasets. I assumed timestamps used the same timezone because the examples looked similar, and I did not ask the team to agree on the convention.
During a rehearsal, some valid records appeared outside the expected date range. The team could not use that part of the demo as planned. I explained my assumption and asked a teammate to help inspect the source formats rather than blaming their data.
We agreed on a convention, and I added a conversion for the affected sample input. I also documented which records we had checked so we would not imply that all possible inputs were covered. Another teammate adjusted the demo while we worked, and that contribution mattered to recovery.
Before the next integration, I wrote down the timestamp contract and checked a boundary example with each contributor. That check exposed another mismatch before the rehearsal. This suggests the practice helped catch a specific issue; it does not prove our importer became defect-free.
I would now agree on data conventions before implementation rather than inferring them from a few examples. The immediate repair restored the sample flow, but the original disruption still happened.
Adapt this structure only to events you actually experienced; keep untested improvements labeled as plans.`,
    checklist: [
      'I identify a decision or omission within my control.',
      'I describe the consequence without exaggeration or blame.',
      'I separate recovery, changed practice, and evidence of learning.',
      'I preserve unresolved costs and label plans as plans.',
    ],
    pitfalls: [
      'Choosing a disguised strength such as caring too much instead of examining a decision.',
      'Making colleagues responsible for your assumption or taking credit for their recovery work.',
      'Claiming a failure never recurred without a relevant observation period.',
    ],
    walkthrough: [
      {
        title: 'Construct the timeline without hindsight',
        body: 'Write what you expected, the evidence available then, the first contradictory signal, and your response. Circle the point where you had agency. If the story assigns you no decision, select another event or clarify your actual contribution. Keep sensitive incident details out; the timeline can describe roles and decision types rather than identities.',
      },
      {
        title: 'Test the learning claim',
        body: 'Ask whether a listener could recognize the new behavior in a later situation. “Be more careful” fails that test; “agree on the timestamp contract before integration” is observable. Review accountability, consequence, repair, and follow-through as supported or needing detail. End by considering when your new rule might be unnecessary or insufficient, so learning does not become another rigid assumption.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Turn regret into a practice',
        prompt: 'Rewrite one real lesson beginning “I should have communicated better” as a trigger, action, and check.',
        hints: ['Identify when the action should happen.', 'Choose a check someone could observe.'],
        solution: 'Fictional illustration: “Before integration, I ask contributors to confirm the timestamp convention and review one boundary example together.” It names a repeatable practice rather than a personality trait.',
        checklist: ['A trigger is named.', 'The action is concrete.', 'The check is observable.'],
      },
      {
        id: 'stretch',
        title: 'Explain incomplete recovery',
        prompt: 'Rehearse a truthful answer when the damage could not be fully undone or the improvement has not yet been tested.',
        hints: ['Do not invent a later success.', 'Separate what you repaired from what remained lost.'],
        solution: 'Fictional illustration: “We restored the sample import, but lost rehearsal time. I documented a pre-integration check; we have not yet used it on another project.” The unresolved outcome stays visible.',
        checklist: ['The remaining cost is explicit.', 'Completed actions differ from plans.', 'No redemption outcome is invented.'],
      },
    ],
    followUps: [
      { question: 'Why did you not notice sooner?', answer: 'Explain the evidence you relied on and the check you omitted. Acknowledge a missed signal if there was one, without claiming that hindsight made the outcome obvious beforehand.' },
      { question: 'How do you know you learned rather than just got lucky?', answer: 'Describe a later use of the changed practice and the specific signal it exposed. If there is no later use, acknowledge that limitation and explain how you would evaluate it.' },
    ],
    takeaways: [
      'Own the controllable decision, not every surrounding condition.',
      'Learning is a changed practice whose evidence may still be incomplete.',
      'An honest unresolved ending is better than a manufactured comeback.',
    ],
  },
  {
    id: 'behavioral-ambiguity-prioritization',
    track: 'behavioral',
    title: 'Ambiguity: prioritize with explicit assumptions',
    minutes: 45,
    summary: 'Bound an unclear request, compare priorities, and explain when to change course.',
    prerequisites: ['behavioral-failure-learning'],
    prerequisiteNotes: 'Distinguish facts from assumptions while practicing prospective judgment.',
    objectives: [
      'Clarify the user, desired outcome, constraints, and decision owner.',
      'Choose a priority using consequence, urgency, effort, and uncertainty.',
      'Define a bounded investigation and a trigger for revisiting the plan.',
    ],
    concepts: [
      {
        title: 'Reduce the uncertainty that changes the decision',
        body: 'Ask who needs the outcome, what failure matters, which constraints are fixed, and who resolves competing goals. Separate facts, assumptions, and open questions. Prioritize questions that could change the next action. A small reversible step may be appropriate despite low-impact uncertainty; safety or privacy uncertainty may require stopping and seeking qualified guidance.',
      },
      {
        title: 'Prioritization includes saying what waits',
        body: 'Compare options using a few explicit criteria rather than a hidden intuition or decorative scoring formula. Urgency is not identical to importance, and an easy task is not automatically valuable. State dependencies and minimum acceptable quality before trading scope. Explain which work you would defer and the consequence of deferral. If everything is mandatory, surface the capacity conflict to the decision owner instead of promising impossible delivery or quietly sacrificing required checks.',
      },
      {
        title: 'A plan needs an expiry condition',
        body: 'Record the assumption behind your next step, a time limit, and evidence that would change it. Avoid endless analysis and stubborn commitment to obsolete plans. Make review triggers observable: an unmet requirement, slipped dependency, or unexpected failure mode. Distinguish hypothetical plans from actual outcomes and explain your authority to reprioritize.',
      },
    ],
    example: 'Fictional scenario: A community club says its event page is “not working” two days before registration closes. Possible work includes fixing the submission flow, rewriting confusing instructions, or redesigning the page. You have one afternoon and no verified failure data. A reasonable first step is to establish whether people can complete registration, not assume a redesign addresses the complaint.',
    task: 'Using the explicitly fictional club scenario, draft a 200-to-280-word plan. Ask three decision-relevant questions, state one provisional assumption, compare at least two priorities, and explain what you would defer. Time-box an investigation and identify the accountable event organizer. Include a stop or escalation condition and a review trigger. Then map the structure to a real ambiguous request if available, preserving actual actions and outcomes rather than borrowing the fictional ones.',
    hints: [
      'Check required completion and accessibility before treating appearance as the main problem.',
      'Explain how a different answer to one question would change the next action.',
    ],
    solution: `Hypothetical illustration, not a claimed accomplishment:
I would ask the organizer who is failing to register, what they observe, and whether the closing date is fixed. I would ask for a privacy-safe description rather than copying personal registration records. My provisional assumption would be that successful accessible submission matters more than visual polish, pending the organizer’s confirmation.
I would compare repairing a blocked submission with clarifying confusing instructions. A broken completion path has an immediate consequence for participation; wording may matter more if the flow works but people misunderstand eligibility. I would defer a broad redesign because we have little evidence that it addresses either problem.
With the organizer’s agreement, I would spend the first thirty minutes reproducing one representative flow and checking whether the reported obstacle is functional or informational. That investigation would guide the afternoon’s work rather than becoming an open-ended audit.
If the failure requires authority or expertise I lack, I would surface it immediately and ask the organizer to choose a safe alternative or change the plan. I would not bypass privacy or accessibility requirements to meet the deadline.
Before publishing a change, I would verify the affected flow and report what remains unchecked. If the initial reproduction changes our understanding, I would revisit the priority with the organizer. No improvement in registrations can be claimed before observing the actual result.`,
    checklist: [
      'My questions could change the decision rather than merely add background.',
      'I label assumptions and identify a decision owner.',
      'I compare priorities and name deferred work with its consequence.',
      'I bound investigation and define a concrete review or escalation trigger.',
    ],
    pitfalls: [
      'Treating the loudest request as the highest priority without understanding the consequence.',
      'Spending all available time discovering requirements and leaving no time to act or verify.',
      'Calling requirements optional because the schedule is uncomfortable.',
    ],
    walkthrough: [
      {
        title: 'Build a small uncertainty map',
        body: 'Create three columns: known, assumed, and must clarify now. Put the deadline in known only if confirmed. Move a question into the last column when its answer changes the priority or exposes unacceptable risk. For each such question, write two possible answers and the different action each would imply; this prevents a generic list of interview questions.',
      },
      {
        title: 'Review the plan under changed evidence',
        body: 'Suppose the registration flow succeeds, but the eligibility wording excludes intended participants. Explain why content clarification now outranks a technical repair. Check your plan for outcome, criteria, deferral, ownership, and review trigger. These rubric categories guide reflection rather than produce a grade. Describe the change in reasoning, not just a different final choice.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Ask a question that changes action',
        prompt: 'For the club scenario, write one clarifying question and two possible answers that imply different priorities.',
        hints: ['Distinguish inability to submit from uncertainty about eligibility.', 'Make both possible answers plausible.'],
        solution: 'Hypothetical illustration: “Can affected users complete the form?” If not, investigate the blocking path. If yes but they misunderstand eligibility, inspect the instructions with the organizer.',
        checklist: ['The question is specific.', 'Two answers are considered.', 'The next action differs.'],
      },
      {
        id: 'stretch',
        title: 'Handle incompatible commitments',
        prompt: 'The organizer requests a complete redesign and a verified submission fix in the same afternoon. Give a respectful response without silently dropping checks.',
        hints: ['State the capacity conflict.', 'Offer a scope decision rather than an unsupported promise.'],
        solution: 'Hypothetical illustration: “I cannot responsibly commit to both with verification today. I recommend checking and repairing completion first, then scheduling the redesign. If you prefer another scope, let us make that tradeoff explicit.”',
        checklist: ['The conflict is clear.', 'Required checks remain protected.', 'The accountable person gets an actionable choice.'],
      },
    ],
    followUps: [
      { question: 'What if the owner is unavailable?', answer: 'Use an existing delegation or escalation path. For reversible low-risk work, state a provisional assumption and document it; do not treat absence as permission to make consequential unauthorized changes.' },
      { question: 'When would more research be wasteful?', answer: 'When the next finding is unlikely to change the near-term decision and a safe reversible action can generate useful evidence. Explain the specific uncertainty, rather than asserting that speed is always better.' },
    ],
    takeaways: [
      'Clarify the uncertainty that changes the next decision.',
      'A priority is incomplete until deferred work and consequences are visible.',
      'Give assumptions a review trigger so changing course remains deliberate.',
    ],
  },
  {
    id: 'behavioral-collaboration-leadership',
    track: 'behavioral',
    title: 'Collaboration: lead through shared understanding',
    minutes: 40,
    summary: 'Show influence without authority through listening, clear agreements, inclusive participation, and visible follow-through.',
    prerequisites: ['behavioral-ambiguity-prioritization'],
    prerequisiteNotes: 'Apply decision ownership and explicit tradeoffs to work involving several people. A formal leadership title is unnecessary.',
    objectives: [
      'Identify a coordination problem without assigning motives or stereotypes.',
      'Explain how listening or feedback changed your proposed approach.',
      'Create explicit agreements while preserving shared credit and respectful boundaries.',
    ],
    concepts: [
      {
        title: 'Influence starts with understanding dependencies',
        body: 'Describe dependencies and where shared understanding broke down. Ask what people need rather than assuming reluctance or incompetence. Influence can involve a clearer interface, better meeting structure, or a small trial. Explain what another perspective changed; merely persuading everyone to accept your original plan may reveal little collaboration.',
      },
      {
        title: 'Inclusive coordination is concrete',
        body: 'Offer live, written, or paired participation without speculating about identity or private circumstances. Give decision context, summarize unresolved questions, and do not treat silence as agreement. Inclusion requires neither endless consultation nor personal disclosure. Explain how participation improved the work, acknowledging when a format did not suit everyone.',
      },
      {
        title: 'Leadership makes agreements maintainable',
        body: 'A productive discussion should leave a decision, owner, next step, and review point when needed. Be clear about what you could commit to and what required approval. Supporting another person may mean connecting them with expertise rather than doing their work for them. Sustainable leadership does not depend on constant availability or private heroics. In the interview, credit the ideas, reviews, and execution supplied by others as carefully as your own facilitation.',
      },
    ],
    example: 'Fictional illustration: Contributors to a neighborhood guide repeatedly edited incompatible versions. A volunteer asked about their working habits, offered a written review window, and proposed one shared draft. A contributor pointed out that live meetings excluded some schedules, so the volunteer changed the review process. The collaboration evidence is the changed approach and explicit agreement, not a claim to exceptional charisma.',
    task: 'Choose a real cross-person project and write a 200-to-280-word account of influence without relying on title. Explain the dependency problem, two listening or coordination actions, one way another person changed your approach, and the resulting agreement. Include credit and a limitation of the outcome. Keep names and sensitive details out. If using the fictional guide scenario for rehearsal, label it hypothetical instead of presenting its events as yours.',
    hints: [
      'Show what changed because you listened, not just that you held a meeting.',
      'End with an actual agreement and follow-through; group enthusiasm alone is not evidence of durable coordination.',
    ],
    solution: `Fictional rehearsal answer:
Our volunteer group was producing a neighborhood guide, and contributors kept reviewing different drafts. I coordinated editing but did not manage the other volunteers or control their schedules.
I asked contributors how they found the current draft and when they could review it. I initially proposed a live review meeting, but one contributor explained that a fixed meeting would prevent some people from participating. I changed the proposal to a shared draft with a written review window and an optional discussion for unresolved questions.
I summarized the open decisions and asked each section owner to confirm their next step. The group coordinator approved the publication schedule; section owners remained responsible for their content. Another volunteer suggested keeping resolved comments visible, which helped explain why wording had changed.
For the next review, contributors used the agreed draft and section owners confirmed their edits. We did not track participation comprehensively, so I cannot claim the process included everyone equally. One late contribution still needed a separate discussion.
My contribution was making the coordination gap explicit and adapting the review process. The content and several useful process ideas came from others. Next time I would ask about review constraints before suggesting a meeting.
Use this only as a structural example; replace it with truthful details from your own experience, or keep it explicitly fictional.`,
    checklist: [
      'I explain a dependency or coordination problem without assigning motives.',
      'I name two concrete listening or coordination actions.',
      'I show how another person’s input changed the approach.',
      'I state an agreement, shared credit, and an honest outcome limit.',
    ],
    pitfalls: [
      'Treating collaboration as persuading everyone that your first idea was correct.',
      'Calling silence consensus or demanding personal reasons for someone’s participation constraints.',
      'Claiming leadership solely because you worked longer or took over other people’s responsibilities.',
    ],
    walkthrough: [
      {
        title: 'Trace an input to a changed action',
        body: 'Write one thing a collaborator actually told you and the action you changed because of it. If you cannot find that link, examine whether your example demonstrates collaboration or only communication. An unchanged decision can still involve listening, but then explain why the input did not outweigh a constraint and how you checked understanding.',
      },
      {
        title: 'Inspect the agreement and credit',
        body: 'Ask a listener to identify who decided, who implemented, and what remained unresolved. Review your draft for listening, adaptation, explicit commitments, shared credit, and follow-through. Missing evidence calls for a more precise sentence, not a self-assigned leadership grade. Reflect on whether the agreement continued without your intervention and state honestly if you do not know.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Make “we aligned” observable',
        prompt: 'Rewrite a true “we aligned” statement with the decision, owner, and next action.',
        hints: ['Use an actual agreement, not an assumed consensus.', 'Distinguish who approved from who volunteered.'],
        solution: 'Fictional illustration: “The coordinator approved the review window, and each section owner confirmed where to leave edits.” This describes an agreement without claiming unanimous enthusiasm.',
        checklist: ['The decision is named.', 'Ownership is explicit.', 'A next action is visible.'],
      },
      {
        id: 'stretch',
        title: 'Invite input without forcing disclosure',
        prompt: 'In the fictional guide project, a contributor does not speak during meetings. Explain how you would seek their input without guessing why.',
        hints: ['Offer another useful participation channel.', 'Do not demand personal explanations or infer agreement from silence.'],
        solution: 'Hypothetical illustration: “I would share the open questions in writing and invite comments before the decision. I would ask whether that format works, without requiring an explanation of their circumstances.”',
        checklist: ['The invitation concerns the work.', 'An alternative channel is offered.', 'Privacy and voluntary disclosure are respected.'],
      },
    ],
    followUps: [
      { question: 'What if someone still disagrees after a thorough discussion?', answer: 'Summarize the remaining concern and use the accountable decision owner. Agree on follow-through and review conditions instead of claiming that good collaboration always produces consensus.' },
      { question: 'How did you avoid becoming a bottleneck?', answer: 'Describe real ownership, shared artifacts, or delegation that let work continue without you. If the process still depended on you, acknowledge that limitation and explain the improvement you would propose.' },
    ],
    takeaways: [
      'Listening is most visible when it affects a decision or action.',
      'Inclusive participation needs practical options, not assumptions about people.',
      'Leadership distributes clarity and responsibility instead of concentrating dependence.',
    ],
  },
  {
    id: 'behavioral-project-deep-dive',
    track: 'behavioral',
    title: 'Project deep dive: explain decisions at several depths',
    minutes: 50,
    summary: 'Connect project goals, constraints, architecture, decisions, validation, and limitations truthfully.',
    prerequisites: ['behavioral-collaboration-leadership'],
    prerequisiteNotes: 'Combine ownership, evidence, tradeoffs, and credit in a shareable personal or public project.',
    objectives: [
      'Explain a project as a short overview and a deeper decision-focused account.',
      'Connect technical choices to requirements, alternatives, and validation evidence.',
      'Handle detailed questions while marking confidentiality and knowledge boundaries.',
    ],
    concepts: [
      {
        title: 'Use layers instead of a chronological inventory',
        body: 'Start with the user problem, scope, and your responsibility. Add components or workflow as needed to explain decisions, not every file or meeting. Prepare a standalone overview, then expand into a decision, alternative, and evidence. Invite the interviewer to choose the next depth rather than delivering an uninterrupted implementation tour.',
      },
      {
        title: 'Connect design to a constraint and a check',
        body: 'Connect each choice to a requirement, considered alternative, and supporting check. Distinguish actual tests from hoped-for properties: sample inputs do not establish production reliability, scalability, or broad accessibility. State what remains untested. Use real observations, not invented traffic numbers, cost savings, or company claims that make a project sound substantial.',
      },
      {
        title: 'Set boundaries without abandoning the explanation',
        body: 'Decline proprietary details while discussing general reasoning. Offer a public or fictional analogy explicitly distinguished from the real system; do not blend its behavior into your history. For a teammate’s component, describe your interface knowledge and credit their work without pretending to know internals. Follow “I do not know” with how you would verify.',
      },
    ],
    example: 'Fictional illustration: A student builds a local reading-list importer for their own files. The interesting decision is preserving the last valid list when a new import is malformed. A deep dive can explain input validation, the replace step, and a failed-import test without inventing users, revenue, deployment scale, or employer details. A small project can support substantial reasoning.',
    task: 'Choose a real shareable project. Prepare a ninety-second overview and a four-minute expansion of one technical decision. Include the user need, scope, your contribution, a simple component or workflow map, one rejected alternative, validation evidence, and an unresolved limitation. Add a boundary statement for confidential or unfamiliar details. If you have no suitable project, rehearse the fictional importer explicitly as an illustration, not a personal achievement.',
    hints: [
      'Center the expansion on one decision with an alternative and a test rather than listing technologies.',
      'Mark what you personally implemented, what others owned, and what you cannot safely or reliably explain.',
    ],
    solution: `Fictional rehearsal, not a claimed project:
I built a local reading-list importer for a student exercise. Its purpose was to combine my sample files without replacing the current list with malformed input. I owned the parsing and replacement workflow; the exercise did not include a hosted service or real user deployment.
The workflow read a candidate file, validated the expected fields, built a candidate list, and replaced the current list only after validation succeeded. I chose this separation so an invalid candidate would not immediately erase the existing in-memory list.
An alternative was updating entries as they were parsed. That required a recovery policy for partially applied imports, which was unnecessary for the exercise’s small files. The tradeoff was keeping a full candidate list in memory; I did not test large files and would revisit the design if that became a requirement.
I tested a valid import and a malformed input that failed validation, checking that the previous list remained available. Those checks supported the sample workflow, not crash-safe storage or concurrent updates. I would need additional persistence design before making either claim.
My main learning was to define what must remain true on failure before choosing the update flow. I can explain the small prototype completely, but I would not imply that it had production-scale reliability.
For your own account, retain only requirements, implementation details, and evidence that are true and safe to discuss.`,
    checklist: [
      'My overview identifies the user need, scope, and personal contribution.',
      'My expansion connects a decision to a constraint and an alternative.',
      'I distinguish tested behavior from untested properties.',
      'I label analogies and respect confidentiality or knowledge boundaries.',
    ],
    pitfalls: [
      'Reciting architecture vocabulary without connecting choices to the problem.',
      'Claiming production properties from a classroom prototype or limited sample tests.',
      'Disclosing private implementation details or inventing another team’s internals under follow-up pressure.',
    ],
    walkthrough: [
      {
        title: 'Build a decision card',
        body: 'Write six headings: problem, constraint, choice, alternative, evidence, and limitation. Fill them for one decision you actually made. If the alternative was not considered at the time, label it a retrospective comparison. This distinction keeps the answer thoughtful without rewriting the project’s history. Practice explaining the card without showing internal diagrams or source code.',
      },
      {
        title: 'Switch depth on request',
        body: 'Rehearse the overview, then ask a partner to interrupt with a failure-mode question. Answer that question first and offer a deeper explanation only if useful. Review scope, causal reasoning, validation, credit, and boundaries as reflection categories. Identify one unsupported property claim and remove or qualify it. Record a genuine unresolved question for further study instead of improvising authority.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Compress an architecture tour',
        prompt: 'Explain one real project workflow in three sentences: input, transformation, and observable output or failure behavior.',
        hints: ['Omit tool names unless they explain a decision.', 'Keep the failure claim as narrow as your evidence.'],
        solution: 'Fictional illustration: “The prototype reads a candidate list. It validates fields before replacing the current in-memory list. In the malformed-input test, the previous list remained available.” This does not imply durable transactional storage.',
        checklist: ['The workflow is understandable.', 'The observable behavior is specific.', 'Untested properties are not implied.'],
      },
      {
        id: 'stretch',
        title: 'Handle a confidentiality boundary',
        prompt: 'Rehearse responding to a request for a private architecture detail while still demonstrating relevant reasoning.',
        hints: ['State the boundary without revealing the detail indirectly.', 'Offer a clearly separate public or fictional example.'],
        solution: 'Response structure: “I cannot share that implementation detail. I can explain the general consistency tradeoff with a fictional local importer, if useful.” Keep the analogy’s assumptions separate from the real project and do not imply identical behavior.',
        checklist: ['The boundary is explicit.', 'The alternative is clearly labeled.', 'No confidential equivalence is implied.'],
      },
    ],
    followUps: [
      { question: 'What changes if inputs become much larger?', answer: 'Identify which current assumption breaks, such as holding a candidate list in memory. Discuss options and needed measurements without claiming you implemented or validated a larger-scale design.' },
      { question: 'What was the weakest decision?', answer: 'Name a real tradeoff or limitation, explain what you knew then, and describe evidence that would justify revisiting it. Do not invent a flaw or pretend every choice was optimal.' },
    ],
    takeaways: [
      'Depth comes from decisions, alternatives, and evidence rather than vocabulary.',
      'A prototype’s tested scope is a strength when stated honestly.',
      'Boundaries and clearly labeled analogies preserve both confidentiality and credibility.',
    ],
  },
  {
    id: 'behavioral-technical-communication',
    track: 'behavioral',
    title: 'Technical interviews: clarify, reason aloud, and manage time',
    minutes: 45,
    summary: 'Practice technical reasoning with explicit constraints, useful narration, checkpoints, and honest summaries.',
    prerequisites: ['behavioral-project-deep-dive'],
    prerequisiteNotes: 'Use layered explanations and knowledge boundaries. Reflect on communication, not algorithm speed or fictional scores.',
    objectives: [
      'Clarify inputs, outputs, constraints, and ambiguous edge cases before committing to an approach.',
      'Think aloud through decisions and invariants without narrating every keystroke.',
      'Allocate a fixed interview budget and communicate a reduced scope or incomplete solution honestly.',
    ],
    concepts: [
      {
        title: 'Clarification should change the solution',
        body: 'Restate behavior and clarify constraints affecting correctness or complexity: input size, duplicates, ordering, invalid inputs, and mutation when relevant. Avoid generic questionnaires. Propose assumptions when information is unavailable and check agreement without demanding the algorithm. Use public or fictional practice prompts, never proprietary tasks from past employers.',
      },
      {
        title: 'Narrate reasoning rather than every thought',
        body: 'Expose an approach, the property that must remain true, a tradeoff, and a check. Pause to reason, then summarize; continuous speech is unnecessary. Explain rejected options. When stuck, name the uncertainty and try a small example or simpler baseline. Attractive complexity alone does not establish correctness.',
      },
      {
        title: 'Manage time through visible checkpoints',
        body: 'Agree on available time and adapt the budget when discussion consumes it. Reserve validation and a final summary. Checkpoints compare progress with remaining work rather than demand rushing. Distinguish implemented behavior, manual checks, untested cases, and next steps. Never present plausible reasoning as an executed test or unfinished work as complete.',
      },
    ],
    example: 'Explicitly fictional public-practice prompt: Return the first label occurring exactly once in a sequence, or no result. Clarify whether “first” means input order, matching is case-sensitive, labels are strings, input size is bounded, and how empty input is represented. This is communication practice, not a proprietary task.',
    task: 'Rehearse a thirty-minute discussion of the fictional label prompt: clarification, approach comparison, reasoning checkpoint, and closing summary. Use the budget below, including its two-minute wrap-up. You may sketch a solution, but emphasize correctness conditions and honest validation status. At minute sixteen, simulate discovering an overlooked ordering requirement and re-plan without discarding testing time.',
    hints: [
      'Use a small example such as [a, b, a, c] to clarify why the first unique label follows input order.',
      'When the requirement changes, state what remains valid, what must change, and which optional work you will defer.',
    ],
    solution: `Hypothetical communication rehearsal:
“Let me confirm that first means earliest in the original input among labels appearing exactly once. Is comparison case-sensitive, and should empty input return no result? I will assume exact string matching and no mutation unless you prefer otherwise. What input size should I plan for?”
“A straightforward baseline could repeatedly count each label, but that repeats work. I would compare it with counting occurrences once, then checking candidates in original order. The correctness condition is that a returned label has total count one and every earlier label has a different total count. I have not implemented or tested that yet.”
At minute sixteen: “I overlooked the explicit ordering requirement in my draft. The counts remain useful, but selecting from an unordered collection would not establish the first qualifying input label. I will adjust the selection step and defer optional cleanup so I can still check ordering and empty input.”
At the close: “I manually traced the repeated-label example and the no-result case. I have not run automated tests in this rehearsal, so those are reasoning checks rather than execution evidence. I would next verify empty input and the agreed comparison behavior. The remaining limitation is the unfinished implementation.”
This is a fictional demonstration of communication. Adapt the habits to your own reasoning; never claim these checks ran or this problem appeared in a real interview.`,
    checklist: [
      'My clarifications establish ordering, matching, size, and no-result behavior.',
      'I explain an approach, its correctness condition, and a relevant tradeoff.',
      'My thirty-minute plan reserves validation and a two-minute final summary.',
      'I re-plan at the checkpoint and distinguish manual reasoning from executed tests.',
    ],
    pitfalls: [
      'Asking many irrelevant questions to postpone reasoning about the actual problem.',
      'Narrating syntax continuously while leaving the correctness argument unstated.',
      'Spending the whole budget implementing and then claiming unrun tests would pass.',
    ],
    walkthrough: [
      {
        title: 'Use a complete thirty-minute budget',
        body: 'Use these intervals as a starting agreement. Check progress at minutes eight and sixteen. If clarification runs long, reduce scope or optional optimization while preserving validation and wrap-up. Agree on revised intervals for differently timed interviews.',
        code: '00–04: clarify behavior and constraints (4 minutes)\n04–08: compare approaches and state correctness condition (4 minutes)\n08–22: implement or develop the agreed approach (14 minutes)\n22–28: validate edge cases and discuss limitations (6 minutes)\n28–30: summarize status and next steps (2 minutes)',
      },
      {
        title: 'Review an interrupted rehearsal',
        body: 'Introduce the ordering clarification at minute sixteen. Explain the local correction. Reflect using decision-relevant clarification, reasoning, responsiveness, honest validation, and time awareness. Find evidence for each category; revise gaps without assigning fake hiring grades. Choose one communication habit to repeat and one to change.',
      },
    ],
    extraPractice: [
      {
        id: 'warmup',
        title: 'Clarify with a counterexample',
        prompt: 'For the fictional label prompt, explain what [a, b, a, c] tells you about the meaning of “first.”',
        hints: ['Compare first encountered with first occurring exactly once.', 'State the expected result only under explicit matching assumptions.'],
        solution: 'Hypothetical illustration: “With exact matching and input order, b is the first label whose total count is one. Returning a when first seen would be premature because it repeats later.” This is a manual example, not evidence that code ran.',
        checklist: ['The ordering assumption is explicit.', 'The counterexample exposes premature selection.', 'Manual reasoning is labeled accurately.'],
      },
      {
        id: 'stretch',
        title: 'Recover time without hiding incompleteness',
        prompt: 'At minute twenty-two, propose a recovery for unfinished implementation that retains validation and wrap-up.',
        hints: ['Do not silently spend the final eight minutes coding.', 'Ask to validate the core path and name unfinished work.'],
        solution: 'Hypothetical illustration: “The core path is incomplete. I propose using the next six minutes to trace the agreed behavior and expose the remaining gap, then two minutes to summarize. I will defer optimization and clearly mark what has not executed.”',
        checklist: ['Six minutes remain for validation.', 'Two minutes remain for wrap-up.', 'Unfinished and untested work are explicit.'],
      },
    ],
    followUps: [
      { question: 'What if the interviewer asks for silence while you code?', answer: 'Respect the requested format. Agree on a brief checkpoint for explaining the approach and validation instead of assuming continuous narration is always desirable.' },
      { question: 'What if you cannot finish?', answer: 'State what is implemented, what evidence you have, and the precise remaining gap. Offer the next check or correction without predicting a passing result or inventing an interview outcome.' },
    ],
    takeaways: [
      'Clarify constraints that influence correctness and approach.',
      'Expose decisions and invariants rather than filling every silence.',
      'Preserve validation time and finish with an honest status summary.',
    ],
  },
]
