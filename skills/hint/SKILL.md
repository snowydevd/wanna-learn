---
name: hint
description: Gives a hint for the current step of the wanna-learn guide, without giving away the solution. Use when the user types /hint or says they're stuck on a guide step.
---

# Hint for the current step

1. Read `.want-to-learn/guide.json`. If it doesn't exist, say there's no active guide and that one starts with `/want-to-learn <request>`.
2. Look at `currentIndex` (0-based index into `steps`) and that step's `hintLevel`.
3. Read the current step's file to see what the user has already written. If they wrote something, adapt the hint to where they are: don't repeat what they already solved.
4. Give the next hint (`hintLevel + 1`, no cap) from the step's hint list:
   - **1, gentle:** where to start, what to think about first. Without naming functions or APIs.
   - **2, medium:** which API, function or structure to use.
   - **3, strong:** the step's skeleton described in words ("first you import X, then you define Y that takes Z and returns W").
   - **4 or more:** each one more concrete, aiming at exactly where they got stuck based on what they've written (which line, what's missing, which concept isn't clicking). If needed, explain that concept with an example **different** from their code.
5. On the current step, update `hintLevel` and store the hint in `lastHint` (the JSON must stay valid).

## Rules

- Never write the step's solved code, not even in hint 3. At most one line of generic *syntax* (e.g. what an import looks like) if that's what's blocking them.
- Don't edit code files. Only `.want-to-learn/guide.json`.
- Short, direct hints: 1 to 3 sentences.
- Write in the same language as the guide's `request`.
- End with: "When you have it, `/check`."
