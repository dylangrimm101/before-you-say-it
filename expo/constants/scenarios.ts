import type { CategoryId, Difficulty, Scenario } from "@/types/convo";

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
  accent: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "partner",
    label: "Partner",
    blurb: "The conversations you keep postponing at home",
    accent: "#7B62AC",
  },
  {
    id: "family",
    label: "Family",
    blurb: "Boundaries with the people who knew you first",
    accent: "#63409B",
  },
  {
    id: "work",
    label: "Work",
    blurb: "Raises, burnout, feedback, resignations",
    accent: "#4F6C8F",
  },
  {
    id: "friends",
    label: "Friends",
    blurb: "The unspoken things between you",
    accent: "#6A46A0",
  },
];

export const DIFFICULTY: Record<
  Difficulty,
  { label: string; note: string; behaviour: string }
> = {
  gentle: {
    label: "Gentle",
    note: "They listen, but they still have feelings.",
    behaviour:
      "You are receptive but genuinely affected. You ask honest questions, admit some fault, and can be moved by a well-made point. You still need to feel respected.",
  },
  steady: {
    label: "Steady",
    note: "They deflect, minimize and change the subject.",
    behaviour:
      "You are defensive and self-protective. You minimize ('it's not that bad'), deflect ('what about when you...'), change the subject, and only soften if the other person stays specific, calm and concrete. You do not concede easily.",
  },
  challenging: {
    label: "Challenging",
    note: "They get sharp fast. Bring composure.",
    behaviour:
      "You are hurt and reactive. You interrupt the logic, use blame and absolutes ('you always', 'you never'), bring up old grievances, and may threaten to end the conversation. You never swear or become abusive. You only de-escalate if the other person stays composed, validates your feeling, and repeats their point without matching your heat.",
  },
};

export const SCENARIOS: Scenario[] = [
  {
    id: "chores",
    category: "partner",
    power: "peer",
    title: "Ask for a fair split of the housework",
    counterpart: "Sam — your partner of four years",
    situation:
      "You have been carrying most of the cooking, laundry and admin for months. You've hinted at it before and nothing changed. Tonight the kitchen is a mess again.",
    persona:
      "Sam works long hours and believes they contribute plenty. Past attempts to talk about the split have turned into a tally of who does more, before the two of you agreed on a plan.",
    goal: "Get a specific, agreed change in who does what — not just an apology.",
    opensWith: "user",
    openingLine:
      "(barely looking up from their phone) Hey. I'll deal with the kitchen tomorrow, I swear.",
    minutes: 7,
  },
  {
    id: "intimacy",
    category: "partner",
    power: "peer",
    title: "Say you feel lonely in the relationship",
    counterpart: "Alex — your partner",
    situation:
      "You live parallel lives: phones, separate rooms, no real conversation in weeks. You feel lonely and you're scared that saying it will sound like an accusation.",
    persona:
      "Alex is not cruel. Past attempts to talk about closeness have moved to schedules and who is busier, before either of you got to the feeling underneath.",
    goal: "Be honest about the loneliness without it turning into a fight about who is busier.",
    opensWith: "user",
    openingLine: "(sitting down) You sounded serious on the phone. What's up?",
    minutes: 8,
  },
  {
    id: "wedding-money",
    category: "partner",
    power: "peer",
    title: "Talk about the money you've been avoiding",
    counterpart: "Jordan — your partner",
    situation:
      "There is debt neither of you mentions. You found a statement and need to open the topic without shaming Jordan.",
    persona:
      "Jordan is embarrassed about money. Past attempts to raise it have turned into jokes, then irritation, before the real numbers came out.",
    goal: "Get the real numbers on the table and agree to look at them together this week.",
    opensWith: "user",
    openingLine: "(laughing) Okay, why do you look like you're about to fire me?",
    minutes: 8,
  },
  {
    id: "mother-boundary",
    category: "family",
    power: "mixed_or_unknown",
    title: "Set a boundary with your mother",
    counterpart: "Your mom",
    counterpartGender: "woman",
    situation:
      "She drops by unannounced, comments on your home and choices, and calls daily. You love her and dread hurting her.",
    persona:
      "Warm, anxious, and fluent in guilt. Past attempts to ask for notice have turned to her sacrifices and hurt feelings, before a workable arrangement was agreed. She is not a villain — she is scared of losing closeness.",
    goal: "Ask her to call before visiting, and hold it when she gets hurt.",
    // She arrives mid-stream with soup and a jab about the hallway, so the user
    // is genuinely responding to something here.
    opensWith: "counterpart",
    openingLine:
      "(cheerful) I brought you soup! Don't say I never think of you. Now, when are you going to do something about that hallway?",
    minutes: 8,
  },
  {
    id: "sibling-caregiving",
    category: "family",
    power: "peer",
    title: "Ask your brother to share the caregiving",
    counterpart: "Chris — your older brother",
    counterpartGender: "man",
    situation:
      "You have done nearly all the hospital visits and paperwork for a parent. Chris lives forty minutes away and is always 'slammed'.",
    persona:
      "Chris genuinely believes he is doing his share. Past attempts to divide the caregiving have turned into a defense of how busy he is, before any task got assigned.",
    goal: "Leave with two specific things Chris will own, with dates.",
    opensWith: "user",
    openingLine: "(on speakerphone, distracted) Yep? Everything okay with Dad?",
    minutes: 7,
  },
  {
    id: "parent-comingclean",
    category: "family",
    power: "mixed_or_unknown",
    title: "Tell your parents a truth they won't like",
    counterpart: "Your dad",
    counterpartGender: "man",
    situation:
      "You are about to share something big — a breakup, a move, a career change — that goes against what he expected of you.",
    persona:
      "Controlled disappointment. Past attempts to share a big decision have turned into cross-examination framed as concern, before you finished saying it.",
    goal: "Say it plainly, once, and not retreat into justifying yourself.",
    opensWith: "user",
    openingLine: "(putting the paper down) You said you wanted to talk. Go ahead.",
    minutes: 7,
  },
  {
    id: "raise",
    category: "work",
    power: "counterpart_has_more_power",
    title: "Ask for the raise you've earned",
    counterpart: "Priya — your manager",
    counterpartGender: "woman",
    situation:
      "You have taken on scope well beyond your title for a year. Budget season is closing this month.",
    persona:
      "Priya is friendly but budget-constrained. Past conversations about pay have moved to timing, the band, and the next cycle, before a specific number was discussed.",
    goal: "Name a specific number and get a commitment or a dated next step.",
    opensWith: "user",
    openingLine:
      "(smiling) Hey! I've only got fifteen — what did you want to cover?",
    minutes: 8,
  },
  {
    id: "burnout",
    category: "work",
    power: "counterpart_has_more_power",
    title: "Tell your boss you're burned out",
    counterpart: "Daniel — your director",
    counterpartGender: "man",
    situation:
      "You are running on empty and have been quietly compensating for a short-staffed team. You are afraid of looking replaceable.",
    persona:
      "Daniel is well-meaning and overloaded. Past mentions of workload have been met with reassurance and next-quarter plans, before anything came off your plate.",
    goal: "Get a concrete reduction in load this month, not sympathy.",
    opensWith: "user",
    openingLine: "(closing his laptop) You've got my full attention. What's going on?",
    minutes: 8,
  },
  {
    id: "feedback",
    category: "work",
    power: "peer",
    title: "Give hard feedback to someone you like",
    counterpart: "Maya — your teammate",
    counterpartGender: "woman",
    situation:
      "Maya keeps missing handoffs and you have been covering. You're friends outside work, which makes it harder.",
    persona:
      "Maya cares a lot about how she is seen. Past attempts to raise the handoffs have ended in fast apologies and a quiet retreat, before a change was agreed.",
    goal: "Be specific and kind, and land one agreed change.",
    opensWith: "user",
    openingLine: "(grinning) Uh oh, a meeting with no agenda. Am I in trouble?",
    minutes: 6,
  },
  {
    id: "quit",
    category: "work",
    power: "counterpart_has_more_power",
    title: "Resign without burning the bridge",
    counterpart: "Elena — your manager",
    counterpartGender: "woman",
    situation:
      "You have accepted another offer. Elena has invested in you and will take it personally.",
    persona:
      "Elena takes departures personally. Past conversations about your future here have moved from shock to a counter-offer to an appeal about the team, before anything concrete was settled.",
    goal: "Deliver the decision as final, warmly, and agree a handover.",
    opensWith: "user",
    openingLine: "(sitting down) You've been quiet this week. What's on your mind?",
    minutes: 6,
  },
  {
    id: "friend-money",
    category: "friends",
    power: "peer",
    title: "Ask a friend for the money back",
    counterpart: "Tom — a close friend",
    counterpartGender: "man",
    situation:
      "Tom borrowed a meaningful amount eight months ago and has not mentioned it since. You need it back and you hate the awkwardness.",
    persona:
      "Tom is embarrassed about the money. Past mentions have been deflected with humor, then vague promises, before a date was set.",
    goal: "Get a real date and amount agreed, and keep the friendship.",
    opensWith: "user",
    openingLine: "(cheerful) Hey, stranger! Long time. Are we doing Friday or what?",
    minutes: 6,
  },
  {
    id: "friend-drift",
    category: "friends",
    power: "peer",
    title: "Name the distance that's grown between you",
    counterpart: "Nadia — your oldest friend",
    counterpartGender: "woman",
    situation:
      "Something changed a year ago and neither of you has said it. Plans get canceled. You miss her and feel stupid for caring.",
    persona:
      "Nadia keeps her own life light and guarded. Past attempts to get real have stayed on the surface unless you go first and stay warm.",
    goal: "Say you miss her and find out what actually happened.",
    opensWith: "user",
    openingLine: "(hugging you) Okay, this is nice, we never do this. How are you?",
    minutes: 7,
  },
];

function expandedScenario(
  id: string,
  category: CategoryId,
  title: string,
  counterpart: string,
  situation: string,
): Scenario {
  return {
    id,
    category,
    power: "peer",
    title,
    counterpart,
    situation,
    persona: `${counterpart} has a reasonable concern and will engage when the conversation stays specific, calm, and focused on a workable next step.`,
    goal: `Address the situation directly and agree on one clear next step.`,
    opensWith: "user",
    openingLine: "You said you wanted to talk. What’s on your mind?",
    minutes: 7,
  };
}

SCENARIOS.push(
  expandedScenario("parenting-disagreement", "partner", "Disagree about a parenting decision", "Taylor — your partner", "Taylor handled a difficult moment with your child differently than you would have. You want to agree on what to do next without attacking either person’s parenting."),
  expandedScenario("last-minute-plan-change", "partner", "Push back on a last-minute plan change", "Casey — your partner", "Casey changed a shared weekend plan after you rearranged work and childcare. You want to address the impact and improve future handoffs."),
  expandedScenario("whole-task-ownership", "partner", "Ask them to own the whole task", "Morgan — your partner", "Morgan helps when asked, but you still notice, plan, remind, and check. You want to hand over one complete recurring responsibility."),
  expandedScenario("phone-attention", "partner", "Talk about phone attention", "Riley — your partner", "Separate screens have left you feeling alone together. You want one repeatable phone-free ritual without keeping score."),
  expandedScenario("work-priority-conflict", "partner", "Decide whose work commitment bends", "Avery — your partner", "You both have important work commitments at the same time and need to choose who covers pickup without ranking whose career matters more."),
  expandedScenario("repair-after-snapping", "partner", "Repair after you snapped", "Jordan — your partner", "You spoke sharply during a rushed handoff. You need to apologize for the wording and still resolve the missed handoff underneath it."),
  expandedScenario("decline-family-invitation", "family", "Decline a family invitation without over-explaining", "Lena — your aunt", "Your household cannot attend a large gathering. You want to decline warmly without turning every explanation into a negotiation."),
  expandedScenario("parenting-criticism", "family", "Respond to criticism of your parenting", "Your father-in-law", "Your father-in-law questioned a parenting decision in front of your child. You want future concerns raised privately."),
  expandedScenario("private-news-boundary", "family", "Ask family not to share your private news", "Jamie — your cousin", "Jamie passed along personal news you asked them to keep private. You want a clear permission rule for the future."),
  expandedScenario("change-holiday-tradition", "family", "Change a family holiday tradition", "Your mom", "Your household can no longer spend the entire holiday at your mother’s home. You want to state the new plan and preserve connection."),
  expandedScenario("family-money-request", "family", "Say no to a family money request", "Marcus — your brother", "Marcus needs a loan, but lending it would strain your household and past loans have damaged trust."),
  expandedScenario("request-time-off", "work", "Ask for time off when the team is stretched", "Dana — your manager", "You need several days off while the team is short-staffed. You want a clear decision rather than taking ownership of the staffing problem."),
  expandedScenario("manager-skepticism", "work", "Defend your recommendation to a skeptical manager", "Morgan — your manager", "You recommend a bolder approach while Morgan favors the familiar option. You need to present one rationale, one risk, and a testable next step."),
  expandedScenario("meeting-interruption", "work", "Get your point back after being interrupted", "Chris — your teammate", "Chris interrupted while you were explaining a risk and the meeting is moving on. You want to reclaim the floor calmly."),
  expandedScenario("scope-creep", "work", "Push back on expanding scope", "Avery — your client", "Several new requests have been added while the deadline and budget remain fixed. You need a decision about what moves."),
  expandedScenario("price-pushback", "work", "Handle price pushback without discounting", "Jordan — a prospective client", "Jordan likes your proposal but has a lower competing quote. You want to understand the objection before changing price or scope."),
  expandedScenario("unhappy-client", "work", "Respond to an unhappy client", "Riley — your client", "A delivery missed an expectation Riley believed was agreed. You need to acknowledge the impact and identify the gap before promising a fix."),
  expandedScenario("decline-friend-invitation", "friends", "Decline an invitation without inventing an excuse", "Alex — your friend", "You value the friendship but do not want to attend the weekend event. You want to say no honestly and warmly."),
  expandedScenario("reconnect-after-silence", "friends", "Reconnect after months of silence", "Taylor — an old friend", "You left Taylor’s messages unanswered for months. You want to own the silence and offer one realistic next step."),
  expandedScenario("join-group-conversation", "friends", "Join a group conversation naturally", "Casey — a person in the group", "You are standing at the edge of a conversation and want to join with one relevant observation or question."),
  expandedScenario("leave-conversation-gracefully", "friends", "Leave a conversation gracefully", "Morgan — a person you just met", "The conversation has run its course. You want to close warmly and move on without inventing an emergency."),
  expandedScenario("forgotten-name", "friends", "Recover after forgetting someone’s name", "Jamie — a person you have met before", "Jamie remembers you, but you cannot recall their name. You want to ask directly and continue without making it a performance."),
);

export function scenariosFor(category: CategoryId): Scenario[] {
  return SCENARIOS.filter((s) => s.category === category);
}
