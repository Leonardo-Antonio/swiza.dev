# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server**: `npm run dev` (Vite with HMR)
- **Build**: `npm run build` (runs `tsc -b` then `vite build`, output in `dist/`)
- **Lint**: `npm run lint` (ESLint with TypeScript + React Hooks + React Refresh rules)
- **Preview production build**: `npm run preview`
- **No test framework is configured.**

## Architecture

MultiDevTools is a client-side-only developer toolkit built with React 19, TypeScript, and Vite 8. There is no backend, no routing library, and no state management library.

### Tool system

`App.tsx` manages which tool is active via a `Tool` union type and local state. Tools are switched by clicking tabs or pressing keyboard shortcuts (1, 2, 3 — ignored when focus is in a textarea). Each tool is a self-contained component in `src/tools/` that receives a single `onCopy` prop for triggering a toast notification.

Current tools:

- **JsonFormatter** — parse, pretty-print (2/4 space indent), and minify JSON; custom syntax highlighter renders via `dangerouslySetInnerHTML`
- **DiffTool** — line-based text diff using the `diff` npm package (`diffLines`)
- **JsonToClass** — convert JSON to TypeScript interfaces or Python dataclasses; all type inference logic is inline in the component file

### Adding a new tool

1. Create a component in `src/tools/` with the `{ onCopy: (msg: string) => void }` prop interface.
2. Add an entry to the `tools` array and extend the `Tool` type in `App.tsx`.
3. Add the conditional render in the `<main>` section of `App.tsx`.

### Styling

No CSS modules, Tailwind, or preprocessors. Two CSS files handle everything:

- `index.css` — global reset, CSS custom properties (design tokens for colors, spacing, typography, radii, transitions), scrollbar styling. Dark theme only. Fonts: Space Grotesk (UI), JetBrains Mono (code), loaded from Google Fonts.
- `App.css` — all component styles using the design tokens. Shared classes like `.editor-area`, `.editor-header`, `.editor-body`, `.btn`, `.btn-ghost`, `.btn-primary` are reused across tools. Syntax highlight tokens (`.token-*`, `.code-*`) are defined here.

Use the existing CSS custom properties (e.g., `--surface-100`, `--ink-primary`, `--amber`, `--sp-4`, `--radius-md`) rather than hardcoding values.
