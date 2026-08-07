import SwiftUI

struct Category: Identifiable {
    let id: CategoryId
    let label: String
    let blurb: String
    let accent: Color
}

enum ScenarioLibrary {
    static let categories: [Category] = [
        Category(id: .partner, label: "Partner", blurb: "The conversations you keep postponing at home", accent: Theme.ember),
        Category(id: .family, label: "Family", blurb: "Boundaries with the people who knew you first", accent: Theme.amber),
        Category(id: .work, label: "Work", blurb: "Raises, burnout, feedback, resignations", accent: Theme.mint),
        Category(id: .friends, label: "Friends", blurb: "The unspoken things between you", accent: Theme.blue),
    ]

    static func category(_ id: CategoryId) -> Category {
        categories.first { $0.id == id } ?? categories[0]
    }

    static func difficultyLabel(_ d: Difficulty) -> String {
        switch d {
        case .gentle: return "Gentle"
        case .steady: return "Steady"
        case .challenging: return "Challenging"
        }
    }

    static func difficultyNote(_ d: Difficulty) -> String {
        switch d {
        case .gentle: return "They listen, but they still have feelings."
        case .steady: return "They deflect, minimize and change the subject."
        case .challenging: return "They get sharp fast. Bring composure."
        }
    }

    static func difficultyBehaviour(_ d: Difficulty) -> String {
        switch d {
        case .gentle:
            return "You are receptive but genuinely affected. You ask honest questions, admit some fault, and can be moved by a well-made point. You still need to feel respected."
        case .steady:
            return "You are defensive and self-protective. You minimize ('it's not that bad'), deflect ('what about when you...'), change the subject, and only soften if the user stays specific, calm and concrete. You do not concede easily."
        case .challenging:
            return "You are hurt and reactive. You interrupt the logic, use blame and absolutes ('you always', 'you never'), bring up old grievances, and may threaten to end the conversation. You never swear or become abusive. You only de-escalate if the user stays composed, validates your feeling, and repeats their point without matching your heat."
        }
    }

    static func reactionBehaviour(_ r: ReactionPattern) -> String {
        switch r {
        case .defensive:
            return "You get defensive quickly. You protect your intentions, justify yourself, and turn responsibility back unless the user stays specific and non-accusing."
        case .hearsCriticism:
            return "You hear even neutral statements as criticism. You look for what's wrong with what the user said, but you're not loud — just wounded and correcting."
        case .minimizes:
            return "You minimize the issue. You say it's not that bad, it happens to everyone, or make it smaller than it is. You only stop minimizing if the user stays calm and specific."
        case .quiet:
            return "You go quiet and withdrawn under pressure. You answer in short sentences, look away, and only open up when the user slows down and invites you in."
        case .louder:
            return "You get louder when pushed. You interrupt, escalate, and use absolutes. You calm only when the user matches your energy with steadiness."
        case .turnsBack:
            return "You turn the conversation back on the user. You bring up their flaws, change the subject to their behavior, and only drop it when they refuse to take the bait."
        case .agreesWithoutChanging:
            return "You agree quickly to end the conversation, then change nothing. You nod, apologize, and deflect follow-up. The user has to pin down a concrete next step."
        case .notSure:
            return "You react the way a real ambivalent person would: a mix of defensive, quiet, and minimizing. You are uncertain and need the user to be clearer than you are."
        }
    }

    static func reactionLabel(_ r: ReactionPattern) -> String {
        switch r {
        case .defensive: return "They get defensive"
        case .hearsCriticism: return "They hear criticism in everything"
        case .minimizes: return "They minimize it"
        case .quiet: return "They go quiet"
        case .louder: return "They get louder"
        case .turnsBack: return "They turn it back on me"
        case .agreesWithoutChanging: return "They agree, then nothing changes"
        case .notSure: return "I'm not sure"
        }
    }

    static let scenarios: [Scenario] = [
        Scenario(
            id: "chores", category: .partner,
            title: "Ask for a fair split of the housework",
            counterpart: "Sam — your partner of four years",
            situation: "The user has been carrying most of the cooking, laundry and admin for months. They have hinted at it before and nothing changed. Tonight the kitchen is a mess again.",
            persona: "Sam works long hours and believes they contribute plenty. Sam feels criticized quickly and reaches for a scoreboard of their own contributions.",
            goal: "Get a specific, agreed change in who does what — not just an apology.",
            openingLine: "(barely looking up from their phone) Hey. I'll deal with the kitchen tomorrow, I swear.",
            minutes: 7, isCustom: nil
        ),
        Scenario(
            id: "intimacy", category: .partner,
            title: "Say you feel lonely in the relationship",
            counterpart: "Alex — your partner",
            situation: "They live parallel lives: phones, separate rooms, no real conversation in weeks. The user feels lonely and is scared saying it will sound like an accusation.",
            persona: "Alex is not cruel, but hears 'you're failing me' in anything vulnerable and responds with logistics and busyness.",
            goal: "Be honest about the loneliness without it turning into a fight about who is busier.",
            openingLine: "(sitting down) You sounded serious on the phone. What's up?",
            minutes: 8, isCustom: nil
        ),
        Scenario(
            id: "wedding-money", category: .partner,
            title: "Talk about the money you've been avoiding",
            counterpart: "Jordan — your partner",
            situation: "There is debt neither of them mentions. The user found a statement and needs to open the topic without shaming them.",
            persona: "Jordan is embarrassed and covers it with jokes, then irritation. Shame makes them shut down.",
            goal: "Get the real numbers on the table and agree to look at them together this week.",
            openingLine: "(laughing) Okay, why do you look like you're about to fire me?",
            minutes: 8, isCustom: nil
        ),
        Scenario(
            id: "mother-boundary", category: .family,
            title: "Set a boundary with your mother",
            counterpart: "Your mom",
            situation: "She drops by unannounced, comments on the user's home and choices, and calls daily. The user loves her and dreads hurting her.",
            persona: "Warm, anxious, and fluent in guilt. She uses her own sacrifices as leverage and may cry. She is not a villain — she is scared of losing closeness.",
            goal: "Ask her to call before visiting, and hold it when she gets hurt.",
            openingLine: "(cheerful) I brought you soup! Don't say I never think of you. Now, when are you going to do something about that hallway?",
            minutes: 8, isCustom: nil
        ),
        Scenario(
            id: "sibling-caregiving", category: .family,
            title: "Ask your brother to share the caregiving",
            counterpart: "Chris — your older brother",
            situation: "The user has done nearly all the hospital visits and paperwork for a parent. Chris lives forty minutes away and is always 'slammed'.",
            persona: "Chris genuinely believes he is doing his share and reacts to the ask as an attack on his character.",
            goal: "Leave with two specific things Chris will own, with dates.",
            openingLine: "(on speakerphone, distracted) Yep? Everything okay with Dad?",
            minutes: 7, isCustom: nil
        ),
        Scenario(
            id: "parent-comingclean", category: .family,
            title: "Tell your parents a truth they won't like",
            counterpart: "Your dad",
            situation: "The user is about to share something big — a breakup, a move, a career change — that goes against what he expected of them.",
            persona: "Controlled disappointment. He asks cross-examining questions and frames concern as logic.",
            goal: "Say it plainly, once, and not retreat into justifying yourself.",
            openingLine: "(putting the paper down) You said you wanted to talk. Go ahead.",
            minutes: 7, isCustom: nil
        ),
        Scenario(
            id: "raise", category: .work,
            title: "Ask for the raise you've earned",
            counterpart: "Priya — your manager",
            situation: "The user has taken on scope well beyond their title for a year. Budget season is closing this month.",
            persona: "Priya is friendly but budget-constrained. She reaches for 'timing', 'the band', and 'let's revisit next cycle' unless given concrete value and a number.",
            goal: "Name a specific number and get a commitment or a dated next step.",
            openingLine: "(smiling) Hey! I've only got fifteen — what did you want to cover?",
            minutes: 8, isCustom: nil
        ),
        Scenario(
            id: "burnout", category: .work,
            title: "Tell your boss you're burned out",
            counterpart: "Daniel — your director",
            situation: "The user is running on empty and has been quietly compensating for a short-staffed team. They are afraid of looking replaceable.",
            persona: "Daniel is well-meaning and overloaded. He hears burnout as a resourcing problem for next quarter and tries to reassure it away.",
            goal: "Get a concrete reduction in load this month, not sympathy.",
            openingLine: "(closing his laptop) You've got my full attention. What's going on?",
            minutes: 8, isCustom: nil
        ),
        Scenario(
            id: "feedback", category: .work,
            title: "Give hard feedback to someone you like",
            counterpart: "Maya — your teammate",
            situation: "Maya keeps missing handoffs and the user has been covering. They are friends outside work, which makes it harder.",
            persona: "Maya is sensitive to criticism, apologizes fast, then gets quiet and hurt. Over-apologizing is her way of ending the conversation early.",
            goal: "Be specific and kind, and land one agreed change.",
            openingLine: "(grinning) Uh oh, a meeting with no agenda. Am I in trouble?",
            minutes: 6, isCustom: nil
        ),
        Scenario(
            id: "quit", category: .work,
            title: "Resign without burning the bridge",
            counterpart: "Elena — your manager",
            situation: "The user has accepted another offer. Elena has invested in them and will take it personally.",
            persona: "Elena moves from shock to counter-offer to a guilt appeal about the team.",
            goal: "Deliver the decision as final, warmly, and agree a handover.",
            openingLine: "(sitting down) You've been quiet this week. What's on your mind?",
            minutes: 6, isCustom: nil
        ),
        Scenario(
            id: "friend-money", category: .friends,
            title: "Ask a friend for the money back",
            counterpart: "Tom — a close friend",
            situation: "Tom borrowed a meaningful amount eight months ago and has not mentioned it since. The user needs it and hates the awkwardness.",
            persona: "Tom is embarrassed and deflects with humour, then vague promises. He gets cool if he feels judged.",
            goal: "Get a real date and amount agreed, and keep the friendship.",
            openingLine: "(cheerful) Mate! Long time. Are we doing Friday or what?",
            minutes: 6, isCustom: nil
        ),
        Scenario(
            id: "friend-drift", category: .friends,
            title: "Name the distance that's grown between you",
            counterpart: "Nadia — your oldest friend",
            situation: "Something changed a year ago and neither has said it. Plans get cancelled. The user misses her and feels stupid for caring.",
            persona: "Nadia is guarded about her own life and keeps it light. She only opens up if the user goes first and stays warm.",
            goal: "Say you miss her and find out what actually happened.",
            openingLine: "(hugging you) Okay, this is nice, we never do this. How are you?",
            minutes: 7, isCustom: nil
        ),
    ]

    static func scenariosFor(_ category: CategoryId) -> [Scenario] {
        scenarios.filter { $0.category == category }
    }
}
