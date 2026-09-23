// Authored copy and routing from Conversation Practice redesign (76), 2026-09-21.
// No provider calls, scoring, or legacy fourth question.
export const answerFirstContent = {
  "DIFF": [
    {
      "id": "clarity",
      "label": "Getting my thoughts out clearly."
    },
    {
      "id": "speakup",
      "label": "Speaking up instead of holding back."
    },
    {
      "id": "raise",
      "label": "Bringing up something uncomfortable."
    },
    {
      "id": "pushback",
      "label": "Staying clear when someone pushes back."
    },
    {
      "id": "needs",
      "label": "Saying no or asking for what I need."
    },
    {
      "id": "listen",
      "label": "Listening and feeling more connected."
    },
    {
      "id": "other",
      "label": "I’m not sure yet."
    }
  ],
  "CTX": [
    {
      "id": "work",
      "label": "At work",
      "phrase": "at work"
    },
    {
      "id": "partner",
      "label": "With my partner",
      "phrase": "with your partner"
    },
    {
      "id": "family",
      "label": "With family",
      "phrase": "with family"
    },
    {
      "id": "friends",
      "label": "With friends or people I'm getting to know",
      "phrase": "with friends"
    },
    {
      "id": "any",
      "label": "Across different situations",
      "phrase": "in more than one place"
    }
  ],
  "REC": {
    "clarity": [
      {
        "id": "tangled",
        "label": "I know what I mean, but it comes out tangled."
      },
      {
        "id": "bury",
        "label": "Every detail feels important, so I lose the main point."
      },
      {
        "id": "blank",
        "label": "My mind goes blank when someone puts me on the spot."
      },
      {
        "id": "after",
        "label": "I work out what I wanted to say after the conversation."
      }
    ],
    "speakup": [
      {
        "id": "turn",
        "label": "I have something to add but can't find my turn."
      },
      {
        "id": "blank",
        "label": "My mind goes blank when someone puts me on the spot."
      },
      {
        "id": "after",
        "label": "I work out what I wanted to say after the conversation."
      },
      {
        "id": "disagree",
        "label": "Disagreeing with someone above me feels risky.",
        "ctx": [
          "work",
          "any"
        ]
      }
    ],
    "raise": [
      {
        "id": "initiate",
        "label": "I know there's an issue but keep waiting for the right moment."
      },
      {
        "id": "accused",
        "label": "When I bring up being hurt, I end up the one defending myself.",
        "ctx": [
          "partner",
          "family",
          "any"
        ]
      },
      {
        "id": "feedback",
        "label": "I avoid hard feedback and smooth things over instead.",
        "ctx": [
          "work",
          "any"
        ]
      },
      {
        "id": "tease",
        "label": "I can't tell whether to laugh it off or say it hurt.",
        "ctx": [
          "friends",
          "any"
        ]
      }
    ],
    "pushback": [
      {
        "id": "derail",
        "label": "One complaint turns into a list of everything either of us did."
      },
      {
        "id": "hold",
        "label": "I explain my limit, but struggle to hold it."
      },
      {
        "id": "defensive",
        "label": "Asking why I'm being criticised makes me sound defensive.",
        "ctx": [
          "work",
          "any"
        ]
      }
    ],
    "needs": [
      {
        "id": "yes",
        "label": "I say yes before I've decided."
      },
      {
        "id": "ask",
        "label": "I feel guilty asking for help or for what I need."
      },
      {
        "id": "capacity",
        "label": "I can't say I'm at capacity without seeming unwilling.",
        "ctx": [
          "work",
          "any"
        ]
      },
      {
        "id": "nochange",
        "label": "We agree on something, but nothing changes.",
        "ctx": [
          "partner",
          "family",
          "any"
        ]
      }
    ],
    "listen": [
      {
        "id": "fix",
        "label": "I jump into fixing when they want understanding."
      },
      {
        "id": "rehearse",
        "label": "I'm planning my reply instead of listening."
      },
      {
        "id": "interview",
        "label": "I ask all the questions and barely share anything.",
        "ctx": [
          "friends",
          "any"
        ]
      },
      {
        "id": "bother",
        "label": "I want to reach out, but worry I might be bothering them.",
        "ctx": [
          "friends",
          "any"
        ]
      }
    ],
    "other": []
  },
  "NOTSURE": {
    "id": "notsure",
    "label": "Something else / I’m not sure"
  },
  "FOCUS": {
    "bury": {
      "short": "Point first",
      "headline": "Lead with your main point.",
      "rec": "Share your recommendation, give one useful reason, then leave room for a question. The other details stay yours; you just stop leading with them.",
      "take": "Before your next explanation, ask yourself: what’s the one thing they need to understand?",
      "ptitle": "Practice keeping your point when the conversation moves.",
      "scenario": {
        "work": "Explain a recommendation to a colleague who wants the short version.",
        "partner": "Explain to your partner why you want to change a weekend plan, in two sentences.",
        "family": "Tell a relative what you need for a visit without the whole backstory.",
        "friends": "Recommend a plan to a friend who is half-listening.",
        "any": "Explain a recommendation to someone who wants the short version."
      },
      "counterpart": {
        "work": "Sam, a colleague",
        "partner": "Jesse",
        "family": "Your dad",
        "friends": "Priya",
        "any": "Sam"
      },
      "opener": "Give me the short version. What are you recommending?",
      "before": "“There are a few different things that happened, and to understand why…”",
      "after": "“I recommend moving the deadline because testing found an issue we need to fix.”",
      "coverage": "Verified: Module 1, Lesson 1 (The Buried Point) covers point / proof / move. Practice scene is proposed."
    },
    "after": {
      "short": "Room to process",
      "headline": "Give yourself time to think, out loud.",
      "rec": "This isn’t nerves and it isn’t a confidence problem. You process after the room has moved on. The move is a short holding line in the moment plus a real follow-up that counts as your contribution.",
      "take": "Try one line next time: “I want to think about that properly. I’ll send you my view by end of day.”",
      "ptitle": "Practice buying time without disappearing.",
      "scenario": {
        "work": "A meeting turns to you for a view on a new system you saw ten minutes ago.",
        "partner": "Your partner asks you to decide something big on the spot.",
        "family": "A relative asks for an answer at the dinner table.",
        "friends": "A friend wants a decision about a trip right now.",
        "any": "Someone asks for your view before you’ve had time to think."
      },
      "counterpart": {
        "work": "Maya, your manager",
        "partner": "Jesse",
        "family": "Your sister",
        "friends": "Priya",
        "any": "Maya"
      },
      "opener": "You’ve seen the plan. What do you think, should we go with it?",
      "before": "“Um, yeah, I think it’s probably fine, I guess…”",
      "after": "“I have a first reaction and a question I’d rather check before I answer. Can I send it by four?”",
      "coverage": "Proposed practice; no approved lesson covers delayed processing. Adjacent verified move: Park and Return (M1 L3)."
    },
    "tangled": {
      "short": "One thread",
      "headline": "Turn the idea into a short spoken sequence.",
      "rec": "Say the first sentence, stop, then the next. Slower is allowed; the tangle comes from trying to say all of it at once.",
      "take": "Start with “The short version is…” and finish that sentence before anything else.",
      "ptitle": "Practice saying one thing at a time.",
      "scenario": {
        "any": "Explain something you care about to someone who keeps nodding."
      },
      "counterpart": {
        "any": "Sam"
      },
      "opener": "So walk me through it.",
      "before": "“Okay so it’s kind of like, well there’s this thing where…”",
      "after": "“The short version is this. Then I’ll give you the why.”",
      "coverage": "Proposed practice; adjacent verified: M1 L1 and M1 L5 (Pick one. Keep the rest.)."
    },
    "blank": {
      "short": "Holding line",
      "headline": "Have a line ready for when your mind goes blank.",
      "rec": "Retrieval under pressure is a different skill from knowing things. A rehearsed holding line and one question you always have gives you a floor.",
      "take": "Keep one question in your pocket: “What would change your mind on this?”",
      "ptitle": "Practice answering when you were not ready.",
      "scenario": {
        "any": "The conversation turns to you unexpectedly and everyone waits."
      },
      "counterpart": {
        "any": "Maya"
      },
      "opener": "Let’s hear from you. Any thoughts?",
      "before": "“…”",
      "after": "“One thing I’d want to know before deciding: what does the timeline look like?”",
      "coverage": "Proposed practice; no verified lesson yet."
    },
    "turn": {
      "short": "Finding a turn",
      "headline": "Get into the conversation before it moves on.",
      "rec": "You already listen; that’s why you have something to say. The practice is signalling and entering, and recovering kindly if two people start together.",
      "take": "Lean in and say the person’s name, then your first word. The name buys the turn.",
      "ptitle": "Practice entering a fast conversation.",
      "scenario": {
        "any": "Three people are talking over each other and you have the missing fact."
      },
      "counterpart": {
        "any": "A small group"
      },
      "opener": "…so that’s why I think Tuesday is fine, unless, wait, what were you going to say?",
      "before": "Waiting for a gap that never comes.",
      "after": "“Sam, one thing before we lock Tuesday.”",
      "coverage": "Proposed practice; no verified lesson yet."
    },
    "disagree": {
      "short": "Safe disagreement",
      "headline": "Offer an alternative without it landing as defiance.",
      "rec": "Frame it as protecting the outcome they care about, then ask whether they want the detail. If disagreement is punished regardless of wording, that is not a skill gap.",
      "take": "“I want the launch to land. Can I flag one risk with the current plan?”",
      "ptitle": "Practice raising an alternative upward.",
      "scenario": {
        "any": "Your manager has decided; you think there’s a better route."
      },
      "counterpart": {
        "any": "Maya, your manager"
      },
      "opener": "We’re going with option A. Any objections?",
      "before": "“I just don’t think that’s going to work.”",
      "after": "“I’m with you on the goal. One risk with A I’d like on the table before we commit.”",
      "coverage": "Proposed practice."
    },
    "initiate": {
      "short": "Opening it",
      "headline": "Open the difficult conversation instead of waiting for it.",
      "rec": "Start with a short, plain opener in a calm moment, one issue only. The goal of the first sentence is to begin, not to resolve.",
      "take": "“There’s something I’ve been putting off saying. Is now okay?” Then say the one thing.",
      "ptitle": "Practice the first thirty seconds.",
      "scenario": {
        "partner": "It’s a quiet evening. You raise the thing you’ve been sitting on for two weeks.",
        "family": "You bring up the visit schedule with a parent who means well.",
        "work": "You open a feedback conversation you’ve rescheduled twice.",
        "friends": "You tell a friend the joke last week stuck with you.",
        "any": "You open the conversation you’ve been avoiding."
      },
      "counterpart": {
        "partner": "Jesse",
        "family": "Your mum",
        "work": "Chris, your report",
        "friends": "Priya",
        "any": "Jesse"
      },
      "opener": "Sure, what’s up?",
      "before": "“So, um, it’s not a big deal, but, I mean, forget it.”",
      "after": "“I’ve been avoiding saying this. When plans change last minute I feel like an afterthought. I want to talk about it.”",
      "coverage": "Proposed practice; adjacent verified: Clear Ask (M2 L1) and Say Whether No (M2 L4)."
    },
    "accused": {
      "short": "Event, impact, ask",
      "headline": "Name the hurt without it becoming a trial.",
      "rec": "Event, impact, one request. Keep the first sentence about what happened, not who they are. If it still turns into counter-blame every time, that’s worth noticing.",
      "take": "“When X happened, I felt Y. Next time I’d like Z.” One sentence each.",
      "ptitle": "Practice staying with the original issue.",
      "scenario": {
        "any": "You bring up something that hurt, and they start to defend."
      },
      "counterpart": {
        "any": "Jesse"
      },
      "opener": "I was sick too last month and you didn’t exactly wait on me.",
      "before": "“You never think about anyone but yourself.”",
      "after": "“That’s a separate thing and I’m happy to talk about it. Right now I’m asking about Tuesday.”",
      "coverage": "Proposed practice; adjacent verified: Park and Return (M1 L3).",
      "safety": true
    },
    "feedback": {
      "short": "Start the feedback",
      "headline": "Give the feedback early, in plain words.",
      "rec": "Schedule it so you can’t back out, state the issue in one sentence, and let the discomfort be there without filling it.",
      "take": "Book the conversation before you feel ready. Readiness follows the booking.",
      "ptitle": "Practice the first sentence of hard feedback.",
      "scenario": {
        "any": "A direct report’s work is slipping and you’ve smoothed it over twice."
      },
      "counterpart": {
        "any": "Chris, your report"
      },
      "opener": "Hey, you wanted to catch up?",
      "before": "“So overall things are great, just a tiny thing, no big deal…”",
      "after": "“I want to talk about the last two deadlines. They slipped and it’s affecting the team. What’s getting in the way?”",
      "coverage": "Proposed practice."
    },
    "tease": {
      "short": "Naming a limit",
      "headline": "Say it landed badly without starting a fight.",
      "rec": "You don’t need a comeback. A plain sentence about your limit is enough, and repeating it matters more than winning the moment.",
      "take": "“That one stuck with me. Can we leave that topic?”",
      "ptitle": "Practice naming a limit with a friend.",
      "scenario": {
        "any": "A friend makes the same joke again in front of others."
      },
      "counterpart": {
        "any": "Priya"
      },
      "opener": "Oh come on, you know I’m joking.",
      "before": "Laughing along, then stewing.",
      "after": "“I know. It still stuck with me. Can we drop that one?”",
      "coverage": "Proposed practice; adjacent verified: Say Whether No (M2 L4)."
    },
    "derail": {
      "short": "One issue",
      "headline": "Stay with one issue at a time.",
      "rec": "When the counter-complaint comes, acknowledge it and book it a turn. Then return to the thing you raised.",
      "take": "“That’s fair and I want to talk about it. Can we finish this one first?”",
      "ptitle": "Practice returning to the issue.",
      "scenario": {
        "any": "You raise one thing and get three back."
      },
      "counterpart": {
        "any": "Jesse"
      },
      "opener": "Okay but what about when you left me with the kids all weekend?",
      "before": "“That is NOT the same and you know it.”",
      "after": "“I want to talk about that too. Let’s finish Tuesday first, then that one.”",
      "coverage": "Verified: Park and Return (M1 L3) covers parking and returning. Scene proposed.",
      "safety": true
    },
    "hold": {
      "short": "Holding a limit",
      "headline": "Hold the limit you already explained.",
      "rec": "The second time, say less. Repeat the limit in the same words; you don’t owe a new justification each time it’s tested.",
      "take": "Pick your sentence once. Say it the same way twice.",
      "ptitle": "Practice repeating a limit under pressure.",
      "scenario": {
        "any": "You said no and they ask again with a new reason."
      },
      "counterpart": {
        "any": "Your mum"
      },
      "opener": "It’s just this once, and the kids would love it.",
      "before": "“Well… I suppose if it’s just this once…”",
      "after": "“I know they would. It still doesn’t work this weekend.”",
      "coverage": "Proposed practice; adjacent verified: Say Whether No (M2 L4), Ask for the Loop (M2 L5)."
    },
    "defensive": {
      "short": "Receiving feedback",
      "headline": "Ask for the reasoning without sounding like you’re rejecting it.",
      "rec": "Acknowledge first, then ask for a specific example. Acknowledging isn’t agreeing with every claim.",
      "take": "“Thanks. Can you give me one example so I get exactly what to change?”",
      "ptitle": "Practice receiving criticism.",
      "scenario": {
        "any": "Your manager says your updates are too long."
      },
      "counterpart": {
        "any": "Maya, your manager"
      },
      "opener": "Your updates are hard to follow. Can you tighten them up?",
      "before": "“I mean, I only include what people asked for…”",
      "after": "“Got it. Which update is the best example, so I change the right thing?”",
      "coverage": "Proposed practice."
    },
    "yes": {
      "short": "Pause first",
      "headline": "Pause before you commit.",
      "rec": "Politeness is answering before you’ve decided. The move is a short line that buys a real decision, and a plain way to take back a yes you shouldn’t have given.",
      "take": "“Let me check and come back to you tonight.” Say it even when you think the answer is yes.",
      "ptitle": "Practice not answering yet.",
      "scenario": {
        "friends": "A friend invites themselves to your family dinner, in front of everyone.",
        "work": "A colleague asks you to cover their shift while you’re both walking to a meeting.",
        "partner": "Your partner asks you to host their family next weekend.",
        "family": "A relative asks you to lend the car this weekend.",
        "any": "Someone asks for a favour on the spot."
      },
      "counterpart": {
        "friends": "Priya",
        "work": "Sam",
        "partner": "Jesse",
        "family": "Your brother",
        "any": "Priya"
      },
      "opener": "So I can come Thursday, right? I’ll bring dessert.",
      "before": "“Yeah! Yeah, of course, sure.”",
      "after": "“Let me check with my parents tonight, it’s their table. I’ll text you.”",
      "coverage": "Proposed practice; adjacent verified: Say Whether No (M2 L4)."
    },
    "ask": {
      "short": "Plain ask",
      "headline": "Ask plainly and let them say no.",
      "rec": "Say the need and the request in two sentences. The explaining you add on top is what makes it feel like imposing.",
      "take": "“I could use a hand with X on Saturday. Totally fine if it doesn’t work.”",
      "ptitle": "Practice a short ask.",
      "scenario": {
        "any": "You need a favour and have rewritten the message four times."
      },
      "counterpart": {
        "any": "Priya"
      },
      "opener": "Hey! What’s up?",
      "before": "“So sorry to bother you, I know you’re busy, and it’s totally fine if not, but…”",
      "after": "“Could you drive me to the airport Saturday? Fine if not.”",
      "coverage": "Verified: Clear Ask (M2 L1) covers action / owner / room to answer. Scene proposed."
    },
    "capacity": {
      "short": "Capacity trade",
      "headline": "Say you’re full without sounding unwilling.",
      "rec": "Turn the no into a priority question. Show the list and ask what moves; your boss may genuinely not know it’s full.",
      "take": "“I can take this on. Which of these three should move to make room?”",
      "ptitle": "Practice the priority trade.",
      "scenario": {
        "any": "Your manager adds a project on top of three deadlines."
      },
      "counterpart": {
        "any": "Maya, your manager"
      },
      "opener": "Can you pick up the vendor review this week too?",
      "before": "“Sure, I’ll figure it out.”",
      "after": "“Happy to. Here’s what’s on this week. Which one moves?”",
      "coverage": "Proposed practice; adjacent verified: When They Say They Can’t (M2 L3)."
    },
    "nochange": {
      "short": "Owned commitment",
      "headline": "Turn the agreement into something owned.",
      "rec": "One action, one owner, one check-in. Then separate a communication gap from unwillingness; those need different conversations.",
      "take": "End the talk with: “So you’ll do X by Friday, and I’ll ask how it went Saturday. Okay?”",
      "ptitle": "Practice closing with an owned commitment.",
      "scenario": {
        "any": "You’ve agreed on chores three times and nothing moved."
      },
      "counterpart": {
        "any": "Jesse"
      },
      "opener": "Yeah, yeah, I said I’d do it.",
      "before": "“You always say that.”",
      "after": "“Okay. Bins Thursday night, you’re on it, and I won’t remind you. Deal?”",
      "coverage": "Verified: Clear Ask (M2 L1) and Ask for the Loop (M2 L5). Scene proposed.",
      "safety": true
    },
    "fix": {
      "short": "Check before fixing",
      "headline": "Find out what they want before you fix it.",
      "rec": "One question up front changes the whole conversation: listening, thinking it through together, or an actual decision.",
      "take": "“Do you want me to just listen, or help figure it out?”",
      "ptitle": "Practice checking before helping.",
      "scenario": {
        "any": "Someone you love brings a stressful day and you have three solutions ready."
      },
      "counterpart": {
        "any": "Jesse"
      },
      "opener": "Today was awful. My manager did the thing again.",
      "before": "“You should just tell her that’s not your job.”",
      "after": "“Ugh. Do you want to vent, or want me to think it through with you?”",
      "coverage": "Proposed practice."
    },
    "rehearse": {
      "short": "Outward attention",
      "headline": "Respond to what they said, not what you planned.",
      "rec": "Pause before replying and repeat one thing they said. It’s slower and it lands as presence.",
      "take": "Let the first two seconds after they stop be silent. Then start with their words.",
      "ptitle": "Practice replying from their words.",
      "scenario": {
        "any": "A friend tells you a story while you drift into your next line."
      },
      "counterpart": {
        "any": "Priya"
      },
      "opener": "…and then he just didn’t show up. Anyway. How’s your week?",
      "before": "“Oh yeah, so my week, actually a funny thing happened…”",
      "after": "“Wait, he didn’t show up at all? What did you do?”",
      "coverage": "Proposed practice."
    },
    "interview": {
      "short": "Share back",
      "headline": "Alternate asking with sharing.",
      "rec": "After two questions, offer one thing about yourself. Both people need something to hold on to.",
      "take": "Question, question, then “for me it was…”",
      "ptitle": "Practice adding yourself in.",
      "scenario": {
        "any": "You’re meeting someone new and have asked six questions."
      },
      "counterpart": {
        "any": "Alex"
      },
      "opener": "Yeah, I moved here last spring. What about you?",
      "before": "“Oh cool, and what made you move?”",
      "after": "“I came for a job I’ve since left, which is a whole story. What made you move?”",
      "coverage": "Proposed practice."
    },
    "bother": {
      "short": "Low-pressure bid",
      "headline": "Reach out without needing a reason.",
      "rec": "A short message with no ask in it. If it’s a bad time they’ll say, and you’ll have made the door easier to open both ways.",
      "take": "“Thought of you today. No reply needed.”",
      "ptitle": "Practice a small bid for connection.",
      "scenario": {
        "any": "You’ve thought about calling a friend for three weeks."
      },
      "counterpart": {
        "any": "Priya"
      },
      "opener": "Hey! It’s been ages.",
      "before": "Not calling, again.",
      "after": "“It has. I kept thinking of you and then thinking it was too late to call. So, hi.”",
      "coverage": "Proposed practice."
    },
    "unsafe": {
      "short": "Safety first",
      "headline": "This isn’t a wording problem.",
      "rec": "If raising things gets you shouted down, insulted or blamed regardless of how you say them, practising phrasing isn’t the answer, and we won’t pretend it is.",
      "take": "Talk to one person outside the situation this week.",
      "ptitle": "",
      "scenario": {
        "any": ""
      },
      "counterpart": {
        "any": ""
      },
      "opener": "",
      "before": "",
      "after": "",
      "coverage": "Routes to the safety screen. No practice is offered on this branch.",
      "safety": true,
      "stop": true
    },
    "other": {
      "short": "A first practice",
      "headline": "Start with one real conversation.",
      "rec": "No diagnosis needed. Pick a conversation you’ve got coming up and practise the first thirty seconds of it. We’ll suggest a focus after you’ve tried something.",
      "take": "Write down the first sentence of a conversation you’re not looking forward to.",
      "ptitle": "Practice the first thirty seconds of a real one.",
      "scenario": {
        "any": "Open a conversation you have coming up, in your own words."
      },
      "counterpart": {
        "any": "A spoken partner you choose"
      },
      "opener": "Okay, I’m listening.",
      "before": "",
      "after": "",
      "coverage": "Generic entry; no focus claimed. Not a fake completion."
    }
  }
};

