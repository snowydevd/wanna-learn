# want-to-learn

A Claude Code plugin and VS Code / Cursor extension for learning while you build. Instead of making the changes for you, Claude builds a step-by-step guide and you write the code.

Claude replies in the language you write your request in.

## Claude Code plugin

| Command | What it does |
|---|---|
| `/want-to-learn <request>` | Reads the project, builds the guide and shows step 1 (file, where, goal, new concepts with links to the docs). |
| `/hint` | A hint for the current step. Each time you ask it gets a bit more concrete, with no limit. It never gives away the solution. |
| `/check` | Reviews your code. If it's right, it moves to the next step; if not, it explains what to fix without rewriting it. |

If another command has the same name, use the prefixed form: `/want-to-learn:hint`, `/want-to-learn:check`.

Progress is saved to `.want-to-learn/guide.json` in the project where you run Claude, so you can pick it up in another session. The VS Code extension uses the same file.

### Local install

```bash
claude plugin marketplace add ~/Documents/Projects/want-to-learn
claude plugin install want-to-learn@want-to-learn-local
```

After editing the skills: `claude plugin marketplace update want-to-learn-local` and restart the session.

## VS Code / Cursor extension

A "Want to learn" side panel (the graduation cap icon in the activity bar): you type your request, Claude builds the guide and you see the steps as a timeline. The current step shows where to write, the goal and the new concepts, with **💡 Hint**, **❓ Ask**, **✓ Check my code** and **📄 Create file** buttons. Hint, answer and review cards collapse with the arrow. The line where you should write is highlighted in the editor.

The extension uses your installed Claude Code (`claude -p`, your same account) with read-only tools: Claude never edits your code; only the extension writes `guide.json`.

```bash
cd extension
npm install
npm test               # tests
npm run package        # builds want-to-learn-<version>.vsix
code --install-extension want-to-learn-0.1.0.vsix --force
cursor --install-extension want-to-learn-0.1.0.vsix --force
```

Settings: `wantToLearn.claudePath` (default `claude`), `wantToLearn.model` (empty = the CLI default), `wantToLearn.timeoutSeconds` (default 300).

The guide goes in the first workspace folder. Add `.want-to-learn/` to the project's `.gitignore`.

## Next

- If Claude ignores the no-editing rule in the terminal, add a `PreToolUse` hook that blocks Edit/Write outside `.want-to-learn/` while a guide is active.
