# Specification: AI React Agent Email Drafting - `ai_draft_agent_20260122`

## Overview
Enhance the existing email composition interface by introducing an AI React Agent. This agent will autonomously draft email content based on either an empty compose window (using historical context) or user-provided points. It will utilize a ReAct (Reasoning and Acting) pattern to search past interactions, reason through the best response, and provide two distinct draft options while being transparent about its internal process.

## Tech Stack Requirements
- **LLM:** Google Gemini (via `ai` SDK v6)
- **Framework:** AI SDK 6 Core & UI

## Functional Requirements
- **Trigger Logic:**
    - If the compose textbox is **empty**: The agent must search past emails with the recipient to infer context and writing style.
    - If the compose textbox is **non-empty**: The agent uses the provided text as instructions/bullet points to expand into a full draft.
- **ReAct Agent Implementation:**
    - **Reasoning:** The agent must evaluate the current context (recipient, past threads, user prompt).
    - **Tools:**
        - `search_past_emails`: Retrieve history with the current recipient.
        - `check_calendar`: Verify availability if scheduling is detected as a need.
- **Draft Generation:**
    - Produce exactly **two** drafts for the user to compare.
    - Match the user's writing style implicitly by including retrieved historical emails in the prompt context (few-shot prompting).
- **Transparency UI:**
    - Display a "Thinking" accordion above the drafting area while the agent is working.
    - Show real-time updates of thought processes and tool executions (e.g., "Searching past emails...", "Checking calendar for availability...").
- **Draft Selection:**
    - Present the two generated drafts in a selection modal.
    - Selecting a draft replaces the content in the main compose window.

## Non-Functional Requirements
- **Latency Transparency:** The "Thinking" UI must be responsive to ensure users don't perceive the agent as "stuck" during long-running LLM calls or tool executions.
- **Privacy:** Past email retrieval must be scoped strictly to the current recipient to ensure data relevancy and privacy.

## Acceptance Criteria
- [ ] Agent correctly identifies when to use historical context vs. user instructions.
- [ ] Historical context tool successfully retrieves at least the last 5-10 emails with the recipient.
- [ ] The "Thinking" accordion correctly displays agent steps in real-time.
- [ ] Selection modal presents two distinct drafts.
- [ ] Selecting a draft correctly populates the compose editor.

## Out of Scope
- Training a custom model for style replication; using few-shot prompting instead.
- Editing the drafts *inside* the selection modal; editing happens in the main compose window after selection.
