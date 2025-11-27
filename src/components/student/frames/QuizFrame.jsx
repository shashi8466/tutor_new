import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiMessageCircle, FiX, FiCheckCircle, FiBarChart2, FiAward, FiRefreshCw, FiHelpCircle } from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';

const QuizFrame = ({ 
  setCurrentFrame, 
  selectedCourse, 
  currentLevel, 
  currentTopic, 
  unlockNextLevel,
  setCurrentLevel
}) => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizState, setQuizState] = useState('in_progress'); // in_progress, feedback, completed
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading quiz questions...');
  const [showAITutor, setShowAITutor] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState(null);
  const [phase, setPhase] = useState(1);
  const [previousScores, setPreviousScores] = useState({});
  const [showScoreReport, setShowScoreReport] = useState(false);

  // Get current question - moved here to avoid temporal dead zone
  const currentQuestion = questions[currentQuestionIndex];

  // Helper functions for score calculation
  const getScaledScoreRange = (phase) => {
    // Define score ranges for each phase
    const ranges = {
      1: { min: 0, max: 400 },   // Easy phase
      2: { min: 0, max: 600 },   // Medium phase
      3: { min: 0, max: 800 }    // Hard phase
    };
    return ranges[phase] || { min: 0, max: 400 };
  };

  const calculateScaledScore = (rawScore, totalQuestions, maxRange) => {
    // Calculate percentage and scale to the max range
    if (totalQuestions === 0) return 0;
    const percentage = rawScore / totalQuestions;
    return Math.round(percentage * maxRange);
  };

  // Fetch quiz questions from SQL API
  const fetchQuizQuestions = async (courseId, level) => {
    try {
      setLoadingMessage('Fetching quiz questions from database...');
      
      // First, try to get parsed questions from API with the provided courseId
      let url = `/api/questions?course_id=${encodeURIComponent(courseId)}&level=${encodeURIComponent(level)}`;
      
      let resp = await fetch(url);
      
      // If we get a 404 or empty response, try alternative course IDs
      let parsedQuestions = [];
      if (resp.status === 404 || (resp.ok && (await resp.clone().json()).length === 0)) {
        // Try common alternative course IDs
        const alternativeCourseIds = [
          'demo_course',  // The default demo course
          courseId.replace('course_', ''),  // Without 'course_' prefix
          `course_${courseId}`  // With 'course_' prefix
        ];
        
        for (const altCourseId of alternativeCourseIds) {
          if (altCourseId === courseId) continue;  // Skip the one we already tried
          
          url = `/api/questions?course_id=${encodeURIComponent(altCourseId)}&level=${encodeURIComponent(level)}`;
          resp = await fetch(url);
          
          if (resp.ok) {
            const altQuestions = await resp.json();
            if (altQuestions && altQuestions.length > 0) {
              parsedQuestions = altQuestions;
              courseId = altCourseId;  // Update courseId for consistency
              break;
            }
          }
        }
      } else if (resp.ok) {
        parsedQuestions = await resp.json();
      }
      
      // Check if we got a 400 error which might indicate invalid parameters
      if (resp.status === 400) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(`Invalid request: ${errorData.error || 'Check course ID and level'}`);
      }
      
      if (parsedQuestions && parsedQuestions.length > 0) {
        setLoadingMessage('Questions loaded successfully!');
        // Sort questions by question_number to ensure correct order
        const sortedQuestions = parsedQuestions.sort((a, b) => {
          const numA = a.question_number || 0;
          const numB = b.question_number || 0;
          return numA - numB;
        });
        
        return sortedQuestions.map(qn => {
          // Ensure options is always an array
          let optionsArray = Array.isArray(qn.options) ? qn.options : [];
          // Handle case where options might be a JSON string
          if (typeof qn.options === 'string') {
            try {
              const parsed = JSON.parse(qn.options);
              if (Array.isArray(parsed)) {
                optionsArray = parsed;
              }
            } catch (e) {
              // If parsing fails, keep as empty array
              console.warn('Failed to parse options as JSON:', qn.options, e);
            }
          }
          
          // Handle case where options might be stored as a single string with delimiters
          if (typeof qn.options === 'string' && optionsArray.length === 0) {
            // Try splitting by common delimiters
            if (qn.options.includes('|')) {
              optionsArray = qn.options.split('|').map(opt => opt.trim());
            } else if (qn.options.includes(';')) {
              optionsArray = qn.options.split(';').map(opt => opt.trim());
            } else if (qn.options.includes('\n')) {
              optionsArray = qn.options.split('\n').map(opt => opt.trim()).filter(opt => opt.length > 0);
            }
          }
          
          // Additional processing to ensure options have proper structure
          optionsArray = optionsArray.map(option => {
            // If option is an object with value property, extract the value
            if (option && typeof option === 'object' && option.value) {
              return option.value;
            }
            // If option is an object with text property, extract the text
            if (option && typeof option === 'object' && option.text) {
              return option.text;
            }
            // If option is an object with content property, extract the content
            if (option && typeof option === 'object' && option.content) {
              return option.content;
            }
            // Return as is for other cases
            return option;
          });
          
          // Clean up options array - remove null, undefined, empty strings or whitespace-only strings
          optionsArray = optionsArray.filter(option => {
            if (typeof option === 'string') {
              return option.trim().length > 0;
            }
            return option !== null && option !== undefined;
          });
          
          // Enhanced debugging for options processing
          console.log('Processing question:', qn.question_text);
          console.log('Raw options:', qn.options);
          console.log('Processed options array:', optionsArray);
          
          // Check if this is a valid MCQ - has options with actual content
          const hasValidOptions = optionsArray.length > 0 && optionsArray.some(option => {
            if (typeof option === 'string') {
              return option.trim().length > 0;
            }
            if (option && typeof option === 'object') {
              // Check if it's a non-empty object with content
              if (option.value && typeof option.value === 'string') {
                return option.value.trim().length > 0;
              }
              if (option.text && typeof option.text === 'string') {
                return option.text.trim().length > 0;
              }
              if (option.content && typeof option.content === 'string') {
                return option.content.trim().length > 0;
              }
              // For other object types, check if it has any properties
              return Object.keys(option).length > 0;
            }
            return option !== null && option !== undefined;
          });
          
          // Process question text to handle HTML entities and special markers
          let processedQuestionText = qn.question_text || '';
          if (typeof processedQuestionText === 'string') {
            // Handle common HTML entities
            processedQuestionText = processedQuestionText
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
              
            // Handle image markers in question text - convert to actual images
            processedQuestionText = processedQuestionText.replace(/\[IMAGE:([^\]]+)\]/g, (match, imageUrl) => {
              const resolved = resolveImageUrl(imageUrl);
              return `<img src="${resolved}" alt="Question image" style="max-width: 100%; height: auto; display: block; margin: 10px auto;" onerror="this.style.display='none'; this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgRXJyb3I8L3RleHQ+PC9zdmc+';"/>`;
            });
            
            // Handle table markers in question text - convert to placeholders for now
            processedQuestionText = processedQuestionText.replace(/\[TABLE:(\d+)\]/g, (match, tableIndex) => {
              return `[TABLE:${tableIndex}]`; // Keep as marker, will be handled by renderTables
            });
          }
          
          return {
            id: qn.id,
            question_number: qn.question_number,
            question: processedQuestionText,
            options: optionsArray,
            correct: qn.correct_answer,
            explanation: qn.explanation || 'This question tests your understanding of the concept.',
            // According to specification: MCQ if exactly 4 options, SHORT_ANSWER otherwise
            question_type: optionsArray.length === 4 ? 'mcq' : 'short_answer',
            image_url: qn.image_url,
            tables: qn.tables || null,
            math_expressions: qn.math_expressions || null,
            source: 'sql_database',
            documentName: qn.documentName,
            documentSize: qn.documentSize
          };
        });
      }

      // If no parsed questions, check for uploaded documents
      setLoadingMessage('Checking for uploaded quiz documents...');
      // Fixed the endpoint from /api/uploads to /api/upload
      const uresp = await fetch(`/api/upload?course_id=${encodeURIComponent(courseId)}`);
      const uploads = uresp.ok ? await uresp.json() : [];
      if (uploads && uploads.length > 0) {
        setLoadingMessage(`${uploads.length} quiz documents found. Processing...`);
        // Generate questions based on uploaded documents
        return generateQuestionsFromUploads(uploads, currentTopic, level);
      }

      // Fallback: generate sample questions
      setLoadingMessage('No uploaded documents found. Generating sample questions...');
      return generateSampleQuestions(currentTopic, level);
    } catch (error) {
      setLoadingMessage(`Error loading questions: ${error.message}`);
      // Even in error case, we should return an empty array to prevent UI issues
      return [];
    }
  };

  // Generate questions from uploaded documents
  const generateQuestionsFromUploads = (uploads, topic, level) => {
    const questionCount = level === 'Easy' ? 6 : level === 'Medium' ? 10 : 15;
    const allQuestions = [];

    uploads.forEach((upload) => {
      const questionsPerUpload = Math.ceil(questionCount / uploads.length);
      for (let i = 0; i < questionsPerUpload; i++) {
        allQuestions.push({
          question: `Question ${i + 1} from ${upload.file_name}: Based on the ${level} level materials for ${topic}, what concept is most important?`,
          options: [
            `Key concept from ${upload.file_name}`,
            `Secondary concept from materials`,
            `Related concept for ${level}`,
            `Advanced concept for next level`
          ],
          correct: 0,
          explanation: `This question is based on the uploaded document: ${upload.file_name}. The correct answer represents the key concept emphasized in the materials.`,
          source: 'uploaded_document',
          documentName: upload.file_name,
          documentSize: upload.file_size
        });
      }
    });

    return allQuestions;
  };

  // Generate sample questions as fallback
  const generateSampleQuestions = (topic, level) => {
    const questionCount = level === 'Easy' ? 6 : level === 'Medium' ? 10 : 15;
    const sampleQuestions = [];

    for (let i = 0; i < questionCount; i++) {
      sampleQuestions.push({
        question: `Sample Question ${i + 1}: What is the fundamental concept of ${topic} at the ${level} level?`,
        options: [
          `Correct understanding of ${topic}`,
          `Partial understanding of ${topic}`,
          `Common misconception about ${topic}`,
          `Unrelated concept`
        ],
        correct: 0,
        explanation: `This is a sample question about ${topic}. In a real implementation, this would be replaced with questions from uploaded documents.`,
        source: 'sample_fallback'
      });
    }

    return sampleQuestions;
  };

  useEffect(() => {
    const phaseMap = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
    const newPhase = phaseMap[currentLevel];
    setPhase(newPhase);
    setIsLoading(true);

    // Extract courseId properly - MUST use the course ID, not the title
    let courseId = '';
    if (selectedCourse && selectedCourse.id) {
      courseId = selectedCourse.id;
    }
    
    // Fallback to title only as a last resort for backward compatibility
    if (!courseId && selectedCourse && selectedCourse.title) {
      courseId = selectedCourse.title;
    }
    
    // If we don't have a valid courseId, we can't fetch questions
    if (!courseId) {
      setLoadingMessage('Error: No valid course selected. Please go back and select a course.');
      setIsLoading(false);
      return;
    }

    // Fetch questions from SQL API
    const loadQuestions = async () => {
      try {
        const newQuestions = await fetchQuizQuestions(courseId, currentLevel);
        setQuestions(newQuestions);
        setIsLoading(false);
        handleRestartQuiz();
      } catch (error) {
        setLoadingMessage('Error loading questions. Please try again.');
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [currentLevel, selectedCourse, currentTopic]);

  // Trigger MathJax rendering when question changes or content updates
  useEffect(() => {
    // Check if MathJax is available and queue rendering
    if (typeof window !== 'undefined' && window.MathJax) {
      // Use MathJax typesetting API
      window.MathJax.typesetPromise?.().catch((err) => {
        console.warn('MathJax rendering error:', err);
      });
    }
  }, [currentQuestion, currentQuestionIndex, quizState, selectedAnswer]);
  
  // Additional effect to ensure MathJax renders after option content is updated
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && currentQuestion) {
      // Small delay to ensure DOM is updated before MathJax rendering
      const timer = setTimeout(() => {
        window.MathJax.typesetPromise?.().catch((err) => {
          console.warn('MathJax rendering error:', err);
        });
      }, 300); // Increased delay to ensure all content is rendered
      
      return () => clearTimeout(timer);
    }
  }, [currentQuestion, currentQuestionIndex, quizState, selectedAnswer]);

  const score = answers.filter(a => a.isCorrect).length;

  const handleAnswerSelect = (optionIndex) => {
    if (quizState === 'in_progress') setSelectedAnswer(optionIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null || (typeof selectedAnswer === 'string' && selectedAnswer.trim() === '')) return;

    let isCorrect = false;
    // According to specification: SHORT_ANSWER questions store the correct answer directly
    if (currentQuestion && currentQuestion.question_type === 'short_answer') {
      // For short-answer questions, compare text (case-insensitive, trimmed)
      const userAnswer = typeof selectedAnswer === 'string' ? selectedAnswer.trim().toLowerCase() : '';
      // For SHORT_ANSWER, the correct answer is stored directly (not in options)
      const expectedAnswer = typeof currentQuestion.correct === 'string' ? currentQuestion.correct.trim().toLowerCase() : '';
      isCorrect = userAnswer === expectedAnswer || (expectedAnswer && userAnswer.includes(expectedAnswer));
    } else if (currentQuestion) {
      // For MCQ questions, compare index
      isCorrect = selectedAnswer === currentQuestion.correct;
    }
    
    // Store answer with selected answer value
    setAnswers(prev => {
      // Remove existing answer for this question if any
      const filtered = prev.filter(a => a.questionIndex !== currentQuestionIndex);
      return [...filtered, { questionIndex: currentQuestionIndex, selectedAnswer, isCorrect }];
    });
    setQuizState('feedback');
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      
      // Check if this question was already answered
      const existingAnswer = answers.find(a => a.questionIndex === prevIndex);
      if (existingAnswer) {
        // Question was answered - show feedback state
        setSelectedAnswer(existingAnswer.selectedAnswer);
        setQuizState('feedback');
      } else {
        // Question not answered - show in progress
        setSelectedAnswer(null);
        setQuizState('in_progress');
      }
      setShowAITutor(false);
      setPracticeQuestion(null);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // Check if this question was already answered
      const existingAnswer = answers.find(a => a.questionIndex === nextIndex);
      if (existingAnswer) {
        // Question was answered - show feedback state
        setSelectedAnswer(existingAnswer.selectedAnswer);
        setQuizState('feedback');
      } else {
        // Question not answered - show in progress
        setSelectedAnswer(null);
        setQuizState('in_progress');
      }
      setShowAITutor(false);
      setPracticeQuestion(null);
    } else {
      // Last question - show results
      setQuizState('completed');
    }
  };

  const handleGoToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    
    // Check if this question was already answered
    const existingAnswer = answers.find(a => a.questionIndex === index);
    if (existingAnswer) {
      // Question was answered - show feedback state
      setSelectedAnswer(existingAnswer.selectedAnswer);
      setQuizState('feedback');
    } else {
      // Question not answered - show in progress
      setSelectedAnswer(null);
      setQuizState('in_progress');
    }
    setShowAITutor(false);
    setPracticeQuestion(null);
  };

  // Helper to render tables
  const renderTables = (tables) => {
    if (!tables || tables.length === 0) return null;
    
    // Ensure tables is an array
    const tablesArray = Array.isArray(tables) ? tables : [tables];
    
    return tablesArray.map((table, tableIndex) => {
      // Validate table structure
      if (!table || !Array.isArray(table)) {
        return null;
      }
      
      return (
        <div key={tableIndex} className="mb-6 overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
            <tbody>
              {table.map((row, rowIndex) => {
                // Validate row structure
                if (!row || !Array.isArray(row.cells)) {
                  return null;
                }
                
                return (
                  <tr key={rowIndex} className={row.isHeader ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}>
                    {row.cells.map((cell, cellIndex) => {
                      // Handle different cell content types
                      let cellContent = '';
                      if (typeof cell === 'string') {
                        cellContent = cell;
                      } else if (cell && typeof cell === 'object') {
                        cellContent = cell.content || cell.text || JSON.stringify(cell);
                      } else {
                        cellContent = String(cell);
                      }
                      
                      // Process cell content for HTML entities and special markers
                      cellContent = cellContent
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
                      
                      // Handle image markers in table cells
                      cellContent = cellContent.replace(/\[IMAGE:([^\]]+)\]/g, (match, imageUrl) => {
                        const resolved = resolveImageUrl(imageUrl);
                        return `<img src="${resolved}" alt="Table image" style="max-width: 100px; max-height: 100px; display: inline-block; margin: 2px;" onerror="this.style.display='none'; this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRhYmxlIEltYWdlIEVycm9yPC90ZXh0Pjwvc3ZnPg==';"/>`;
                      });
                      
                      return (
                        <td
                          key={cellIndex}
                          className={`px-4 py-2 border border-gray-300 ${
                            row.isHeader ? 'font-semibold text-gray-800' : 'text-gray-700'
                          }`}
                          dangerouslySetInnerHTML={{ __html: cellContent }}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    });
  };

  // Helper to resolve image URL to a usable src
  const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    let src = imageUrl;
    try { src = decodeURIComponent(imageUrl); } catch {}
    if (src.startsWith('/api/images/')) {
      return `${window.location.origin}${src}`;
    }
    if (!src.startsWith('http') && !src.startsWith('data:')) {
      const fileName = src.split('/').pop().split('?')[0];
      const currentCourseId = selectedCourse?.id || 'course_placeholder';
      const currentLevelValue = currentLevel || 'Easy';
      return `${window.location.origin}/api/images/${encodeURIComponent(currentCourseId)}/${encodeURIComponent(currentLevelValue)}/${encodeURIComponent(fileName)}`;
    }
    return src;
  };

  // Helper to render images inside content
  const renderImage = (imageUrl, altText = "Question diagram") => {
    if (!imageUrl) return null;
    const src = resolveImageUrl(imageUrl);
    return (
      <div className="my-4 flex justify-center">
        <img 
          src={src}
          alt={altText}
          className="max-w-full h-auto rounded-lg border border-gray-200 shadow-md"
          onError={(e) => {
            console.error('Failed to load image:', src);
            if (src && src.startsWith('data:')) {
              e.target.src = src;
            } else {
              try {
                const decodedUrl = decodeURIComponent(src);
                if (decodedUrl !== src) {
                  e.target.src = decodedUrl;
                } else {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgQ291bGQgTm90IEJlIExvYWRlZDwvdGV4dD48L3N2Zz4=';
                }
              } catch {
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgRXJyb3I8L3RleHQ+PC9zdmc+';
              }
            }
          }}
          onLoad={(e) => { e.target.style.display = 'block'; }}
        />
      </div>
    );
  };

  // Helper to render math expressions
  const renderMathExpressions = (mathExpressions) => {
    if (!mathExpressions || mathExpressions.length === 0) return null;
    
    return (
      <div className="my-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700 font-medium mb-2">Mathematical Expressions:</p>
        {mathExpressions.map((expr, idx) => (
          <div key={idx} className="font-mono text-blue-900 my-1">
            ${expr}$
          </div>
        ))}
      </div>
    );
  };

  // Helper to render complex option content (with images, tables, math)
  const renderOptionContent = (content) => {
    // Enhanced debugging
    console.log('Rendering option content:', content, 'Type:', typeof content);
    
    if (!content && content !== 0) return null;
    
    // If content is null or undefined, return empty
    if (content === null || content === undefined) return null;
    
    // If content is a string, render as HTML
    if (typeof content === 'string') {
      // If string is empty or only whitespace, return null
      if (content.trim() === '') return null;
      
      // Handle math expressions wrapped in $...$
      let processedContent = content;
      
      // Replace math expressions with proper formatting
      processedContent = processedContent.replace(/\$([^\$]+)\$/g, (match, expr) => {
        return `<span class="inline-math" style="font-family: 'Times New Roman', serif;">\$${expr}\$</span>`;
      });
      
      // Handle image markers in options - render actual images
      processedContent = processedContent.replace(/\[IMAGE:([^\]]+)\]/g, (match, imageUrl) => {
        const resolved = resolveImageUrl(imageUrl);
        return `<img src="${resolved}" alt="Option image" style="max-width: 100px; max-height: 100px; display: inline-block; margin: 0 5px;" onerror="this.style.display='none'; this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIEVycm9yPC90ZXh0Pjwvc3ZnPg==';"/>`;
      });
      
      // Handle table markers in options - render actual tables
      processedContent = processedContent.replace(/\[TABLE:(\d+)\]/g, (match, tableIndex) => {
        // If we have the actual table data, render it
        if (currentQuestion && currentQuestion.tables && currentQuestion.tables[tableIndex]) {
          const table = currentQuestion.tables[tableIndex];
          let tableHtml = '<table style="display: inline-table; border-collapse: collapse; margin: 5px; font-size: 0.8em;">';
          table.forEach((row, rowIndex) => {
            tableHtml += '<tr>';
            row.cells.forEach((cell, cellIndex) => {
              const cellContent = typeof cell === 'string' ? cell : (cell.content || cell.text || '');
              const cellStyle = row.isHeader ? 'font-weight: bold; background-color: #f0f0f0;' : '';
              tableHtml += `<td style="border: 1px solid #ccc; padding: 2px 4px; ${cellStyle}">${cellContent}</td>`;
            });
            tableHtml += '</tr>';
          });
          tableHtml += '</table>';
          return tableHtml;
        }
        // Fallback to placeholder
        return `<span class="inline-table-placeholder">[Table]</span>`;
      });
      
      // Handle any remaining HTML entities
      processedContent = processedContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      return <div dangerouslySetInnerHTML={{ __html: processedContent }} />;
    }
    
    // If content is an array (which might happen with options), join with spaces
    if (Array.isArray(content)) {
      // Filter out null, undefined, and empty strings
      const filteredContent = content.filter(item => 
        item !== null && 
        item !== undefined && 
        (typeof item !== 'string' || item.trim() !== '')
      );
      // If no valid content left, return null
      if (filteredContent.length === 0) return null;
      
      // Render each item in the array
      return (
        <div>
          {filteredContent.map((item, index) => (
            <div key={index}>{renderOptionContent(item)}</div>
          ))}
        </div>
      );
    }
    
    // If content is an object, render appropriately
    if (typeof content === 'object') {
      // If it's a simple object with a text property, use that
      if (content.text) {
        return renderOptionContent(content.text);
      }
      // If it has content property (from table cell), use that
      if (content.content) {
        return renderOptionContent(content.content);
      }
      // If it has value property, use that
      if (content.value) {
        return renderOptionContent(content.value);
      }
      // Otherwise stringify it
      return <div>{JSON.stringify(content)}</div>;
    }
    
    // Default fallback
    return <div>{content}</div>;
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizState('in_progress');
    setAnswers([]);
    setShowAITutor(false);
    setPracticeQuestion(null);
  };

  const handleNextPhase = () => {
    const nextLevelMap = { 1: 'Medium', 2: 'Hard' };
    const nextLevel = nextLevelMap[phase];
    const scoreRange = getScaledScoreRange(phase);
    const scaledScore = calculateScaledScore(score, questions.length, scoreRange.max);
    
    // Unlock the next level upon successful completion
    unlockNextLevel(selectedCourse.id, currentLevel);

    setPreviousScores(prev => ({
      ...prev,
      [phase === 1 ? 'easy' : phase === 2 ? 'medium' : 'hard']: scaledScore
    }));

    if (nextLevel) {
      setCurrentLevel(nextLevel);
      setCurrentFrame('topicIntro');
    }
  };

  const isCorrect = currentQuestion ? selectedAnswer === currentQuestion.correct : false;

  // AI Tutor Chat Functions
  const handleOpenAITutor = () => {
    if (!currentQuestion) return;
    
    setShowAITutor(true);
    setChatMessages([
      {
        type: 'ai',
        content: `Hello! I see you had some trouble with that question about ${currentTopic}. Let me help you understand it better.

**The correct answer is:** ${currentQuestion.options ? currentQuestion.options[currentQuestion.correct] : ''}

**Explanation:** ${currentQuestion.explanation || ''}

Would you like me to:
1️⃣ Generate a similar SAT-level practice question
2️⃣ Explain this concept in an easy way

Just let me know which option you prefer!`
      }
    ]);
    setPracticeQuestion(null);
  };

  const generateSimilarQuestion = async () => {
    if (!currentQuestion) return;
    
    setIsTyping(true);
    
    try {
      // Call the OpenAI API through our backend
      const response = await fetch('http://localhost:5190/api/ai-tutor/generate-practice-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: currentTopic,
          level: currentLevel,
          question: currentQuestion.question_text || currentQuestion.question,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.options ? currentQuestion.options[currentQuestion.correct] : '',
          explanation: currentQuestion.explanation || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        
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
        
        setPracticeQuestion(practiceQuestionObj);
        setIsTyping(false);
        setChatMessages(prev => [
          ...prev,
          {
            type: 'ai',
            content: `Great choice! Here's a similar SAT-level practice question to help you master this concept:

**${data.question}**

${shuffledOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Take your time to think about it, and let me know your answer!`
          }
        ]);
      } else {
        // Fallback to original implementation if API call fails
        console.error('Failed to generate practice question via API, using fallback');
        setTimeout(() => {
          if (!currentQuestion.options) return;
          
          const correctAnswer = currentQuestion.options[currentQuestion.correct];
          const options = [
            correctAnswer,
            ...currentQuestion.options.filter((_, index) => index !== currentQuestion.correct).slice(0, 2),
            'A completely different concept'
          ];
          
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

          const similarQuestion = {
            question: `Practice Question: ${currentQuestion.question.replace('According to', 'Based on your understanding of').replace('Based on', 'Considering')}`,
            options: shuffledOptions,
            correct: correctIndex,
            explanation: `This practice question helps reinforce the same concept: ${currentTopic}. The correct answer follows the same logic as the original question.`
          };

          setPracticeQuestion(similarQuestion);
          setIsTyping(false);
          setChatMessages(prev => [
            ...prev,
            {
              type: 'ai',
              content: `Great choice! Here's a similar practice question to help you master this concept:

**${similarQuestion.question}**

${similarQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Take your time to think about it, and let me know your answer!`
            }
          ]);
        }, 2000);
      }
    } catch (error) {
      // Fallback to original implementation if API call fails
      console.error('Error generating practice question via API, using fallback:', error);
      setTimeout(() => {
        if (!currentQuestion.options) return;
        
        const correctAnswer = currentQuestion.options[currentQuestion.correct];
        const options = [
          correctAnswer,
          ...currentQuestion.options.filter((_, index) => index !== currentQuestion.correct).slice(0, 2),
          'A completely different concept'
        ];
        
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

        const similarQuestion = {
          question: `Practice Question: ${currentQuestion.question.replace('According to', 'Based on your understanding of').replace('Based on', 'Considering')}`,
          options: shuffledOptions,
          correct: correctIndex,
          explanation: `This practice question helps reinforce the same concept: ${currentTopic}. The correct answer follows the same logic as the original question.`
        };

        setPracticeQuestion(similarQuestion);
        setIsTyping(false);
        setChatMessages(prev => [
          ...prev,
          {
            type: 'ai',
            content: `Great choice! Here's a similar practice question to help you master this concept:

**${similarQuestion.question}**

${similarQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Take your time to think about it, and let me know your answer!`
          }
        ]);
      }, 2000);
    }
  };

  const explainConceptSimply = async () => {
    if (!currentQuestion) return;
    
    setIsTyping(true);
    
    try {
      // Call the OpenAI API through our backend
      const response = await fetch('http://localhost:5190/api/ai-tutor/explain-concept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: currentTopic,
          level: currentLevel,
          question: currentQuestion.question_text || currentQuestion.question,
          correctAnswer: currentQuestion.options ? currentQuestion.options[currentQuestion.correct] : '',
          explanation: currentQuestion.explanation || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setIsTyping(false);
        setChatMessages(prev => [
          ...prev,
          {
            type: 'ai',
            content: `${data.explanation}

Should I give you one more example?`
          }
        ]);
      } else {
        // Fallback to original implementation if API call fails
        console.error('Failed to explain concept via API, using fallback');
        setIsTyping(false);
        setChatMessages(prev => [
          ...prev,
          {
            type: 'ai',
            content: `Let me explain ${currentTopic} in an easy way:

Think of it like building blocks. First, you need to understand the basic foundation (${currentLevel} level). Then you can add more complex ideas on top.

The key point from the question is: ${currentQuestion && currentQuestion.explanation ? currentQuestion.explanation.split('.')[0] : ''}.

Does this help clarify the concept for you?`
          }
        ]);
      }
    } catch (error) {
      // Fallback to original implementation if API call fails
      console.error('Error explaining concept via API, using fallback:', error);
      setIsTyping(false);
      setChatMessages(prev => [
        ...prev,
        {
          type: 'ai',
          content: `Let me explain ${currentTopic} in an easy way:

Think of it like building blocks. First, you need to understand the basic foundation (${currentLevel} level). Then you can add more complex ideas on top.

The key point from the question is: ${currentQuestion && currentQuestion.explanation ? currentQuestion.explanation.split('.')[0] : ''}.

Does this help clarify the concept for you?`
        }
      ]);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setChatInput('');
    setIsTyping(true);

    if (practiceQuestion) {
      // Handle practice question answers
      const answerIndex = parseInt(userMessage) - 1;
      if (!isNaN(answerIndex) && practiceQuestion.options && answerIndex >= 0 && answerIndex < practiceQuestion.options.length) {
        const isPracticeCorrect = answerIndex === practiceQuestion.correct;
        const responseMessage = isPracticeCorrect ?
          `🎉 **Excellent!** That's the correct answer!

${practiceQuestion.explanation}

You're really getting the hang of ${currentTopic}. Keep up the great work!

Would you like me to:
1️⃣ Generate a similar question for extra practice
2️⃣ Explain this concept in a different way` :
          `Not quite right. The correct answer is **${practiceQuestion.options[practiceQuestion.correct]}**.

${practiceQuestion.explanation}

Would you like me to:
1️⃣ Generate a similar question for extra practice
2️⃣ Explain this concept in a different way`;
        
        setPracticeQuestion(null);
        setChatMessages(prev => [...prev, { type: 'ai', content: responseMessage }]);
        setIsTyping(false);
      } else {
        setChatMessages(prev => [...prev, { type: 'ai', content: 'Please select a number from 1 to 4 for your answer.' }]);
        setIsTyping(false);
      }
    } else {
      // Handle general chat responses
      if (userMessage.includes('1') || userMessage.toLowerCase().includes('practice')) {
        await generateSimilarQuestion();
      } else if (userMessage.includes('2') || userMessage.toLowerCase().includes('explain')) {
        await explainConceptSimply();
      } else {
        setChatMessages(prev => [...prev, { 
          type: 'ai', 
          content: `I'm here to help you with ${currentTopic}! Would you like me to:
1️⃣ Generate a similar SAT-level practice question
2️⃣ Explain this concept in an easy way

Just let me know which option you'd prefer!` 
        }]);
        setIsTyping(false);
      }
    }
  };

  // Enhanced loading state
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Loading Quiz Questions</h2>
          <p className="text-gray-600 mb-2">{loadingMessage}</p>
          <p className="text-sm text-gray-500">Fetching from SQL API for {currentTopic} - {currentLevel} level</p>
        </div>
      </motion.div>
    );
  }

  if (questions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center py-12">
          <SafeIcon icon={FiHelpCircle} className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Quiz Questions Available</h2>
          <p className="text-gray-600 mb-6">
            No quiz questions found for {currentLevel} level. Please ask your instructor to upload quiz documents.
          </p>
          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setCurrentFrame('learningMaterials')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Review Study Materials
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => {
                setSelectedCourse(null);
                setCurrentFrame('welcome');
              }}
              className="block mx-auto text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Course Selection
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (quizState === 'completed') {
    const scorePercentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const passed = scorePercentage >= 10;
    const scoreRange = getScaledScoreRange(phase);
    const scaledScore = calculateScaledScore(score, questions.length, scoreRange.max);
    const updatedScores = {
      ...previousScores,
      [phase === 1 ? 'easy' : phase === 2 ? 'medium' : 'hard']: scaledScore
    };
    const isLastPhase = phase === 3;

    if (passed && !isLastPhase) {
      unlockNextLevel(selectedCourse.id, currentLevel);
    }

    let overallScore = 0;
    let maxOverallScore = 0;

    if (isLastPhase) {
      const easyRange = getScaledScoreRange(1);
      const mediumRange = getScaledScoreRange(2);
      const hardRange = getScaledScoreRange(3);
      overallScore = updatedScores.easy + updatedScores.medium + updatedScores.hard;
      maxOverallScore = easyRange.max + mediumRange.max + hardRange.max;
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-xl p-8">
        {isLastPhase && showScoreReport ? (
          <div className="text-center">
            <SafeIcon icon={FiBarChart2} className="h-20 w-20 text-blue-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Scaled Score Report</h1>
            <div className="space-y-4 mb-8">
              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Easy Phase Score</h3>
                <p className="text-2xl font-bold text-green-600">{updatedScores.easy} / 400</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Intermediate Phase Score</h3>
                <p className="text-2xl font-bold text-yellow-600">{updatedScores.medium} / 600</p>
              </div>
              <div className="bg-red-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Advanced Phase Score</h3>
                <p className="text-2xl font-bold text-red-600">{updatedScores.hard} / 800</p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-2">Overall Scaled Score</h3>
                <p className="text-3xl font-bold text-blue-600">{overallScore} / {maxOverallScore}</p>
              </div>
            </div>
            <div className="flex space-x-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => {
                  setSelectedCourse(null);
                  setCurrentFrame('welcome');
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Back to Course Selection
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowScoreReport(false)}
                className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold"
              >
                View Phase Details
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <SafeIcon
              icon={passed ? FiAward : FiRefreshCw}
              className={`h-20 w-20 mx-auto mb-6 ${passed ? 'text-yellow-500' : 'text-red-500'}`}
            />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {phase === 3 ? (passed ? 'Excellent work!' : 'Review Required') : `Phase ${phase} Complete!`}
            </h1>
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="text-xl mb-2">
                Your Score: <span className="font-bold text-blue-600">{scorePercentage}%</span> ({score}/{questions.length})
              </div>
              <div className="text-lg">
                Scaled Score: <span className="font-bold text-green-600">{scaledScore} / {scoreRange.max}</span>
              </div>
              {questions.some(q => q.source === 'sql_database' || q.source === 'uploaded_document') && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700">
                    <SafeIcon icon={FiCheckCircle} className="inline h-4 w-4 mr-1" />
                    <strong>✅ Source:</strong> Questions loaded from parsed documents
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {questions.filter(q => q.source === 'sql_database').length} questions from parsed documents
                  </div>
                </div>
              )}
            </div>
            {passed ? (
              phase < 3 ? (
                <>
                  <p className="text-gray-600 mb-6">Great job! You have unlocked the {phase === 1 ? 'Intermediate' : 'Advanced'} Phase!</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={handleNextPhase}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold"
                  >
                    Proceed to Phase {phase + 1}
                  </motion.button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-6">Congratulations! You have completed all phases.</p>
                  {isLastPhase && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => setShowScoreReport(true)}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mb-4"
                    >
                      View Complete Score Report
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => {
                      setSelectedCourse(null);
                      setCurrentFrame('welcome');
                    }}
                    className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold"
                  >
                    Back to Course Selection
                  </motion.button>
                </>
              )
            ) : (
              <>
                <p className="text-gray-600 mb-6">You scored below 10%. Review the topic and retry Phase {phase}.</p>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setCurrentFrame('learningMaterials')}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
                  >
                    Review Materials
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={handleRestartQuiz}
                    className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold"
                  >
                    Retry Quiz
                  </motion.button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Phase {phase}: {currentTopic} Quiz</h1>
            <div className="text-xs text-gray-500 mt-1">
              {currentQuestion && currentQuestion.question_type && (
                <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800">
                  {currentQuestion.question_type === 'mcq' ? 'Multiple Choice' : 
                   currentQuestion.question_type === 'short_answer' ? 'Short Answer' : 
                   'Image Based'}
                </span>
              )}
              {currentQuestion && (currentQuestion.tables || currentQuestion.math_expressions) && (
                <span className="inline-block px-2 py-1 rounded bg-purple-100 text-purple-800 ml-2">
                  {currentQuestion.tables && '📊 Table'}
                  {currentQuestion.math_expressions && ' 📐 Math'}
                </span>
              )}
            </div>
          </div>
          <div className="text-sm font-medium">Q.{currentQuestion && currentQuestion.question_number ? currentQuestion.question_number : currentQuestionIndex + 1}/{questions.length}</div>
        </div>
        
        {/* Question Navigation Pills */}
        <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
          {questions.map((q, idx) => {
            const isAnswered = answers.some(a => a.questionIndex === idx);
            const isCorrect = answers.find(a => a.questionIndex === idx)?.isCorrect;
            return (
              <button
                key={idx}
                onClick={() => handleGoToQuestion(idx)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${
                  idx === currentQuestionIndex
                    ? 'bg-blue-600 text-white font-semibold'
                    : isAnswered
                    ? isCorrect
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {q.question_number || idx + 1}
              </button>
            );
          })}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <motion.div
            className="bg-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {questions.some(q => q.source === 'sql_database') && (
          <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2 text-green-700">
              <SafeIcon icon={FiCheckCircle} className="h-4 w-4" />
              <span className="text-sm font-medium">
                ✅ Questions loaded from parsed documents
              </span>
            </div>
            {currentQuestion && currentQuestion.documentName && (
              <div className="text-xs text-green-600 mt-1">
                Current question from: {currentQuestion.documentName}
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            {/* Display question text first */}
            <h2 className="text-xl font-semibold mb-6">
              {currentQuestion && currentQuestion.question ? (
                typeof currentQuestion.question === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: currentQuestion.question }} />
                ) : (
                  renderOptionContent(currentQuestion.question)
                )
              ) : (
                'No question text available'
              )}
            </h2>
            
            {/* Display mathematical expressions and equations in question if available */}
            {currentQuestion && currentQuestion.math_expressions && renderMathExpressions(currentQuestion.math_expressions)}
            
            {/* Display image after question text and math expressions as per requirements */}
            {currentQuestion && currentQuestion.image_url && currentQuestion.image_url.trim() !== '' && renderImage(currentQuestion.image_url)}
            
            {/* Display tables after images if available */}
            {currentQuestion && currentQuestion.tables && renderTables(currentQuestion.tables)}
            
            {/* Render based on question type */}
            {/* Use question_type field instead of checking options content */}
            {(() => {
                // Use the correct logic based on the project specification
                // For MCQ type: Exactly 4 options → use radio buttons
                // For SHORT_ANSWER type: One or no option → use a text input
                const isMCQ = currentQuestion && currentQuestion.options && currentQuestion.options.length === 4;
                const isShortAnswer = currentQuestion && currentQuestion.question_type === 'short_answer';
                
                // Enhanced debugging for the decision making
                console.log('Rendering decision - isMCQ:', isMCQ, 'isShortAnswer:', isShortAnswer, 'currentQuestion:', currentQuestion);
                
                // Render based on question type as per specification
                return isMCQ ? (
                  <div className="space-y-3 mt-6">
                    {/* Exactly 4 options for MCQ as per requirements */}
                    {currentQuestion.options.map((option, index) => {
                      // Debug each option
                      console.log('Rendering option', index, ':', option);
                      return (
                        <div key={index} className="relative">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            onClick={() => handleAnswerSelect(index)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedAnswer === index
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-400'
                            } ${
                              quizState === 'feedback' && currentQuestion && index === currentQuestion.correct
                                ? '!bg-green-100 !border-green-500'
                                : ''
                            } ${
                              quizState === 'feedback' && selectedAnswer === index && !isCorrect
                                ? '!bg-red-100 !border-red-500'
                                : ''
                            }`}
                            disabled={quizState !== 'in_progress'}
                          >
                            <div className="flex items-start">
                              <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                              {renderOptionContent(option)}
                            </div>
                          </motion.button>

                          {quizState === 'feedback' && selectedAnswer === index && !isCorrect && currentQuestion && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleOpenAITutor}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 shadow-lg hover:shadow-xl transition-all"
                            >
                              <SafeIcon icon={FiMessageCircle} className="h-4 w-4" />
                              <span>Chat with AI Tutor</span>
                            </motion.button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : isShortAnswer ? (
                  <div className="space-y-4 mt-6">
                    <input
                      type="text"
                      value={selectedAnswer !== null ? (typeof selectedAnswer === 'string' ? selectedAnswer : '') : ''}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      disabled={quizState !== 'in_progress'}
                      placeholder="Type your answer here..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    />
                  </div>
                ) : null;
              })()}
          </motion.div>
        </AnimatePresence>

        {quizState === 'in_progress' && (
          <div className="flex justify-between items-center mt-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <SafeIcon icon={FiChevronLeft} className="h-5 w-5" />
              <span>Previous</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null || (typeof selectedAnswer === 'string' && selectedAnswer.trim() === '')}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => {
                if (currentQuestionIndex < questions.length - 1) {
                  handleNext();
                }
              }}
              disabled={currentQuestionIndex === questions.length - 1}
              className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>Next</span>
              <SafeIcon icon={FiChevronRight} className="h-5 w-5" />
            </motion.button>
          </div>
        )}

        <AnimatePresence>
          {quizState === 'feedback' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center"
            >
              <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                <h3 className={`text-xl font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                </h3>
                {/* Show student answer and correct answer as per requirements */}
                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <h4 className="font-semibold text-blue-800">Your Answer</h4>
                      <p className="mt-1 text-lg font-medium">
                        {selectedAnswer !== null ? 
                          (currentQuestion.question_type === 'short_answer' ? 
                            // For SHORT_ANSWER, the student typed their answer
                            selectedAnswer :
                            // For MCQ, selectedAnswer is an index
                            (typeof selectedAnswer === 'number' && currentQuestion.options ? 
                              (currentQuestion.options[selectedAnswer] ? 
                                renderOptionContent(currentQuestion.options[selectedAnswer]) : 
                                String.fromCharCode(65 + selectedAnswer)) : 
                              selectedAnswer)) : 
                          'No answer selected'}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h4 className="font-semibold text-green-800">Correct Answer</h4>
                      <p className="mt-1 text-lg font-medium">
                        {currentQuestion && currentQuestion.correct !== undefined ? 
                          (currentQuestion.question_type === 'short_answer' ? 
                            // For SHORT_ANSWER, correct answer is stored directly as text
                            currentQuestion.correct :
                            // For MCQ, correct answer is an index into the options array
                            (typeof currentQuestion.correct === 'number' && currentQuestion.options ? 
                              (currentQuestion.options[currentQuestion.correct] ? 
                                renderOptionContent(currentQuestion.options[currentQuestion.correct]) : 
                                String.fromCharCode(65 + currentQuestion.correct)) : 
                              renderOptionContent(currentQuestion.correct))) : 
                          'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Show explanation as per requirements */}
                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-left">
                  <h4 className="font-semibold text-gray-800 mb-2">Explanation</h4>
                  <p className="text-gray-700" dangerouslySetInnerHTML={{ __html: currentQuestion ? currentQuestion.explanation : '' }}></p>
                </div>

                {currentQuestion && currentQuestion.source === 'sql_database' && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg text-left border border-green-200">
                    <div className="text-sm text-green-700">
                      <SafeIcon icon={FiCheckCircle} className="inline h-4 w-4 mr-1" />
                      <strong>✅ Source:</strong> Loaded from parsed document
                    </div>
                    {currentQuestion.documentName && (
                      <div className="text-xs text-green-600 mt-1">
                        Document: {currentQuestion.documentName}
                      </div>
                    )}
                    {currentQuestion.documentSize && (
                      <div className="text-xs text-green-600">
                        Size: {(currentQuestion.documentSize / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <SafeIcon icon={FiChevronLeft} className="h-5 w-5" />
                  <span>Previous</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleNext}
                  className="bg-gray-800 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2"
                >
                  <span>{currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Results'}</span>
                  {currentQuestionIndex < questions.length - 1 && (
                    <SafeIcon icon={FiChevronRight} className="h-5 w-5" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showAITutor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                    <SafeIcon icon={FiMessageCircle} className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI Tutor</h3>
                    <p className="text-sm text-gray-500">Helping with {currentTopic}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAITutor(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <SafeIcon icon={FiX} className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-line">{message.content}</p>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="p-6 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={!chatInput.trim() || isTyping}
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuizFrame;