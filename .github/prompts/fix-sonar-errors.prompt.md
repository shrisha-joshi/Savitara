---
description: "Given a VS Code Problems panel dump, triage and fix every SonarQube/SonarLint warning in the Savitara project from the root cause. Handles project-code fixes, exclusion configs for external files, and prompt file maintenance."
agent: "agent"
---

# Fix All SonarQube / SonarLint Errors — Savitara Platform

You are a senior engineer doing a zero-tolerance SonarQube cleanup pass on the Savitara project. The user will paste (or attach) a list of errors from the VS Code Problems panel. Your job is to eliminate every warning — either by fixing the root cause in project code, or by configuring the right exclusion when the file is an external system file that cannot be edited. Do **not** suppress issues with `// NOSONAR` unless no code change is possible and the rule is a false positive.

---

## Inputs You Receive

1. **Errors list** — copied from VS Code Problems panel or attached as a screenshot/text.  
   Format: `<file path> (<line>) <rule code> <message>`
2. (Optional) The Savitara project structure for context.

---

## Step 0 — Triage: Project Files vs External Files

Before writing any code, split every error into two buckets:

| Bucket | Criteria | Action |
|---|---|---|
| **Project file** | Path is inside `<PROJECT_ROOT>` and is source code (not `node_modules`, `venv`, `.venv`) | Fix in source |
| **External / stdlib** | Path is outside the workspace, e.g. `scoop\apps\python313\`, `.vscode\extensions\`, `site-packages\`, `typeshed-fallback\` | Add to exclusion config |

For external files, update two configs (create if they don't exist):

**`.sonarlintignore`** (workspace root):
```
**/scoop/**
**/pyenv/**
**/AppData/**
**/.vscode/extensions/**
**/typeshed-fallback/**
**/site-packages/**
**/Lib/**
```

**`.vscode/settings.json`** (workspace root):
```json
{
  "sonarlint.analyzeOpenFiles": "onlyFilesInWorkspace"
}
```

---

## Step 1 — Fix Project-File Errors

Apply fixes in this priority order (earlier rules unblock later ones):

### S6774 — Missing PropTypes
- If a React component uses a prop but has no `MyComponent.propTypes`, add the full declaration.  
- Import PropTypes at the top: `import PropTypes from 'prop-types';`
- For components with a `booking`, `user`, or `acharya` shape prop, include every field actually used via destructuring or `.field` access.
- Common shapes in Savitara:
  ```js
  booking: PropTypes.shape({
    _id: PropTypes.string,
    status: PropTypes.string,
    scheduled_time: PropTypes.string,
    acharya: PropTypes.shape({ name: PropTypes.string }),
  })
  ```

### S6479 — Array Index as Key
- Replace `key={index}` inside `.map((item, index) => ...)` with a stable unique property.
- Prefer: `key={item.id}`, `key={item._id}`, `key={item.title}`, `key={item.name}`.
- If no unique field exists, create a composite: `key={`${item.type}-${item.name}`}`.

### S7781 — `String#replace()` with Regex → Use `replaceAll()`
- Change `.replace(/pattern/g, replacement)` to `.replaceAll('pattern', replacement)`.
- Replace a global regular expression that matches a literal string with `.replaceAll()` and a literal string.

### S7735 — Semantic Safe Null Checks
- Understand the exact semantic differences before converting:
  - `if (x !== null)` allows `undefined`, `0`, `""`, and `false`.
  - `if (x != null)` checks for both `null` and `undefined` safely, but allows `0`, `""`, and `false`.
  - `if (x)` checks for truthiness, rejecting `null`, `undefined`, `0`, `""`, and `false`.
- Only convert `!== null` to `if (x)` when you are certain variables cannot be other falsy values.
- Examples of conversions:
  - Safe to use `if (contextMenu)` if it's an object/array.
  - Keep `if (count !== null)` or use `if (count != null)` when `count` can be `0`.
  - Keep `if (name !== null)` or use `if (name != null)` when `name` can be `""`.

### S3358 — Nested Ternary
- Convert 3-level ternary to an `if/else if/else` block.
- For JSX render branches, extract to a named helper function outside the component:
  ```jsx
  // Extract BEFORE the component definition
  function renderMessageContent(msg, isMe) {
    if (msg.message_type === 'voice') return <VoiceMessagePlayer ... />;
    if (msg.message_type === 'image') return <Box component="img" ... />;
    if (msg.message_type === 'file') return <Box ...>...</Box>;
    return <Typography>{msg.content}</Typography>;
  }
  ```
- Call `{renderMessageContent(msg, isMe)}` inside the JSX. **Do not use an IIFE** — it creates an extra nesting level and triggers S2004.

### S2004 — Functions Nested More Than 4 Levels Deep
- Count nesting levels: `component function` → `event handler` → `async callback` → `array method callback` → ... Rule fires at level 4+.
- Fix strategies (in order of preference):
  1. **Replace `forEach(item => {...})` with `for...of`** — a `for...of` loop is a statement, not a function, so it does not add a nesting level.
  2. **Extract the callback to a named `useCallback`** at the component level (one level up from the effect).
  3. **Extract to a module-level pure function** (before the component) for logic that doesn't need `useState`/`useRef`.
- **Never** use an IIFE as a fix for nested ternaries — it makes nesting worse.

### S3776 — Cognitive Complexity Exceeds Threshold
- SonarQube's threshold is typically 15. The chat component's `useEffect` bodies are the main culprits.
- Fix: extract the body of a complex `useEffect` or event handler into a named `useCallback`:
  ```js
  const fetchChatData = useCallback(async () => {
    // moved from inside useEffect
  }, [conversationId, recipientId, navigate]);

  useEffect(() => {
    if (user) fetchChatData();
  }, [fetchChatData, user]);
  ```
- For deeply complex components, extract sub-render logic into module-level functions (see S3358 fix pattern above).

### S7504 — Unnecessary `list()` Call / Other False Positives
- When the rule IS a false positive and there is genuinely no code-level fix possible:
  ```python
  for key in list(doc.keys()):  # NOSONAR
  ```
- Add an inline comment `# NOSONAR` (Python) or `// NOSONAR` (JS/TS). Document why it's a false positive in the same comment.

---

## Step 2 — Fix Prompt / Config Files

### `.github/prompts/*.prompt.md` — Unknown Tool Names
- Remove the `tools:` key from the YAML frontmatter. Valid keys are `description`, `agent`, `name`.
- Invalid:
  ```yaml
  tools: [read_file, replace_string_in_file]
  ```
- Remove the `tools:` line entirely.

### `.github/prompts/*.prompt.md` — Broken File Links
- Markdown links in `.prompt.md` files resolve relative to the **file's own directory** (`.github/prompts/`).
- Links to workspace files from `.prompt.md` must use `../../` relative paths or be written as plain text to avoid broken-link validation errors.
- **Fix**: Replace markdown links with plain-text backtick references:
  ```
  <!-- BEFORE — markdown link VS Code resolves relative to .github/prompts/ -->
  backend/app/api/v1/bookings.py  (written as a markdown link with that path)

  <!-- AFTER — plain text, no broken reference -->
  `backend/app/api/v1/bookings.py`
  ```

---

## Step 3 — Verify

After all fixes:

1. Run `get_errors` on every modified file and confirm zero SonarLint errors.
2. For React files: confirm no `import` statement is now missing (PropTypes, useCallback, etc.).
3. For extracted `useCallback` functions: confirm their `deps` array is complete (include every state/prop/ref used inside).
4. For `for...of` replacements: confirm the loop variable name matches what was used inside the forEach callback.
5. For Python `# NOSONAR`: confirm the line still works correctly at runtime (the fix was NOT to accidentally break the code).

---

## Savitara-Specific Context

- **Chat.jsx** (`savitara-web/src/pages/chat/Chat.jsx`): Has the highest complexity. Key extractions: `renderMessageContent` (module-level), `fetchChatData` (useCallback), `handleSocketMessage` (useCallback).
- **SocketContext.jsx** (`savitara-web/src/context/SocketContext.jsx`): WebSocket handler has `ws.onopen → forEach → if` which hits 4-level nesting. Fix with `for...of`.
- **CascadingLocationSelect.jsx** (`savitara-web/src/components/CascadingLocationSelect.jsx`): 9 PropTypes required; uses `.replace()` on regex that needs `.replaceAll()`.
- **Python stdlib files** (`typing.py`, `builtins.pyi`): SonarLint analyses these when Pylance opens them for type navigation. They are NOT project files. Suppress via `.sonarlintignore` and `.vscode/settings.json` — never attempt to edit these.
- **bookings.py** (`backend/app/api/v1/bookings.py`): `list(doc.keys())` is intentional (prevents RuntimeError during iteration). Mark with `# NOSONAR`.

---

## Output Format

For each fixed file, produce:
1. A brief sentence: what rule was fixed and how.
2. The exact code diff (old → new), not the entire file.

For exclusion-config changes:
1. State which external file paths triggered the warning.
2. Show the added lines in `.sonarlintignore` / `.vscode/settings.json`.

End with a **summary table**:

| File | Rule | Fix |
|---|---|---|
| `Chat.jsx` | S2004 (line 756) | Avoided IIFE/excessive nesting by extracting to `renderMessageContent()` (S2004) |
| `SocketContext.jsx` | S2004 (line 216) | Replace `forEach` → `for...of` |
| ... | ... | ... |
