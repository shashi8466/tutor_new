async function testEndpoints() {
  try {
    console.log('Testing generate practice question endpoint...');
    
    const practiceQuestionResponse = await fetch('http://localhost:5190/api/ai-tutor/generate-practice-question', {
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
    
    if (practiceQuestionResponse.ok) {
      const data = await practiceQuestionResponse.json();
      console.log('Practice question response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await practiceQuestionResponse.text();
      console.log('Error details:', errorText);
    }
    
    console.log('\nTesting explain concept endpoint...');
    
    const explainConceptResponse = await fetch('http://localhost:5190/api/ai-tutor/explain-concept', {
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
    
    if (explainConceptResponse.ok) {
      const data = await explainConceptResponse.json();
      console.log('Explain concept response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await explainConceptResponse.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEndpoints();