async function testSATQuestions() {
  try {
    console.log('Testing SAT-style question generation...');
    
    const response1 = await fetch('http://localhost:5187/api/ai-tutor/generate-practice-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Trigonometry',
        level: 'Hard',
        question: 'In a right triangle, if the length of the side adjacent to angle x° is q, and the length of the hypotenuse is r, what is cos(x°)?',
        options: ['p/q', 'q/r', 'p/r', 'r/q'],
        correctAnswer: 'q/r',
        explanation: 'The length of the side adjacent to the angle marked x° is q, and the length of the hypotenuse of the triangle is r. Therefore, cos(x°) = q/r.'
      })
    });
    
    if (response1.ok) {
      const result1 = await response1.json();
      console.log('Generated SAT-style question:');
      console.log(JSON.stringify(result1, null, 2));
    } else {
      console.log('Error response:', await response1.text());
    }
    
    console.log('\nTesting concept explanation...');
    
    const response2 = await fetch('http://localhost:5187/api/ai-tutor/explain-concept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Trigonometry',
        level: 'Hard',
        question: 'In a right triangle, if the length of the side adjacent to angle x° is q, and the length of the hypotenuse is r, what is cos(x°)?',
        correctAnswer: 'q/r',
        explanation: 'The length of the side adjacent to the angle marked x° is q, and the length of the hypotenuse of the triangle is r. Therefore, cos(x°) = q/r.'
      })
    });
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('Generated concept explanation:');
      console.log(JSON.stringify(result2, null, 2));
    } else {
      console.log('Error response:', await response2.text());
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSATQuestions();