# Want to learn

Learn while you build. Tell Claude what you want to add to your project, and instead of writing it for you, it builds a step-by-step guide. You write the code; Claude explains, gives hints and reviews it before you move on.

## How it works

1. Open the **Want to learn** panel (graduation cap icon in the activity bar) and describe what you want to build.
2. Claude reads your project and builds a guide of small steps. Each step tells you which file to edit, where, what the code has to achieve, and explains new concepts with links to the official docs.
3. Write the code yourself. The line where you should write is highlighted in the editor.
4. Stuck? **💡 Hint** gives a hint that gets more concrete each time you ask, without giving away the solution. **❓ Ask** answers any question about the step.
5. **✓ Check my code** reviews what you wrote. If it's right, you move to the next step; if not, it points to the file and line and explains what's wrong without rewriting it.

Claude replies in the language you write your request in.

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and logged in (`claude /login`). The extension runs it with read-only tools, using your own account: Claude never edits your code.
- A project folder open in the workspace.

## Settings

| Setting | Default | Description |
|---|---|---|
| `wantToLearn.claudePath` | `claude` | Path or name of the Claude Code executable. |
| `wantToLearn.model` | empty | Model for Claude (empty = the CLI default). |
| `wantToLearn.timeoutSeconds` | `300` | Maximum time to wait for a Claude response. |

## Notes

- The guide is saved to `.want-to-learn/guide.json` in the first workspace folder. Add `.want-to-learn/` to your `.gitignore`.
- The same guide works with the `want-to-learn` Claude Code plugin (`/want-to-learn`, `/hint`, `/check`), so you can switch between the terminal and the panel.
