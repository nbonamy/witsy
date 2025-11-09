# Implementation Plan for Issue #479: Message Editing Features

GitHub Issue: https://github.com/nbonamy/witsy/issues/479

## Overview
Implement true in-place editing for both user and AI messages with the following features:
- User messages: Edit inline with resend capability
- AI messages: Edit inline to fix minor errors
- Full button reorganization for user messages: Copy - Edit - Quote - Delete - Fork
- Mark AI messages as edited when modified

## User Preferences
- **Priority**: Both features together
- **UI Approach**: Inline editing (edit directly in message bubble)
- **Button Set**: Full reorganization with Quote button added
- **AI Edit History**: Mark as edited but no history preservation

## Implementation Phases

### Phase 1: Data Model & Foundation
1. **Update Message model** (`src/models/message.ts`)
   - Add `edited: boolean` property to track edited AI messages
   - Add method `updateContent()` to modify message content and set edited flag

2. **Add edited indicator UI** (`src/components/MessageItem.vue`)
   - Display "(edited)" text or icon for edited AI messages
   - Style the indicator subtly in CSS

### Phase 2: User Message In-Place Editing
3. **Add edit mode state** (`src/components/MessageItem.vue`)
   - Add reactive `isEditing` state and `editedContent` ref
   - Toggle between display mode (current Markdown) and edit mode (textarea)
   - Implement inline textarea that matches message styling

4. **Reorganize user message buttons** (`src/components/MessageItemActions.vue`)
   - Add new "Quote" button (current Edit behavior: copy to prompt)
   - Change "Edit" button to toggle inline editing mode
   - Add "Resend" button (visible only in edit mode)
   - Add "Cancel" button (visible only in edit mode)
   - Reorder buttons: Copy - Edit - Quote - Delete - Fork

5. **Implement resend logic** (`src/screens/Chat.vue`)
   - Add `onResendAfterEdit` handler
   - Update message content in chat history
   - Delete all messages after the edited one
   - Re-trigger AI generation with updated message

### Phase 3: AI Message In-Place Editing
6. **Add edit mode for AI messages** (`src/components/MessageItem.vue`)
   - Same edit state pattern as user messages
   - Handle markdown content editing (raw markdown in textarea)
   - Preserve artifacts, attachments, tool calls during edit

7. **Add AI message edit buttons** (`src/components/MessageItemActions.vue`)
   - Add "Edit" button for assistant messages
   - Add "Save" and "Cancel" buttons (visible in edit mode)
   - Save updates message content and sets `edited` flag

### Phase 4: Localization & Testing
8. **Add translations** (`src/locales/en.json`)
   - "Quote", "Resend", "Cancel", "Save", "(edited)"

9. **Write comprehensive tests** (`tests/components/message_item.test.ts`)
   - Test edit mode toggle for both message types
   - Test resend after user message edit
   - Test save after AI message edit
   - Test cancel functionality
   - Test button visibility states
   - Verify edited flag and indicator

10. **Run lint and fix any issues**
    - Ensure all code passes `npm run lint`
    - Fix any type errors or formatting issues

## Implementation Approach
- Work in small increments: implement, lint, test
- Keep tests passing after each phase
- Confirm completion of each phase before proceeding
- Commit frequently with clear messages
- Wait for final user approval before merging
