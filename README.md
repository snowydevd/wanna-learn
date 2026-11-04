<div align="center">

# 🎓 wanna-learn - This is how AI should be used

**Stop copy-pasting AI code. Learn to write it yourself.**

A Claude Code plugin and VS Code / Cursor extension that turns Claude into a tutor:
instead of making the change for you, it builds a step-by-step guide and **you** write the code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](extension/LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-D97757)](#claude-code-plugin)
[![VS Code extension](https://img.shields.io/badge/VS%20Code-extension-007ACC)](#vs-code--cursor-extension)

[How it works](#how-it-works) · [Install](#install) · [Usage](#usage) · [Development](#development) · [Contributing](#contributing)

</div>

---

## Why

AI coding assistants are great at writing code, but if they always write it for you, you never learn the codebase, the library or the concept behind it. **wanna-learn** keeps Claude's knowledge of your project and flips the roles:

- 🧭 **Claude plans**: it reads your project and splits the change into small, verifiable steps.
- ⌨️ **You write**: every line of code is yours. Claude never edits your files.
- 💡 **Claude helps when you're stuck**: hints that get more concrete each time, never the full solution.
- ✅ **Claude reviews**: you only move on when the step actually works.

It works in any language and framework Claude understands, and it replies in the language you write your request in.

## How it works

```
 "add photo uploads per event"
            │
            ▼
 ┌─────────────────────┐     reads your project: structure,
 │  Claude builds the  │ ◄── conventions, libraries, similar code
 │  guide (3–8 steps)  │
 └─────────────────────┘
            │   saved to .want-to-learn/guide.json
            ▼
 ┌─────────────────────┐
 │  Step N: file,      │   📍 where to write
 │  where, goal,       │   🎯 what the code must do
 │  new concepts       │   📚 new concepts + links to the docs
 └─────────────────────┘
            │
   you write the code ──► 💡 hint / ❓ ask (as many as you need)
            │
            ▼
 ┌─────────────────────┐   ✗ points to file:line and explains why,
 │   ✓ Check my code   │ ──  without rewriting it
 └─────────────────────┘
            │ ✓
            ▼
      next step … 🎉 summary of what you learned
```

Each step touches one file, has an outcome you can verify by reading the code, and introduces at most one or two new concepts, each one explained the first time it appears, with a link to the official documentation.

## Install

**Requirement:** [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and logged in (`claude /login`).

### Claude Code plugin

```bash
claude plugin marketplace add snowydevd/wanna-learn
claude plugin install want-to-learn@want-to-learn-local
```

### VS Code / Cursor extension

> Coming soon to the VS Code Marketplace. In the meantime, download the `.vsix` from the [latest release](https://github.com/snowydevd/wanna-learn/releases/latest) and install it:

```bash
code --install-extension want-to-learn-0.1.1.vsix     # or: cursor --install-extension …
```

Or build it from source:

```bash
git clone https://github.com/snowydevd/wanna-learn.git
cd wanna-learn/extension
npm install
npm run package
code --install-extension want-to-learn-0.1.1.vsix     # or: cursor --install-extension …
```

The extension calls your installed Claude Code (`claude -p`, your own account) with **read-only tools** (`Read`, `Grep`, `Glob`). Claude can't touch your code; only the extension writes the guide file.

## Usage

### In the terminal (plugin)

| Command | What it does |
|---|---|
| `/want-to-learn <request>` | Reads the project, builds the guide and shows step 1. |
| `/hint` | A hint for the current step. Each one is more concrete than the last, with no limit, and never the solution. |
| `/check` | Reviews your code. If it's right, moves to the next step; if not, explains what to fix. |

If another plugin uses the same command name, use the prefixed form: `/want-to-learn:hint`, `/want-to-learn:check`.

### In the editor (extension)

Open the **Wanna learn** panel (🎓 in the activity bar), describe what you want to build and click **Generate guide**. The steps appear as a timeline, and the line where you should write is highlighted in the editor.

| Button | What it does |
|---|---|
| 💡 **Hint** | Next hint for the current step. |
| ❓ **Ask** | Ask anything about the step: a concept, an API, an error. |
| ✓ **Check my code** | Reviews the step; problems link straight to the file and line. |
| 📄 **Create file** | Creates the empty file a step needs. |

**Settings**

| Setting | Default | Description |
|---|---|---|
| `wantToLearn.claudePath` | `claude` | Path or name of the Claude Code executable. |
| `wantToLearn.model` | *(CLI default)* | Model Claude uses. |
| `wantToLearn.timeoutSeconds` | `300` | Maximum time to wait for a Claude response. |

### Plugin and extension share the same guide

Progress lives in `.want-to-learn/guide.json` inside your project, so you can start a guide in the terminal, continue it in the editor, and pick it up in another session. Add `.want-to-learn/` to your project's `.gitignore`.

<details>
<summary>Guide file format</summary>

```json
{
  "version": 1,
  "request": "add photo uploads per event",
  "title": "Photo uploads",
  "overview": "A photos table, a mutation to save them and an upload button.",
  "currentIndex": 0,
  "finished": false,
  "steps": [
    {
      "id": 1,
      "kind": "code",
      "title": "Add the photos table",
      "file": "convex/schema.ts",
      "where": "inside defineSchema, after the events table",
      "anchor": { "text": "events: defineTable({" },
      "goal": "Define a photos table with eventId and storageId",
      "concepts": [{ "name": "defineTable", "explanation": "…", "docs": "https://docs.convex.dev/database/schemas" }],
      "criteria": ["…"],
      "hints": ["…", "…", "…"],
      "done": false,
      "hintLevel": 0
    }
  ]
}
```

`criteria` and `hints` are private: they're never shown to you, they only keep `/check` and `/hint` consistent. The full spec lives in [`skills/want-to-learn/SKILL.md`](skills/want-to-learn/SKILL.md).

</details>

## Project structure

```
.
├── .claude-plugin/          # plugin + marketplace manifests
├── skills/                  # the tutor itself: prompts Claude Code loads
│   ├── want-to-learn/       #   /want-to-learn: rules, guide format, step layout
│   ├── hint/                #   /hint
│   └── check/               #   /check
└── extension/               # VS Code / Cursor extension
    ├── src/
    │   ├── extension.ts     #   activation, commands, editor decorations
    │   ├── tutor.ts         #   generate / hint / ask / review / create file
    │   ├── claude/          #   prompts + `claude -p` runner
    │   ├── guide/           #   guide types, parsing and progress (pure)
    │   └── webview/         #   side panel rendering
    ├── media/               #   panel script, styles, icon
    └── test/                #   vitest suite
```

The extension bundles the plugin's `skills/` at build time and reuses the **Rules** section of `skills/want-to-learn/SKILL.md` as its system prompt, so both stay in sync.

## Development

```bash
cd extension
npm install
npm test            # vitest
npm run typecheck   # tsc
npm run build       # bundles to dist/ (esbuild) and copies ../skills
npm run package     # builds the .vsix
```

To try the extension without installing it, build it and launch an Extension Development Host:

```bash
npm run build && code --extensionDevelopmentPath="$PWD" /path/to/some/project
```

To try plugin changes locally:

```bash
claude plugin marketplace add /path/to/wanna-learn
claude plugin install want-to-learn@want-to-learn-local
# after editing the skills:
claude plugin marketplace update want-to-learn-local   # then restart the session
```

## Roadmap

- [ ] Publish the extension to the VS Code Marketplace and Open VSX.
- [ ] A `PreToolUse` hook that blocks Edit/Write outside `.want-to-learn/` while a guide is active, in case Claude ignores the no-editing rule in the terminal.
- [ ] Translated UI for the extension (the tutor already answers in your language).

Ideas and feedback are welcome in [Issues](https://github.com/snowydevd/wanna-learn/issues).

## Contributing

Contributions are welcome: bug reports, prompt improvements, UI polish, new ideas.

1. Fork the repo and create a branch: `git checkout -b feat/my-change`.
2. Make your change. If you touch the extension, add or update tests in `extension/test/` and run `npm test && npm run typecheck`.
3. If you change the guide format, update `skills/want-to-learn/SKILL.md`, `extension/src/guide/` and the extension prompts together: the plugin and the extension must read the same file.
4. Open a pull request describing what changed and why.

Tutor behavior lives in plain Markdown in `skills/`, so improving how Claude teaches doesn't require writing any code.

## License

[MIT](extension/LICENSE) © Lautaro Chinikiba
