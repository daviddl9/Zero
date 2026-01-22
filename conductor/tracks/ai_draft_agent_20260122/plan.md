# Implementation Plan: AI React Agent Email Drafting - `ai_draft_agent_20260122`

This plan outlines the steps to implement an AI React Agent for email drafting within the Zero mail application.

## Phase 1: Agent Foundation & Tooling [checkpoint: 8f7ff86]
*Focus: Setting up the ReAct agent structure and the necessary tools for searching history and checking calendar.*

- [x] Task: Create `search_past_emails` and `check_calendar` tools d91ea1f
    - [x] Write unit tests for `search_past_emails` (mocking database/Gmail API) d91ea1f
    - [x] Implement `search_past_emails` in `apps/server/src/services/agent-tools.ts` d91ea1f
    - [x] Write unit tests for `check_calendar` d91ea1f
    - [x] Implement `check_calendar` in `apps/server/src/services/agent-tools.ts` d91ea1f
- [x] Task: Initialize ReAct Agent with AI SDK 6 & Gemini 10f6fd5
    - [x] Write unit tests for Agent reasoning loop using `generateText` or `streamText` from AI SDK 6 10f6fd5
    - [x] Implement `DraftingAgent` using `google-generative-ai` provider and AI SDK 6 ReAct patterns. 10f6fd5
- [x] Task: Conductor - User Manual Verification 'Phase 1: Agent Foundation & Tooling' (Protocol in workflow.md) 8f7ff86

## Phase 2: Core Drafting Logic [checkpoint: b07399c]
*Focus: Implementing the logic to process context, generate reasoning, and produce two drafts.*

- [x] Task: Implement context processing for empty vs. non-empty compose window 6fabbd8
    - [x] Write tests for prompt construction logic 6fabbd8
    - [x] Implement context-aware prompt generation in `DraftingAgent` 6fabbd8
- [x] Task: Implement two-draft generation logic 6fabbd8
    - [x] Write tests to ensure the agent returns exactly two distinct drafts in a structured format (JSON) 6fabbd8
    - [x] Implement few-shot style replication in the agent prompt 6fabbd8
- [x] Task: Create tRPC endpoint for agent invocation 170663d
    - [x] Write integration tests for the tRPC route `agent.generateDrafts` 170663d
    - [x] Implement the tRPC route in `apps/server/src/trpc/routes/ai/agent.ts` 170663d
- [x] Task: Conductor - User Manual Verification 'Phase 2: Core Drafting Logic' (Protocol in workflow.md) b07399c

## Phase 3: UI & Transparency [checkpoint: efa3bc2]
*Focus: Building the frontend components to show the agent's thought process and the draft selection modal.*

- [x] Task: Create `AgentThinkingAccordion` component f56c2fd
    - [x] Write unit tests for the component states (loading, steps, completion) f56c2fd
    - [x] Implement the component in `apps/mail/components/mail/ai-thinking-accordion.tsx` using Radix UI/Shadcn f56c2fd
- [x] Task: Create `DraftSelectionModal` component 8d39ee0
    - [x] Write unit tests for the selection and preview logic 8d39ee0
    - [x] Implement the component in `apps/mail/components/mail/draft-selection-modal.tsx` 8d39ee0
- [x] Task: Conductor - User Manual Verification 'Phase 3: UI & Transparency' (Protocol in workflow.md) efa3bc2

## Phase 4: Integration & Refinement
*Focus: Connecting the agent to the Compose window and polishing the user experience.*

- [x] Task: Integrate AI Agent trigger in `ComposeEditor` 5adb92e
    - [x] Write integration tests for the "Draft with AI" flow 5adb92e
    - [x] Update `apps/mail/hooks/use-compose-editor.ts` and `apps/mail/components/mail/compose-editor.tsx` to include the AI trigger and handle agent responses 5adb92e
- [x] Task: Final Polish & Style Matching 08e217c
    - [x] Refine few-shot examples based on realistic email data 08e217c
    - [x] Ensure the "Thinking" UI provides clear feedback for all tool uses 08e217c
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & Refinement' (Protocol in workflow.md)
