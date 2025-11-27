import fetch from 'node-fetch';

async function testAIEndpoints() {
  try {
    // Test generate practice question endpoint
    console.log('Testing generate practice question endpoint...');
    
    const practiceQuestionResponse = await fetch('http://localhost:5184/api/ai-tutor/generate-practice-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: "Mathematics",
        level: "Easy",
        question: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: "4",
        explanation: "2+2 equals 4"
      })
    });
    
    console.log('Practice question response status:', practiceQuestionResponse.status);
    
    const practiceQuestionText = await practiceQuestionResponse.text();
    console.log('Practice question response body:', practiceQuestionText);
    
    if (practiceQuestionResponse.ok) {
      const practiceQuestionData = JSON.parse(practiceQuestionText);
      console.log('Practice question response:', practiceQuestionData);
    } else {
      console.log('Error details:', practiceQuestionText);
    }
    
    // Test explain concept endpoint
    console.log('\nTesting explain concept endpoint...');
    
    const explainConceptResponse = await fetch('http://localhost:5184/api/ai-tutor/explain-concept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: "Mathematics",
        level: "Easy",
        question: "What is 2+2?",
        correctAnswer: "4",
        explanation: "2+2 equals 4"
      })
    });
    
    console.log('Explain concept response status:', explainConceptResponse.status);
    
    const explainConceptText = await explainConceptResponse.text();
    console.log('Explain concept response body:', explainConceptText);
    
    if (explainConceptResponse.ok) {
      const explainConceptData = JSON.parse(explainConceptText);
      console.log('Explain concept response:', explainConceptData);
    } else {
      console.log('Error details:', explainConceptText);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testAIEndpoints();