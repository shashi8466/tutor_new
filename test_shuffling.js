import fetch from 'node-fetch';

async function testShuffling() {
  try {
    console.log('Testing question shuffling...');
    
    // Test multiple times to verify shuffling works
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- Test ${i + 1} ---`);
      
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
      
      if (practiceQuestionResponse.ok) {
        const data = await practiceQuestionResponse.json();
        console.log('Question:', data.question);
        console.log('Options:', data.options);
        console.log('Correct answer index:', data.correct_answer);
        console.log('Correct answer value:', data.options[data.correct_answer]);
      } else {
        console.log('Error:', practiceQuestionResponse.status);
      }
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testShuffling();