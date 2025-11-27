# AI Tutor Integration with OpenAI

This document explains how the AI Tutor functionality has been integrated with OpenAI to provide enhanced learning experiences for students.

## Features Implemented

### 1. Generate Similar Practice Questions
When a student answers a question incorrectly, they can request a similar practice question that:
- Tests the same concept but with different wording
- Provides realistic distractor options
- Has one correct answer
- Includes detailed explanations

### 2. Explain Concepts in Simpler Terms
Students can request simplified explanations that include:
- Step-by-step breakdowns
- Simple analogies and real-world examples
- Student-friendly language
- Optional follow-up questions to check understanding

## Technical Implementation

### Backend (Node.js/Express)
- Added two new API endpoints:
  - `POST /api/ai-tutor/generate-practice-question`
  - `POST /api/ai-tutor/explain-concept`
- Integrated OpenAI SDK for generating responses
- Added error handling and fallback mechanisms

### Frontend (React)
- Modified the QuizFrame component to use the new API endpoints
- Maintained backward compatibility with client-side generation as fallback
- Enhanced chat interface for better user experience

## Setup Instructions

### 1. Obtain an OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new secret key

### 2. Configure the Environment
1. Open the `.env` file in the project root
2. Replace `your-actual-api-key-here` with your actual OpenAI API key:
   ```
   OPENAI_API_KEY=sk-...your actual key...
   ```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application
```bash
npm run dev
```

## How It Works

### For Students
1. When a student answers a question incorrectly, a "Chat with AI Tutor" button appears
2. Clicking the button opens the AI Tutor chat interface
3. Students can choose between:
   - Generating a similar practice question
   - Getting a simplified explanation of the concept

### For Developers
1. The frontend sends a request to the backend with the question context
2. The backend formats a prompt for OpenAI based on the student's needs
3. OpenAI generates a response using GPT models
4. The response is formatted and sent back to the frontend
5. If the OpenAI API fails, the system falls back to client-side generation

## Fallback Mechanism
If the OpenAI API is unavailable or returns an error, the system automatically falls back to client-side generation of practice questions and explanations, ensuring uninterrupted service.

## API Endpoints

### Generate Practice Question
```
POST /api/ai-tutor/generate-practice-question
Content-Type: application/json

{
  "topic": "Mathematics",
  "level": "Easy",
  "question": "What is 2+2?",
  "options": ["3", "4", "5", "6"],
  "correctAnswer": "4",
  "explanation": "2+2 equals 4"
}
```

Response:
```json
{
  "question": "If you have 2 apples and someone gives you 2 more, how many apples do you have?",
  "options": ["3", "4", "5", "6"],
  "correct_answer": 1,
  "explanation": "When you add 2 apples to 2 apples, you get 4 apples in total."
}
```

### Explain Concept
```
POST /api/ai-tutor/explain-concept
Content-Type: application/json

{
  "topic": "Mathematics",
  "level": "Easy",
  "question": "What is 2+2?",
  "correctAnswer": "4",
  "explanation": "2+2 equals 4"
}
```

Response:
```json
{
  "explanation": "Addition is like counting things together. When you have 2 items and get 2 more, you count them all: 1, 2, 3, 4. So 2+2=4.",
  "follow_up_questions": [
    "If you have 3 pencils and find 1 more, how many do you have?",
    "What is 1+1?"
  ]
}
```

## Benefits

1. **Enhanced Learning**: Students get personalized, AI-generated content tailored to their needs
2. **Immediate Feedback**: Real-time assistance when students struggle with concepts
3. **Scalable**: Can handle any subject matter that can be expressed in text
4. **Robust**: Fallback system ensures continuous operation even if AI services are unavailable
5. **Cost-Effective**: Uses efficient GPT models to minimize API costs

## Future Improvements

1. Add support for image-based questions
2. Implement conversation history for better context
3. Add voice-to-text capabilities for accessibility
4. Implement adaptive difficulty based on student performance
5. Add multi-language support for global accessibility