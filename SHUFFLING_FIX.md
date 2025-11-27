# AI Tutor Option Shuffling Fix

## Issue
The AI Tutor was generating practice questions where the correct answer was always in the same position (typically position 1), making it easy for students to simply guess "1" every time without actually learning the material.

## Root Cause
While the AI API was correctly returning the index of the correct answer, the frontend was not shuffling the options after receiving them, resulting in predictable answer positions.

## Solution Implemented

### 1. Main Implementation (API Response Handling)
Added option shuffling logic in the `generateSimilarQuestion` function:

```javascript
// Shuffle the options to prevent the correct answer from always being in the same position
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Create a copy of the options and shuffle them
const shuffledOptions = shuffleArray(data.options);

// Find the new index of the correct answer after shuffling
const correctAnswerIndex = shuffledOptions.findIndex(option => option === data.options[data.correct_answer]);

// Create the practice question object with the correct structure
const practiceQuestionObj = {
  question: data.question,
  options: shuffledOptions,
  correct: correctAnswerIndex,
  explanation: data.explanation
};
```

### 2. Fallback Implementations
Updated both fallback implementations to also shuffle options:

```javascript
// Shuffle the options for the fallback as well
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const shuffledOptions = shuffleArray(options);
const correctIndex = shuffledOptions.findIndex(opt => opt === correctAnswer);
```

## Benefits Achieved

1. **Prevents Answer Pattern Recognition**: Students can no longer rely on always selecting option 1
2. **Encourages Actual Learning**: Students must read and understand all options before answering
3. **Maintains Correct Answer Tracking**: The system still correctly identifies which option is the correct one after shuffling
4. **Works for Both API and Fallback**: Both the OpenAI API responses and client-side fallback implementations now shuffle options
5. **Preserves All Functionality**: All existing features continue to work as expected

## Test Results

Testing confirmed that:
- ✅ Options are properly shuffled in AI-generated questions
- ✅ The correct answer index is correctly updated after shuffling
- ✅ Students must actually read the options to select the correct answer
- ✅ Fallback implementations also shuffle options correctly
- ✅ No regression in existing functionality

## Technical Details

The fix ensures that:
1. Options are shuffled using the Fisher-Yates algorithm for proper randomization
2. The correct answer index is tracked and updated after shuffling
3. Both API responses and fallback implementations use the same shuffling logic
4. The practice question object maintains the correct structure expected by the rest of the system