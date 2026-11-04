---
name: check
description: Reviews the code the user wrote for the current step of the wanna-learn guide and, if it's right, moves on to the next step. Use when the user types /check or says they finished a guide step.
---

# Check the current step

1. Read `.want-to-learn/guide.json`. If it doesn't exist, say there's no active guide and that one starts with `/want-to-learn <request>`.
2. Find the step `steps[currentIndex]` and read its file, goal and review criteria. If it's a `create-file` step, only verify that the file exists.
3. Read the code the user wrote. If the project has cheap, relevant checks (typecheck, lint for the file), you can run them to confirm, but don't modify anything.
4. Evaluate against the step's criteria. Be strict about anything that breaks behavior; flexible about style. If they solved it differently in a way that also works and follows the project's conventions, **that's fine**: tell them so and, if worthwhile, mention the alternative as an aside.

## If it's right

- Say what they did well, concretely (1 to 3 lines).
- If there's something minor that could be better but doesn't block, mention it as an optional suggestion.
- In `guide.json`: on the step, `done: true` and `lastReview` with the result; add 1 to `currentIndex` and set `hintLevel: 0` on the next step. The JSON must stay valid.
- Show the next step using the "How to show a step" format from the `want-to-learn` skill.
- If it was the last step: congratulate them, summarize in 3 to 5 lines what they learned (the concepts that came up) and suggest how to try the change working. Mark the guide finished (`finished: true`, `currentIndex` = number of steps) and store the summary in `summary`.

## If it needs changes

- Point out each problem with file and line, and explain **why** it's wrong (what would happen when it runs).
- Say what has to change in terms of behavior, without writing the corrected code.
- If the mistake comes from not understanding a concept, explain the concept again in a different way.
- Store the result in the step's `lastReview`, without advancing `currentIndex`. End with: "Fix it and type `/check` again."

## Rules

- Don't edit code files, even if the fix is one character. Only `.want-to-learn/guide.json`.
- Don't show the step's full solution.
- Write in the same language as the guide's `request`.
