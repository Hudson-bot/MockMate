"use client";
// OpenRouter API utility functions
export async function makeAPIRequest(prompt, retryCount = 3, timeout = 30000) {
  console.log('🔄 API Request:', { 
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemini-2.0-flash-thinking-exp:free',
    promptLength: prompt.length
  });

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`📡 API Attempt ${attempt}/${retryCount}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Replace the hardcoded API key with the one from the environment variable
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer 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',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick:free',
          messages: [
            { 
              role: 'user', 
              content: prompt
            },
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ API Error: HTTP status ${response.status}`, await response.text());
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Log the full response structure to help debug format issues
      console.log('📋 API Response structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      
      // Check if the response has the expected format
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('❌ Invalid API response format - missing choices array:', data);
        throw new Error('Invalid API response format: missing choices array');
      }

      console.log('✅ API Response received:', { 
        status: response.status,
        contentLength: data.choices?.[0]?.message?.content?.length || 0
      });
      return data;
    } catch (error) {
      console.error(`❌ API Error on attempt ${attempt}:`, error.message);
      if (attempt === retryCount) {
        throw error;
      }
      console.log(`🔄 Retrying API request in 1 second...`);
      // Wait for 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Function to generate interview questions
export async function generateInterviewQuestions(skill) {
  console.log(`🎯 Generating interview questions for skill: ${skill}`);
  try {
    const prompt = `Generate 5 ${skill} interview questions and answers for a mock interview. Include a mix of basic, intermediate, and advanced questions. Format the response as a JSON array where each object has "question", "answer", and "difficulty" fields. Return raw JSON only without any markdown formatting or code blocks.`;
    
    console.time('⏱️ Question Generation Time');
    const data = await makeAPIRequest(prompt);
    console.timeEnd('⏱️ Question Generation Time');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid API response format for question generation:', data);
      throw new Error('Invalid API response format');
    }

    let questions = data.choices[0].message.content;
    
    // Log the raw content to help with debugging
    console.log('📄 Raw questions content:', questions.substring(0, 200) + '...');
    
    // Clean up the response by removing any markdown formatting
    questions = questions.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    
    // Additional cleaning for common formatting issues
    if (questions.startsWith('[') && questions.endsWith(']')) {
      // Direct JSON array - good to parse
    } else if (questions.includes('```json')) {
      // Multiple code blocks - extract the JSON part
      const jsonMatch = questions.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        questions = jsonMatch[1].trim();
      }
    } else if (questions.includes('```')) {
      // Generic code block - extract content
      const codeMatch = questions.match(/```\s*([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        questions = codeMatch[1].trim();
      }
    }
    
    // Parse the response as JSON
    try {
      // Attempt to parse the cleaned response
      const parsedQuestions = JSON.parse(questions);
      
      // Validate the structure of the questions
      if (!Array.isArray(parsedQuestions)) {
        console.error('❌ Expected array of questions but got:', typeof parsedQuestions);
        throw new Error('Invalid response format: not an array');
      }
      
      // Validate each question has the required fields
      const validQuestions = parsedQuestions.filter(q => 
        q && typeof q === 'object' && 
        typeof q.question === 'string' && 
        typeof q.answer === 'string' && 
        typeof q.difficulty === 'string'
      );
      
      if (validQuestions.length === 0) {
        console.error('❌ No valid questions found in response');
        throw new Error('No valid questions in response');
      }
      
      console.log(`✅ Successfully generated ${validQuestions.length} questions for ${skill}`);
      return validQuestions;
    } catch (parseError) {
      console.error('❌ Error parsing JSON response:', parseError, 'Raw content:', questions);
      
      // Last resort - try to extract an array from the text if it contains square brackets
      const arrayMatch = questions.match(/\[([\s\S]*)\]/);
      if (arrayMatch && arrayMatch[0]) {
        try {
          const extractedArray = JSON.parse(arrayMatch[0]);
          if (Array.isArray(extractedArray) && extractedArray.length > 0) {
            console.log(`⚠️ Extracted questions using fallback method: ${extractedArray.length} questions`);
            return extractedArray;
          }
        } catch (e) {
          console.error('❌ Fallback extraction failed:', e);
        }
      }
      
      throw new Error('Failed to parse questions response: ' + parseError.message);
    }
  } catch (error) {
    console.error('❌ Error in generateInterviewQuestions:', error);
    throw error;
  }
}

// Function to analyze user's answer
export async function analyzeAnswer(question, userAnswer) {
  console.log(`🔍 Analyzing answer for question: "${question.substring(0, 30)}..."`);
  console.log(`📝 Answer length: ${userAnswer.length} characters`);
  
  try {
    console.time('⏱️ Answer Analysis Time');
    const prompt = `You are an interview assessment AI. Analyze this answer to the following interview question: 
    
    Question: "${question}"
    
    Answer: "${userAnswer}"
    
    Analyze the answer across multiple dimensions and provide a comprehensive assessment. Include specific analysis and a score (1-10) for each of these dimensions:
    
    1. Technical Accuracy: How technically correct and precise is the answer?
    2. Completeness: How thorough and comprehensive is the answer? Does it cover all important aspects?
    3. Communication: How clear, coherent, and well-articulated is the answer?
    4. Problem-Solving: How effective is the approach to solving the problem?
    5. Knowledge Depth: How much in-depth understanding does the answer demonstrate?
    
    Also provide an overall score and a brief assessment. Return your response in JSON format with the following structure:
    {
      "dimensions": {
        "technicalAccuracy": { "score": X, "comments": "..." },
        "completeness": { "score": X, "comments": "..." },
        "communication": { "score": X, "comments": "..." },
        "problemSolving": { "score": X, "comments": "..." },
        "knowledgeDepth": { "score": X, "comments": "..." }
      },
      "overallScore": X,
      "assessment": "Brief overall assessment"
    }
    
    Return only the JSON without any markdown formatting or additional text.`;
    
    const data = await makeAPIRequest(prompt);
    console.timeEnd('⏱️ Answer Analysis Time');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid API response format for answer analysis:', data);
      throw new Error('Invalid API response format');
    }

    let analysis = data.choices[0].message.content;
    
    // Clean up the response
    analysis = analysis.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    
    // Parse the response as JSON
    try {
      const parsedAnalysis = JSON.parse(analysis);
      console.log(`✅ Answer analysis complete. Overall Score: ${parsedAnalysis.overallScore}`);
      return parsedAnalysis;
    } catch (parseError) {
      console.error('❌ Error parsing JSON analysis:', parseError, 'Raw content:', analysis);
      // If parsing fails, return a formatted object with the raw response
      console.log('⚠️ Returning unstructured analysis');
      return {
        dimensions: {
          technicalAccuracy: { score: 0, comments: 'Analysis failed' },
          completeness: { score: 0, comments: 'Analysis failed' },
          communication: { score: 0, comments: 'Analysis failed' },
          problemSolving: { score: 0, comments: 'Analysis failed' },
          knowledgeDepth: { score: 0, comments: 'Analysis failed' }
        },
        overallScore: 0,
        assessment: analysis || "Sorry, I couldn't analyze this answer due to a technical error."
      };
    }
  } catch (error) {
    console.error('❌ Error in analyzeAnswer:', error);
    return {
      dimensions: {
        technicalAccuracy: { score: 0, comments: 'Analysis failed' },
        completeness: { score: 0, comments: 'Analysis failed' },
        communication: { score: 0, comments: 'Analysis failed' },
        problemSolving: { score: 0, comments: 'Analysis failed' },
        knowledgeDepth: { score: 0, comments: 'Analysis failed' }
      },
      overallScore: 0,
      assessment: "Sorry, I couldn't analyze this answer due to a technical error."
    };
  }
}

// Function for real-time analysis of partial answers (as the user is typing/speaking)
export async function analyzePartialAnswer(question, partialAnswer) {
  // Only analyze if we have enough content
  if (partialAnswer.length < 20) {
    return null;
  }
  
  console.log(`🔍 Quick analyzing partial answer (${partialAnswer.length} chars)`);
  
  try {
    const prompt = `You are an interview assessment AI. Provide a quick analysis of this partial answer to the following interview question. The candidate is still answering, so focus only on what they've said so far:
    
    Question: "${question}"
    
    Partial Answer So Far: "${partialAnswer}"
    
    Provide a very brief assessment and a preliminary overall score from 1-10. Return your response in JSON format with fields "quickAssessment" and "preliminaryScore" without any additional text or formatting.`;
    
    const data = await makeAPIRequest(prompt);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return null;
    }

    let analysis = data.choices[0].message.content;
    analysis = analysis.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    
    try {
      const parsedAnalysis = JSON.parse(analysis);
      console.log(`✅ Quick analysis complete. Preliminary score: ${parsedAnalysis.preliminaryScore}`);
      return parsedAnalysis;
    } catch (parseError) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

// Function to generate overall feedback
export async function generateFeedback(interviewResults) {
  console.log(`📊 Generating overall feedback for ${interviewResults.length} answers`);
  
  try {
    // Create a summary of all questions and answers
    const interviewSummary = interviewResults.map((result, index) => {
      return `Question ${index + 1}: ${result.question}\nUser's Answer: ${result.userAnswer}\nAssessment: ${result.analysis.assessment}\nScore: ${result.analysis.score}`;
    }).join('\n\n');
    
    console.log(`📄 Summary length: ${interviewSummary.length} characters`);
    console.time('⏱️ Feedback Generation Time');
    
    const prompt = `You are an interview coach AI. Based on these interview responses, provide comprehensive feedback about the candidate's performance. 
    
    Here are the details of the interview:
    
    ${interviewSummary}
    
    Provide feedback including:
    1. Overall performance summary
    2. Strengths demonstrated
    3. Areas for improvement
    4. Specific technical concepts the candidate should study more
    5. General interview technique advice
    
    Return the feedback in JSON format with fields "overallFeedback", "strengths", "areasToImprove", "conceptsToStudy", and "interviewTips".`;
    
    const data = await makeAPIRequest(prompt);
    console.timeEnd('⏱️ Feedback Generation Time');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid API response format for feedback generation:', data);
      throw new Error('Invalid API response format');
    }

    let feedback = data.choices[0].message.content;
    
    // Clean up the response
    feedback = feedback.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    
    // Parse the response as JSON
    try {
      const parsedFeedback = JSON.parse(feedback);
      console.log('✅ Feedback generation complete:', {
        overallFeedbackLength: parsedFeedback.overallFeedback?.length || 0,
        strengthsCount: parsedFeedback.strengths?.length || 0,
        areasToImproveCount: parsedFeedback.areasToImprove?.length || 0
      });
      return parsedFeedback;
    } catch (parseError) {
      console.error('❌ Error parsing JSON feedback:', parseError, 'Raw content:', feedback);
      // If parsing fails, return a formatted object with the raw response
      console.log('⚠️ Returning unstructured feedback');
      return {
        overallFeedback: feedback,
        strengths: [],
        areasToImprove: [],
        conceptsToStudy: [],
        interviewTips: []
      };
    }
  } catch (error) {
    console.error('❌ Error in generateFeedback:', error);
    return {
      overallFeedback: "Sorry, I couldn't generate comprehensive feedback due to a technical error.",
      strengths: [],
      areasToImprove: [],
      conceptsToStudy: [],
      interviewTips: []
    };
  }
}
