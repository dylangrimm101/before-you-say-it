export const DAILY_MOTIVATIONS: readonly string[] = [
  "You do not need perfect words. You need one honest first sentence.",
  "A few minutes of practice can make the opening feel more familiar.",
  "Clarity starts by saying the part you usually circle around.",
  "You can be direct and still sound like yourself.",
  "Practice the moment, not the whole conversation.",
  "One clear sentence is enough to begin.",
  "You are not rehearsing perfection. You are building readiness.",
  "Start with what is true, specific, and yours to say.",
  "A steady opening gives the conversation somewhere to go.",
  "The words get easier to reach after you say them out loud.",
  "Today’s rep is a private place to find your footing.",
  "Small practice makes a hard moment less unfamiliar.",
  "Say the important part before you polish the rest.",
  "You can pause, breathe, and begin with one clear ask.",
  "A useful conversation can start with an imperfect sentence.",
  "Give yourself one rep before the real moment asks for it.",
  "Your goal today is not certainty. It is a clearer next move.",
  "Name what matters, then let the other person respond.",
  "The first sentence only needs to open the door.",
  "Speaking it once here can help you hear what you mean.",
  "Take the pressure off the outcome and practice the opening.",
  "You can keep your point without rushing the moment.",
  "One thoughtful attempt is progress you can feel today.",
  "Make the ask answerable, then leave room for an answer.",
  "Your words can be both kind and unmistakably clear.",
  "Begin where your voice usually gets quiet.",
  "A short, specific sentence can carry a lot of courage.",
  "Practice gives you room to change the words before they count.",
  "You already know what matters. Today, practice saying it.",
  "Let one clear sentence do less work—and do it well.",
  "You can enter the conversation without having every answer.",
];

/** Returns one stable quote for the device's local calendar day. */
export function dailyMotivation(date: Date): string {
  const localDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = Math.floor(localDay / 86_400_000);
  return DAILY_MOTIVATIONS[dayNumber % DAILY_MOTIVATIONS.length] ?? DAILY_MOTIVATIONS[0]!;
}
