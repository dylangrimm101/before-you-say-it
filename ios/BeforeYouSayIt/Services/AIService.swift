import Foundation

nonisolated struct CounterpartTurn: Sendable {
    let reply: String
    let tension: Int
    let nudge: String
}

nonisolated struct DrillRoundFeedback: Sendable {
    let score: Int
    let feedback: String
    let better: String
}

nonisolated enum AIError: Error, LocalizedError {
    case requestFailed(Int)
    case emptyResponse
    case unreadable

    var errorDescription: String? {
        switch self {
        case .requestFailed(let code): return "AI request failed (\(code))"
        case .emptyResponse: return "Empty AI response"
        case .unreadable: return "Could not read the AI response"
        }
    }
}

/** Chat + transcription against the Rork Toolkit proxy. */
nonisolated enum AIService {
    private static var base: String { Config.EXPO_PUBLIC_TOOLKIT_URL }
    private static var key: String { Config.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY }

    /** Fast, expressive model for live in-character replies. */
    private static let roleplayModel = "google/gemini-3.6-flash"
    /** Careful reasoner for the structured post-session debrief. */
    private static let debriefModel = "anthropic/claude-sonnet-5"

    private struct ChatRequestMessage: Encodable {
        let role: String
        let content: String
    }

    private struct ChatResponse: Decodable {
        struct Choice: Decodable {
            struct Message: Decodable { let content: String? }
            let message: Message?
        }
        let choices: [Choice]?
    }

    private static func chat(
        model: String,
        messages: [(role: String, content: String)],
        maxTokens: Int
    ) async throws -> String {
        guard let url = URL(string: "\(base)/v2/vercel/v1/chat/completions") else {
            throw AIError.requestFailed(0)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "model": model,
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "temperature": 0.9,
            "max_tokens": maxTokens,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw AIError.requestFailed((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        let decoded = try JSONDecoder().decode(ChatResponse.self, from: data)
        guard let content = decoded.choices?.first?.message?.content, !content.isEmpty else {
            throw AIError.emptyResponse
        }
        return content
    }

    private static func extractJson(_ raw: String) -> [String: Any]? {
        let cleaned = raw
            .replacingOccurrences(of: "```json", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let start = cleaned.firstIndex(of: "{"), let end = cleaned.lastIndex(of: "}") else {
            return nil
        }
        let slice = String(cleaned[start ... end])
        guard let data = slice.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func clamp(_ n: Any?) -> Int {
        let v: Double
        if let d = n as? Double { v = d } else if let i = n as? Int { v = Double(i) } else { return 50 }
        return Int(min(100, max(0, v)).rounded())
    }

    private static func rolePrompt(
        scenario: Scenario,
        difficulty: Difficulty,
        reaction: ReactionPattern?,
        outcome: String?
    ) -> String {
        let reactionLine = reaction.map { "HOW YOU TEND TO REACT: \(ScenarioLibrary.reactionBehaviour($0))" } ?? ""
        let outcomeLine = (outcome?.isEmpty == false)
            ? "WHAT THE OTHER PERSON WANTS FROM YOU (and what you want to practice): \(outcome ?? "")"
            : "WHAT THE OTHER PERSON WANTS FROM YOU: \(scenario.goal)"

        return [
            "You are playing a single character in a private rehearsal so a person can practice a difficult real-life conversation. This is a safe simulation, not real life.",
            "",
            "YOUR CHARACTER: \(scenario.counterpart)",
            "THE SITUATION: \(scenario.situation)",
            "WHO YOU ARE: \(scenario.persona)",
            "YOUR CURRENT STANCE (\(ScenarioLibrary.difficultyLabel(difficulty))): \(ScenarioLibrary.difficultyBehaviour(difficulty))",
            reactionLine,
            outcomeLine,
            "",
            "RULES",
            "- You are American. Speak natural, contemporary American English (US spelling and idiom) at all times.",
            "- NEVER use British, Irish, or Australian words or idioms. Banned examples: mate, bloke, cheers, reckon, brilliant, lovely, proper, whilst, keen on, fancy, sod, bugger, chuffed, gutted, take the mick, have a go, sorted, dodgy, bloody, innit, mum, flat, holiday (meaning vacation), queue, rubbish, uni, telly, bin, quid, fortnight, straight away.",
            "- Use American equivalents instead: buddy/man/dude, awesome, really, while, into, mom, apartment, vacation, line, trash, college, TV, right away.",
            "- Speak only as your character. Never coach, never narrate, never mention AI or practice.",
            "- Keep every reply to 1-3 short spoken sentences. Real people interrupt themselves and trail off.",
            "- You may open a reply with one short physical beat in parentheses, e.g. \"(sighs)\". At most one.",
            "- React to what was actually just said. Reward specificity, calm and ownership by softening a little. Punish vagueness, blame and over-apologizing by staying stuck.",
            "- Never resolve everything at once. Real change is incremental.",
            "- Never become abusive, sexual, or use slurs. No self-harm content. If the user raises a genuine crisis or danger, drop the roleplay and gently tell them to reach real-world support.",
            "",
            "Reply ONLY with minified JSON in exactly this shape:",
            "{\"reply\":\"what your character says\",\"tension\":0-100,\"nudge\":\"optional <=90 char coaching tip for the user, or empty string\"}",
            "\"tension\" is how charged the room is right now. \"nudge\" should be present only when the user just made a real mistake or missed a clear opening — otherwise use \"\".",
        ]
        .filter { !$0.isEmpty || $0 == "" }
        .joined(separator: "\n")
    }

    /** Generate the counterpart's next line, the room's tension and an optional coach nudge. */
    static func nextCounterpartTurn(
        scenario: Scenario,
        difficulty: Difficulty,
        turns: [Turn],
        reaction: ReactionPattern?,
        outcome: String?
    ) async throws -> CounterpartTurn {
        var messages: [(role: String, content: String)] = [
            ("system", rolePrompt(scenario: scenario, difficulty: difficulty, reaction: reaction, outcome: outcome)),
        ]
        for t in turns {
            if t.role == .user {
                messages.append(("user", t.text))
            } else {
                messages.append(("assistant", "{\"reply\":\"\(t.text.replacingOccurrences(of: "\"", with: "'"))\"}"))
            }
        }

        let raw = try await chat(model: roleplayModel, messages: messages, maxTokens: 400)
        if let parsed = extractJson(raw), let reply = parsed["reply"] as? String, !reply.isEmpty {
            return CounterpartTurn(
                reply: reply.trimmingCharacters(in: .whitespacesAndNewlines),
                tension: clamp(parsed["tension"]),
                nudge: (parsed["nudge"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            )
        }
        return CounterpartTurn(reply: String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(400)), tension: 50, nudge: "")
    }

    /** Score the rehearsal and produce a usable script for the real conversation. */
    static func generateDebrief(
        scenario: Scenario,
        difficulty: Difficulty,
        turns: [Turn],
        reaction: ReactionPattern?,
        outcome: String?
    ) async throws -> Debrief {
        let transcript = turns
            .map { "\($0.role == .user ? "USER" : "THEM"): \($0.text)" }
            .joined(separator: "\n")

        let system = [
            "You are an exacting but warm American communication coach reviewing a rehearsal transcript. You coach like a great therapist crossed with a negotiation trainer: specific, kind, never generic.",
            "Write in natural American English (US spelling and idiom). Never use British or Australian words like mate, whilst, reckon, brilliant, keen, proper or sorted.",
            "Score 0-100 on clarity (did they say the actual ask), empathy (did the other person feel seen), assertiveness (did they hold the ask under pressure) and composure (did they stay regulated).",
            "Be honest — most first attempts score 40-70. Quote the user's real words.",
            "Reply ONLY with minified JSON:",
            "{\"headline\":\"one sentence verdict, <=90 chars\",\"scores\":{\"clarity\":n,\"empathy\":n,\"assertiveness\":n,\"composure\":n},\"wins\":[\"2-3 specific things that worked\"],\"flags\":[{\"quote\":\"their exact words\",\"issue\":\"what it cost them, <=90 chars\",\"reframe\":\"a better line they could say instead\"}],\"script\":[\"3 short lines they can actually use in the real conversation\"],\"nextRep\":\"one sentence on what to practice next time\"}",
            "Include 2-3 flags. If the transcript is very short, say so in the headline and score accordingly.",
        ].joined(separator: "\n")

        var userParts: [String] = [
            "SCENARIO: \(scenario.title)",
            "THEY WERE TALKING TO: \(scenario.counterpart)",
            "GOAL: \(scenario.goal)",
            "DIFFICULTY: \(ScenarioLibrary.difficultyLabel(difficulty))",
        ]
        if let reaction { userParts.append("PRACTICED REACTION: \(ScenarioLibrary.reactionBehaviour(reaction))") }
        if let outcome, !outcome.isEmpty { userParts.append("DESIRED OUTCOME: \(outcome)") }
        userParts.append("")
        userParts.append("TRANSCRIPT:")
        userParts.append(transcript)

        let raw = try await chat(
            model: debriefModel,
            messages: [("system", system), ("user", userParts.joined(separator: "\n"))],
            maxTokens: 1600
        )

        guard let parsed = extractJson(raw), let scores = parsed["scores"] as? [String: Any] else {
            throw AIError.unreadable
        }

        let flags: [Flag] = ((parsed["flags"] as? [[String: Any]]) ?? []).prefix(3).map {
            Flag(
                quote: $0["quote"] as? String ?? "",
                issue: $0["issue"] as? String ?? "",
                reframe: $0["reframe"] as? String ?? ""
            )
        }

        return Debrief(
            headline: parsed["headline"] as? String ?? "Rehearsal complete.",
            scores: Scores(
                clarity: clamp(scores["clarity"]),
                empathy: clamp(scores["empathy"]),
                assertiveness: clamp(scores["assertiveness"]),
                composure: clamp(scores["composure"])
            ),
            wins: Array(((parsed["wins"] as? [String]) ?? []).prefix(4)),
            flags: flags,
            script: Array(((parsed["script"] as? [String]) ?? []).prefix(4)),
            nextRep: parsed["nextRep"] as? String ?? ""
        )
    }

    /** Turn a messy plain-text description into a structured, playable scenario. */
    static func buildCustomScenario(
        description: String,
        category: CategoryId,
        reaction: ReactionPattern?,
        outcome: String?
    ) async throws -> Scenario {
        let system = [
            "You turn a person's description of a difficult conversation they need to have into a playable rehearsal scenario.",
            "Write everything in natural American English (US spelling and idiom) with American names. The opening line must sound like a real American speaking — never use British or Australian idiom such as mate, whilst, reckon, brilliant, keen, proper, sorted or cheers.",
            "Reply ONLY with minified JSON:",
            "{\"title\":\"short imperative title <=48 chars\",\"counterpart\":\"name or role — relationship, <=48 chars\",\"situation\":\"2-3 sentences of context in third person about 'the user'\",\"persona\":\"2-3 sentences on how this person behaves under pressure\",\"goal\":\"one concrete outcome the user wants\",\"openingLine\":\"the first thing the other person says, may start with one short (beat), <=140 chars\"}",
            "Infer a plausible name if none is given. Keep it grounded and specific to what they wrote.",
        ].joined(separator: "\n")

        var userParts: [String] = ["Relationship area: \(category.rawValue)"]
        if let reaction { userParts.append("How they tend to react: \(ScenarioLibrary.reactionBehaviour(reaction))") }
        if let outcome, !outcome.isEmpty { userParts.append("Desired outcome: \(outcome)") }
        userParts.append("What they wrote:\n\(description)")

        let raw = try await chat(
            model: debriefModel,
            messages: [("system", system), ("user", userParts.joined(separator: "\n"))],
            maxTokens: 700
        )

        guard let parsed = extractJson(raw), let title = parsed["title"] as? String else {
            throw AIError.unreadable
        }

        return Scenario(
            id: "custom-\(UUID().uuidString.prefix(8))",
            category: category,
            title: title,
            counterpart: parsed["counterpart"] as? String ?? "The other person",
            situation: parsed["situation"] as? String ?? description,
            persona: parsed["persona"] as? String ?? "Defensive when they feel criticized.",
            goal: parsed["goal"] as? String ?? (outcome?.isEmpty == false ? outcome! : "Say the thing clearly and hold it."),
            openingLine: parsed["openingLine"] as? String ?? "So… what did you want to talk about?",
            minutes: 7,
            isCustom: true
        )
    }

    /** Score a single drill round reply and offer a sharper alternative line. */
    static func drillRoundFeedback(
        skill: String,
        focus: String,
        theirLine: String,
        reply: String
    ) async throws -> DrillRoundFeedback {
        let system = [
            "You are a fast, encouraging American communication drill coach. The user is doing a 2-minute rep on one skill: \(skill).",
            "Write in natural American English (US spelling and idiom). Never use British or Australian words like mate, whilst, reckon, brilliant, keen, proper or sorted.",
            "They were told to practice: \(focus)",
            "Score their single reply 0-100 for how well it hits that focus. Be honest — typical replies land 40-75.",
            "Reply ONLY with minified JSON: {\"score\":n,\"feedback\":\"one specific sentence, <=110 chars\",\"better\":\"a sharper line they could say instead, <=140 chars\"}",
        ].joined(separator: "\n")

        let raw = try await chat(
            model: roleplayModel,
            messages: [("system", system), ("user", "THEY SAID: \(theirLine)\nUSER REPLIED: \(reply)")],
            maxTokens: 300
        )

        let parsed = extractJson(raw)
        return DrillRoundFeedback(
            score: clamp(parsed?["score"]),
            feedback: (parsed?["feedback"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Solid rep — keep it specific and calm.",
            better: (parsed?["better"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        )
    }

    /** Transcribe a recorded audio clip using the Rork AI Gateway. */
    static func transcribeAudio(base64Audio: String, mediaType: String = "audio/mp4") async throws -> String {
        guard let url = URL(string: "\(base)/v2/vercel/v4/ai/transcription-model") else {
            throw AIError.requestFailed(0)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("openai/gpt-4o-mini-transcribe", forHTTPHeaderField: "ai-model-id")
        request.setValue("0.0.1", forHTTPHeaderField: "ai-gateway-protocol-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["audio": base64Audio, "mediaType": mediaType])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw AIError.requestFailed((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let text = (json?["text"] as? String) ?? (json?["transcript"] as? String) ?? (json?["content"] as? String) ?? ""
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw AIError.emptyResponse }
        return trimmed
    }
}
