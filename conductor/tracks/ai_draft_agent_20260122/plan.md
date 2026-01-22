# Implementation Plan: AI React Agent Email Drafting - `ai_draft_agent_20260122`

This plan outlines the steps to implement an AI React Agent for email drafting within the Zero mail application.

## Phase 1: Agent Foundation & Tooling
*Focus: Setting up the ReAct agent structure and the necessary tools for searching history and checking calendar.*

- [x] Task: Create `search_past_emails` and `check_calendar` tools d91ea1f
    - [x] Write unit tests for `search_past_emails` (mocking database/Gmail API) d91ea1f
    - [x] Implement `search_past_emails` in `apps/server/src/services/agent-tools.ts` d91ea1f
    - [x] Write unit tests for `check_calendar` d91ea1f
    - [x] Implement `check_calendar` in `apps/server/src/services/agent-tools.ts` d91ea1f
- [ ] Task: Initialize ReAct Agent with AI SDK 6 & Gemini
    - [ ] Write unit tests for Agent reasoning loop using `generateText` or `streamText` from AI SDK 6
    - [ ] Implement `DraftingAgent` using `google-generative-ai` provider and AI SDK 6 ReAct patterns.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Agent Foundation & Tooling' (Protocol in workflow.md)

## Phase 2: Core Drafting Logic
*Focus: Implementing the logic to process context, generate reasoning, and produce two drafts.*

- [ ] Task: Implement context processing for empty vs. non-empty compose window
    - [ ] Write tests for prompt construction logic
    - [ ] Implement context-aware prompt generation in `DraftingAgent`
- [ ] Task: Implement two-draft generation logic
    - [ ] Write tests to ensure the agent returns exactly two distinct drafts in a structured format (JSON)
    - [ ] Implement few-shot style replication in the agent prompt
- [ ] Task: Create tRPC endpoint for agent invocation
    - [ ] Write integration tests for the tRPC route `agent.generateDrafts`
    - [ ] Implement the tRPC route in `apps/server/src/trpc/routes/ai/agent.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Drafting Logic' (Protocol in workflow.md)

## Phase 3: UI & Transparency
*Focus: Building the frontend components to show the agent's thought process and the draft selection modal.*

- [ ] Task: Create `AgentThinkingAccordion` component
    - [ ] Write unit tests for the component states (loading, steps, completion)
    - [ ] Implement the component in `apps/mail/components/mail/ai-thinking-accordion.tsx` using Radix UI/Shadcn
- [ ] Task: Create `DraftSelectionModal` component
    - [ ] Write unit tests for the selection and preview logic
    - [ ] Implement the component in `apps/mail/components/mail/draft-selection-modal.tsx`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UI & Transparency' (Protocol in workflow.md)

## Phase 4: Integration & Refinement
*Focus: Connecting the agent to the Compose window and polishing the user experience.*

- [ ] Task: Integrate AI Agent trigger in `ComposeEditor`
    - [ ] Write integration tests for the "Draft with AI" flow
    - [ ] Update `apps/mail/hooks/use-compose-editor.ts` and `apps/mail/components/mail/compose-editor.tsx` to include the AI trigger and handle agent responses
- [ ] Task: Final Polish & Style Matching
    - [ ] Refine few-shot examples based on realistic email data
    - [ ] Ensure the "Thinking" UI provides clear feedback for all tool uses
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & Refinement' (Protocol in workflow.md)
