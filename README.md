# Ripple

Ripple is basically trying to do one thing:

**Turn natural language into a running web application.**

Not code suggestions. Not chat responses. **A real working app with a live URL.**

User says something → Ripple spins up infrastructure → AI writes the code → user gets a live preview.

Think of it like:
```text
Prompt → Code → Running App
```
But automated end-to-end.

---

## The Core Philosophy

Most AI tools today stop at **code generation**. They do this:
```text
Prompt → code snippet
```

Ripple instead does:
```text
Prompt
 ↓
AI plans architecture
 ↓
sandbox created
 ↓
code generated
 ↓
dev server started
 ↓
live preview returned
```

Which means Ripple isn't just a **coding assistant**. It’s a **software creation engine**.

---

## The Product in Simple Terms

A user types:
> *"build a SaaS landing page with authentication and a dashboard"*

Ripple will:
1. Create a **sandbox environment**
2. Load a **Next.js template**
3. AI modifies files (`/app/page.tsx`, `/components/ui/*`, `/lib/*`)
4. Run `npm run dev`
5. Return a **live preview URL** (e.g., `https://sandbox.e2b.dev/abc123`)

So the user instantly sees the app. No local setup. No installs. No IDE.

---

## The System Architecture

Ripple is essentially **four systems glued together**:

### 1. Prompt Engine
**User intent → structured plan.**
Example: `"build a todo app"` becomes something like:
```json
{
  "framework": "nextjs",
  "features": [
    "todo CRUD",
    "local storage",
    "dark mode"
  ]
}
```
This prevents AI from hallucinating structure.

### 2. AI Coding Engine
**The agent layer:** `Gemini` → `Agent-kit` → `file edits`
The AI decides what to do (`create file`, `edit file`, `delete file`, `run command`) instead of just returning text.

### 3. Sandbox Runtime
Powered by **E2B**.
Each project runs inside an **isolated VM** running a **Next.js dev server** with a **port exposed**. That gives the user a live preview without touching their machine.

### 4. Event Orchestration
Handled by **Inngest**.
Building apps involves multiple async steps (create sandbox → clone template → generate code → run server → update preview). Inngest turns this into **durable workflows**. If something crashes, it resumes.

---

## What Makes Ripple Different

There are already AI builders (Lovable, Bolt, v0, Replit AI). But Ripple's twist is **intent-first architecture**.

Meaning the system doesn't just generate code — it **understands the user's goal** before building. 

Example: User says `"build a startup landing page"`.
Ripple doesn't just write React. It understands the required structure (hero section, features, pricing, CTA, footer), then builds it.

---

## The Core Loop of Ripple

At its heart, Ripple runs this loop:
```text
User Prompt
 ↓
Intent Engine
 ↓
Plan
 ↓
AI edits project files
 ↓
Server rebuild
 ↓
Preview updated
```
Repeated continuously.

---

## Long-Term Vision

Ripple eventually becomes something bigger than a code generator. It becomes a **software operating system for building products**.

Future flow:
```text
idea → Ripple builds MVP → Ripple deploys it → Ripple monitors analytics → Ripple iterates
```
Basically: **Idea → Product → Iteration**

### What Ripple Could Become
If fully realized, Ripple becomes something like:
**Figma + GitHub + Vercel + AI** ...but all collapsed into one interface.

Users would:
```text
describe product → watch it build → edit via prompt → deploy
```

### The Real Technical Challenge
Not AI. AI is the easy part. The real hard parts are:
1. **Sandbox lifecycle management**
2. **Reliable file editing**
3. **Server restarts without breaking preview**
4. **State persistence**

Those are what make or break AI builders.

---

## The Dream End State

The ultimate experience:
User opens Ripple.
Types: `"build a marketplace for indie game assets"`

Within minutes: auth, dashboard, product pages, checkout, and admin panel all exist. Running. Live.

**Ripple is basically chasing the idea that software should be generated as easily as writing a paragraph.**
# vibe
