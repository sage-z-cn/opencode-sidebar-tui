# Core Agent Notes

## Scope

- `src/core` is the activation/deactivation seam. `ExtensionLifecycle.activate()` wires services, providers, code actions, and commands; `src/extension.ts` only delegates to it.
- Commands are currently registered only through `src/core/commands/index.ts`, which delegates to `terminalCommands.ts`.
- The only command file is `terminalCommands.ts`. If you encounter references to other command files or backend-specific command groups, they are stale — those files do not exist.

## Where To Look

- Activation/service wiring: `ExtensionLifecycle.ts`.
- Command dependency shape: `commands/index.ts` and `TerminalCommandDependencies` in `commands/terminalCommands.ts`.
- User-facing commands: `commands/terminalCommands.ts` registers start, focus, paste, file-reference sends, send selected text, open terminal in editor, and restore to sidebar.
- Prompt routing: `ExtensionLifecycle.sendPromptToOpenCode()` tries the provider/terminal path and can fall back to a discovered OpenCode instance.
- Active terminal resolution: `ExtensionLifecycle.getActiveTerminalId()` reads `InstanceStore.getActive().runtime.terminalKey` before falling back.

## Multi-Terminal Constraints

- Do not add command registrations directly in providers or lifecycle bodies; add them to `terminalCommands.ts` and pass dependencies through `getCommandDependencies()`.
- `getCommandDependencies()` intentionally exposes getters so commands see current provider/service references after activation changes.
- File-reference commands send to `deps.sendPrompt()`, so they follow the active instance/session selected by `SessionRuntime` rather than manually choosing a terminal.
- If adding a command that targets panes, thread an explicit `paneId` through shared message types instead of inventing command-local routing.

## Verification

- Focused command tests live in `src/core/commands/terminalCommands.test.ts`.
- Core lifecycle tests live beside the file as `ExtensionLifecycle.test.ts`.
