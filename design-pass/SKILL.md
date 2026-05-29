---
name: design-pass
description: Establish a coherent visual design system for a project — tokens, theme architecture, layout primitives, component polish, atmospheric touches. Use when the codebase has functional UI that "works" but feels generic, shadcn-default, or visually flat. Produces a token-driven design layer that survives future feature work because everything references the tokens. Not a one-shot styling pass — the output is the design system that future chunks build on.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# /design-pass — Establish a token-driven design system

Use when the app's UI is functional but visually flat — generic shadcn defaults, no consistent rhythm, no aesthetic identity. The output of this skill is not "make it look nicer" — it's a *design system* (tokens, themes, layout primitives, component patterns) that future chunks inherit automatically. Doing this once correctly is leverage; doing it wrong (ad-hoc styling) creates compounding drift.

Arguments passed: `$ARGUMENTS` (the project's target aesthetic, audience, or specific concern — a phrase, a paragraph, or empty if the project's spec already implies it).

---

## Mental model

**Design quality emerges from constraint, not creativity.** A small set of tokens (colors, spacing, type sizes, radii) applied consistently produces a coherent look. Endless local creativity produces a UI that looks "designed by committee."

**Three lanes of work, in order:**

1. **Tokens.** Centralize every visual decision into named CSS variables (or Tailwind theme extensions). Components reference tokens, never hex codes or raw px values. This is the constraint engine — the only place these decisions live.
2. **Theme architecture.** Decide if the app has a single mode or alternating modes (light/dark). If alternating, structure as `[data-theme="..."]` override blocks on a single sheet, not parallel stylesheets. Light is default unless the user explicitly wants otherwise — most consumer SaaS audiences expect light.
3. **Component patterns.** Refine the shadcn/Radix/MUI defaults the project ships with. Apply tokens systematically. Add hover/focus/active states to every interactive element. Add atmospheric touches that elevate beyond baseline.

If you find yourself writing `style={{ color: '#0066cc' }}` or hardcoding `padding: 14px`, you've left the lanes. Tokens get added, then referenced.

---

## The workflow

### 1. Read the project's positioning

Read `spec/product.md` (or equivalent — `README.md`, `package.json` description, AGENTS.md). Extract:

- **Who's the target user?** Solo professional? Sales team? Gamer? Developer? The audience implies the aesthetic. Apple-first solo pros want clean and modern. Developers want terminal-shaped tools. E-commerce shoppers want trust signals and clear CTAs.
- **What's the brand voice?** Confident? Playful? Technical? Reassuring? This shapes typography weight and color saturation.
- **What's the wedge?** What makes this product different? The design should reinforce, not contradict.

If positioning is ambiguous, ask the user (one question, multiple-choice) before proceeding. Don't guess at aesthetic from feature lists.

### 2. Pick a tokens shape

Choose between:
- **CSS custom properties** (`:root { --bg: ...; }`) — best for non-React or mixed-framework projects, or when you want runtime theme switching without a build step.
- **Tailwind theme extension** (`tailwind.config.ts` extending `theme.colors`, `theme.fontSize`, etc.) — best for Tailwind-native projects. Tokens become utility classes (`bg-primary`, `text-muted`).

Both produce the same constraint engine; pick the one the project already uses. Don't introduce a second.

### 3. Define the token set

**Minimum tokens:**

**Colors** (8-12 named, not more):
- `background` (page bg), `surface` (cards/panels), `surface-2` (nested surfaces), `border` (subtle dividers)
- `primary` (main brand color), `accent` (CTAs / focus rings), `muted` (secondary text)
- `text` (body), `text-muted` (de-emphasized)
- `success`, `warning`, `danger`, `info` (semantic states — use sparingly)

**Spacing scale** (use 4px or 8px base, document the scale):
- e.g. 4/8/12/16/24/32/48/64. Don't invent in-between values. If 20 feels right, you're really wanting either 16 or 24 — pick one.

**Type scale** (5-7 sizes max):
- e.g. `.72rem` (caption), `.85rem` (small), `1rem` (body), `1.125rem` (subhead), `1.5rem` (h2), `2rem` (h1), `3rem` (hero).
- Pick a font family deliberately. System fonts (`-apple-system, BlinkMacSystemFont, ...`) look native on Apple devices, are fast (no download), and stay current. Custom fonts are a real choice — only pick one if the brand demands it.

**Radii** (3-4 values):
- e.g. `4px` (small — chips, inputs), `8px` (default — cards, buttons), `16px` (large — modals, hero panels), `9999px` (pill).

**Shadows** (3-4 values, semantic names):
- e.g. `shadow-sm` (inputs, small cards), `shadow-md` (raised cards), `shadow-lg` (modals, popovers), `shadow-focus` (accent-tinted focus ring).

**Transitions** (1-2 durations):
- e.g. `150ms` for color/hover, `250ms` for layout/transform. Don't introduce more.

Write the token block at the top of the global stylesheet or in `tailwind.config.ts`. Document the scale inline as comments.

### 4. Theme architecture (if needed)

If the project has light/dark modes, structure as override blocks:

```css
:root {
  --bg: #ffffff;
  --text: #1a1a2e;
  /* light mode values as default */
}

[data-theme="dark"] {
  --bg: #0a0a0f;
  --text: #c8d0e0;
  /* dark overrides */
}
```

Single source of truth: every component references `var(--bg)` and `var(--text)`. Theme switches by toggling `data-theme` on `<html>`. No `@media (prefers-color-scheme)` branches in component CSS — that's the override block's job.

**Default to light unless the project's spec explicitly says otherwise.** Consumer SaaS audiences expect light. Dark default is a real choice that excludes some users — make it deliberately.

### 5. Layout primitives

Most apps need 2-3 distinct layout shapes:

- **Marketing layout** — top nav + main + footer. Different audience (visitors), different shape from authenticated views.
- **App layout** — sidebar nav + main content area. The dashboard pattern. Sidebar is collapsible on mobile.
- **Single-purpose layout** — booking page, checkout, onboarding — no chrome, focused on one task.

Build each as a route group or shared layout file. The sidebar nav is the highest-leverage primitive — get it right and every dashboard page inherits it.

**Sidebar guidance:**
- Width: 240-280px on desktop, full-width drawer on mobile (≤ 768px).
- Sections: group by frequency of use. Primary actions at top, settings/billing at bottom.
- Active state: subtle background + accent color on text/icon. Don't over-style — the user is *in* this section, they don't need a flag.
- Hover state: cheaper than active state. Background tint.
- Icons: optional. If you use them, every item gets one. Consistency > completeness.

### 6. Component polish

Walk through the existing components in `components/ui/` (or equivalent). For each:

- **Button** — three variants minimum (primary / secondary / ghost). Each gets `:hover`, `:focus-visible`, `:active`, `:disabled`. Focus uses the accent token with a soft ring (`box-shadow: 0 0 0 3px var(--accent-dim)`).
- **Card** — subtle border + small shadow. Generous padding (24-32px). Cards in a grid get consistent gap (16-24px).
- **Input** — clear focus ring (matches button focus). Validation state colors from the semantic tokens. Label-above-input pattern (not placeholder-as-label).
- **Badge** — small, pill-shaped, semantic-colored. Variants for status (`active` / `degraded` / `revoked` etc.) using the success/warning/danger tokens.
- **Modal/Dialog** — backdrop blur or dim. Modal max-width caps at ~500px for forms, ~720px for content. Close affordance: × button + backdrop click + Escape.

Don't reinvent — refine. The shadcn defaults are competent; they're just generic. Apply tokens, tighten spacing, add hover/focus polish.

### 7. Atmospheric touches (the things that elevate)

These are the small details that separate "functional" from "feels designed":

- **Hover transitions everywhere.** Every interactive element gets `transition: background-color 150ms, border-color 150ms, color 150ms`. Inconsistent application is worse than none.
- **Focus rings on every input/button.** Not just the default browser ring — a token-based accent ring (`box-shadow: 0 0 0 3px var(--accent-dim)`). Accessibility AND polish.
- **Subtle shadows on raised elements.** Cards lift 1-2px on hover with shadow + slight border tint. Conveys "this is interactive."
- **Loading states.** Skeleton screens beat spinners for content placeholders. Spinners only for actions (button clicks).
- **Empty states.** Don't show a blank list — show an empty-state component with an icon, one-line explanation, and a CTA.
- **Micro-animations.** Modal slide-up + fade-in (200ms). Toast notifications slide in from a corner. Status badge pulses on state change. Use sparingly — every animation has a cost in perceived speed.
- **Texture / atmosphere (optional).** Subtle dot patterns on empty backgrounds, soft gradient overlays on heroes, blur effects on modals. One project gets one of these, not all of them.

The rule: **every atmospheric touch should be invisible until you remove it, at which point the UI feels worse.** If a user notices the touch consciously, it's too loud.

### 8. Apply systematically

Walk the app's routes. For each:
1. Replace hardcoded styles with token references.
2. Apply consistent spacing/typography/radii.
3. Add hover/focus states to every interactive element.
4. Add empty states + loading states where missing.

Don't try to do this in one giant commit — go route by route. Marketing pages first (lowest risk, highest visibility). Then dashboard. Then booking/invitee flows. Then settings.

After each route group, sanity-check: take a screenshot or just visually compare. If anything looks "different" from the rest, the tokens aren't being applied consistently — fix the drift before moving on.

---

## Strong defaults

- **Light mode default.** Dark mode is a feature, not a default, unless the user explicitly asks otherwise.
- **System fonts unless the brand demands custom.** `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` looks great everywhere, loads instantly, ages well.
- **8px base spacing scale.** 4/8/16/24/32/48/64 covers 95% of cases.
- **Accent color used sparingly.** Primary CTAs, focus rings, active state on sidebar. Not body text. Not borders. Not backgrounds (except subtle tint).
- **Border-radius 8px default.** 4px for inputs, 8px for buttons/cards, 16px for modals.
- **Tokens documented as comments in the stylesheet/config.** A new developer should understand the scale by reading the file once.

---

## Anti-patterns

- **Hex codes in component files.** Token violation. If a component has `#0066cc`, that color should be a token.
- **One-off spacing values.** `padding: 13px` is a smell. Either it's `12px` or `16px` from your scale. The 1px difference doesn't matter; the consistency does.
- **Dark mode by default for consumer SaaS.** Excludes users with vision sensitivity, doesn't match Apple/iOS conventions for productivity apps. Real choice that's almost always wrong for the audience you want.
- **Atmospheric overload.** Three competing textures, glows on every element, animations on every state change. Each touch should be invisible until removed.
- **Skipping focus rings to "look cleaner."** Accessibility violation and quality regression. Focus rings are not optional.
- **Hand-styling each page instead of system-wide tokens.** Every drift compounds. By the third "just this one place," you've lost the system.
- **Designing in code without looking at the rendered output.** You can't pattern-match aesthetic quality from CSS alone. Render and look — that's the verification step.

---

## When to skip this skill

- **Greenfield app with no UI yet.** Build feature paths first, then run this skill after the surface is functional. Premature design on empty scaffolding produces a system you'll redo.
- **App with an existing strong design system.** If the project already has tokens, layout primitives, and consistent component polish, you're not running a design pass — you're doing component-level work. Use `/vibe-code` or `/senior-engineer` for that.
- **One-page tools or internal scripts.** Cost-benefit is wrong. Generic styling is fine.
- **B2B / internal tools where visual polish isn't a competitive surface.** Functional > beautiful. Don't over-invest.

---

## The one-liner

> **Tokens are the constraint engine. Apply them systematically and your app stops looking like shadcn-defaults. Skip them and every page drifts.**

Everything else — sidebar layout, hover states, atmospheric touches — is execution detail on top of that one rule.
