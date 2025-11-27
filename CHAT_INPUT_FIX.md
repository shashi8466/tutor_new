# Chat Input Fix for AI Tutor

## Issue
When a student selects a wrong answer and clicks the "Chat with AI Tutor" button, the AI Tutor modal displays a practice question. However, the chat input field was disabled, preventing students from typing their answer (1, 2, 3, or 4) into the AI chat.

## Root Cause
The chat input field and submit button had the `practiceQuestion` condition in their `disabled` attributes, which prevented interaction when a practice question was displayed.

## Solution
Removed the `practiceQuestion` condition from the disabled attributes of both the chat input field and submit button, allowing students to type their answers when a practice question is displayed.

## Changes Made
1. **File**: `src/components/student/frames/QuizFrame.jsx`
2. **Lines Modified**: 1649 and 1654
3. **Before**:
   ```jsx
   disabled={isTyping || practiceQuestion}
   ```
   ```jsx
   disabled={!chatInput.trim() || isTyping || practiceQuestion}
   ```
4. **After**:
   ```jsx
   disabled={isTyping}
   ```
   ```jsx
   disabled={!chatInput.trim() || isTyping}
   ```

## Testing
The fix has been implemented and allows students to:
1. Generate a similar practice question through the AI Tutor
2. Type their answer (1, 2, 3, or 4) in the chat input field
3. Submit their answer to receive feedback from the AI Tutor

This ensures a proper interactive learning experience where students can practice and get immediate feedback on their understanding.