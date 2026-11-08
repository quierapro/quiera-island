# AI agents on the island

Quiera shows what an AI coding agent is doing, says when it waits for you or has finished, lets you allow or deny what it asks (with the code of a change), answer its questions, open the files and pages it worked on, see how much of your plan's usage limits is used, and bring its window back in one click. Claude Code is supported out of the box. Any agent that can run a command at each step of its work can be connected the same way.

## Claude Code

Settings › AI agents › Claude Code. The island also offers it, once, the first time it sees Claude Code running.

Quiera adds its hooks to `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`):

- it keeps the file as it was once, in `settings.json.quiera-backup`;
- it leaves your own settings and hooks alone, in their order;
- turning the setting off removes Quiera's hooks, and only those.

Quiera also sets Claude Code's status line, only if you have none of your own. Claude Code passes it the usage of your plan's limits (5 hours, week), which the island shows as rings. It prints nothing, so Claude Code looks as before.

Sessions already open pick the hooks up when they are restarted.

| Event | What the island does |
| --- | --- |
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse` | The pill: "Editing auth.ts · 4 min" |
| `PermissionRequest` | Asks you on the island, with its buttons |
| `Notification` (`permission_prompt`) | The pill turns orange: it waits for you in the terminal |
| `PermissionRequest` (`AskUserQuestion`) | Shows the question and its options; your pick goes back to Claude |
| `PermissionRequest` (`Edit`, `Write`) | Shows the lines removed and added |
| `PermissionRequest` (`ExitPlanMode`) | Shows the plan to approve |
| `Stop`, `StopFailure` | A peek: done, or stopped on an error |
| `SessionStart`, `SessionEnd` | The session joins or leaves the Agents tab |

### Permissions

Every permission is held for the island, which asks you instead of the terminal. Terminal sends it back to the agent's own window (the terminal, VS Code). If nobody answers for 30 minutes, the question goes back to the terminal too. Deny sends Claude the message "The user denied this from the Quiera island.", and Claude goes on with something else. Settings › AI agents › "Allow or deny from the island" turns this off: the island then only shows that Claude waits.

### Answers

- **Always** appears when Claude Code offers its own "don't ask again" rules: Quiera sends them back with the answer, as the terminal would.
- **Risky commands** (deleting folders, forced pushes, `git reset --hard`, dropping tables, piping a download into a shell…) show in red, and Allow must be held for a moment. They are never offered "Always", and never allowed from a phone.
- **Questions** can be answered by picking options, or by typing an answer ("Another answer"): the island takes the keyboard while you type, and gives it back after.

### Sound

A Windows notification sound plays when an agent is done or waits for you, never in Do Not Disturb. Settings › AI agents turns it off.

### Steps

Hovering a session in the Agents tab shows its latest steps: the files read or changed, the pages read, the searches and commands. Files, pages and searches open in one click. A step that failed shows in red.

### Usage limits

- **Claude**: the five-hour and weekly limits of a Pro or Max plan, from the status line.
- **Codex**: the limits of your plan, read from Codex's own session records (`~/.codex/sessions`). Only their numbers are read.

Settings › AI agents › "Show the AIs' usage limits" turns this off.

## Codex

Settings › AI agents › Codex adds Quiera's hooks to `~/.codex/hooks.json` (or `$CODEX_HOME/hooks.json`): `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`, `SessionEnd`. Codex runs them through PowerShell on Windows. Codex asks to trust new hooks once: open Codex, type `/hooks`, then trust them. Codex takes a plain allow or deny: no "Always", no answers to questions.

## From the phone

Settings › AI agents › "Answer from your phone" shows a QR code. On the same Wi-Fi, the phone's page lists the permissions waiting, refreshed every two seconds, with Allow and Deny. The link works for 8 hours, only with its random token; it stops at once with "Unlink the phone". Risky commands, questions and plans are answered on the PC. The page has to stay open (it is not a push notification); on Android it vibrates on each new request.

## Starting an agent

In the launcher (Alt+Space), type `claude` or `codex` then a task: a new terminal opens with the agent working on it, in the folder of that agent's latest session (else your user folder).

## Any other agent

Run this command at each step, with one JSON object on stdin, in Claude Code's hook format:

```
"C:\Users\<you>\AppData\Local\Quiera\quiera.exe" --agent-event <agent-name>
```

- The command always exits 0 at once, with or without Quiera running.
- The event's fields are `hook_event_name`, `session_id`, `cwd`, `tool_name` and `tool_input` (`file_path`, `command`, `url`, `pattern`, `query`, `description`, `questions`), and `notification_type` for a notification.
- For `PermissionRequest`, the command waits for the island's answer and prints it to stdout in Claude Code's format: `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`, or `"deny"` with a `message`. It prints nothing when the question goes back to the agent.

## Privacy

Everything stays on your PC. The command reads the event and keeps only the folder, the tool, and the file, page or command involved. For a change you are asked to allow, it also keeps the lines changed, to show them. Never your prompts. These go to Quiera through a named pipe that only your Windows account can open. They are kept in memory and never written to Quiera's log.
