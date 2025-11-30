import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { TestQuestion, UnitTest, StudentTestResult } from '../../types';
import { supabase } from '../../supabase';

interface StudentTestRoomProps {
    testId: string;
    onExit: () => void;
}

const normalizeSpelling = (text: string): string => {
    let normalizedText = text.trim().toLowerCase().replace(/’|'/g, "'");
    
    const contractionMap: { [key: string]: string } = {
        "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is",
        "it's": "it is", "we're": "we are", "they're": "they are", "aren't": "are not",
        "can't": "can not", "couldn't": "could not", "didn't": "did not",
        "doesn't": "does not", "don't": "do not", "hadn't": "had not", "hasn't": "has not",
        "haven't": "have not", "isn't": "is not", "shouldn't": "should not",
        "wasn't": "was not", "weren't": "were not", "won't": "will not",
        "wouldn't": "would not", "what's": "what is", "where's": "where is",
        "when's": "when is", "who's": "who is", "why's": "why is", "how's": "how is",
        "let's": "let us"
    };
    
    for (const contraction in contractionMap) {
        // Using word boundaries (\b) to avoid replacing parts of words.
        const regex = new RegExp(`\\b${contraction}\\b`, 'g');
        normalizedText = normalizedText.replace(regex, contractionMap[contraction]);
    }
    
    // Also normalize multi-word forms like "cannot" to a standard "can not"
    normalizedText = normalizedText.replace(/\bcannot\b/g, "can not");
    
    return normalizedText;
};


const StudentTestRoom: React.FC<StudentTestRoomProps> = ({ testId, onExit }) => {
    const { state } = useApp();
    const { unitTests, loggedInUser, units } = state;

    const test = unitTests.find(t => t.id === testId) || null;

    const questions: TestQuestion[] = useMemo(() => {
        return test?.questions || [];
    }, [test?.questions]);

    const results: StudentTestResult[] = useMemo(() => {
        return test?.results || [];
    }, [test?.results]);


    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
    
    const handleSubmit = useCallback(async () => {
        if (!test || !questions || !loggedInUser || isSubmitted) return;
        
        const currentAnswers = userAnswers;
        setIsSubmitted(true);

        let correctCount = 0;
        
        const answerResults = questions.map((q, index) => {
            const userAnswerRaw = currentAnswers[index] || '';
            let isCorrect = false;
            
            switch(q.type) {
                case 'spell': {
                    const normalizedStudentAnswer = normalizeSpelling(userAnswerRaw);
                    const normalizedCorrectAnswer = normalizeSpelling(q.word.english);
                    isCorrect = normalizedStudentAnswer === normalizedCorrectAnswer;
                    break;
                }
                case 'choose_translation': {
                    isCorrect = userAnswerRaw.trim().toLowerCase() === q.word.russian.toLowerCase();
                    break;
                }
                case 'choose_picture': {
                    isCorrect = userAnswerRaw.trim() === q.word.image_url;
                    break;
                }
            }
            if(isCorrect) correctCount++;
            return { questionIndex: index, answer: userAnswerRaw, isCorrect };
        });

        const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
        
        const finalResult = {
            studentId: loggedInUser.id,
            answers: answerResults,
            score,
            completedAt: new Date().toISOString()
        };

        try {
            const { error } = await supabase.rpc('submit_test_answers', {
                test_id: test.id,
                student_result: finalResult
            });
            if (error) {
                throw error;
            }
            // Broadcast the update after a successful submission
            supabase.channel('test-updates').send({
                type: 'broadcast',
                event: 'submission',
                payload: { testId: test.id },
            });
        } catch(error: any) {
            console.error("Exception when submitting test results:", error);
            console.error(`DATABASE ERROR: Failed to submit test results. Please show this error to the developer: ${error.message}`);
            setIsSubmitted(false); // Allow retry on failure
            return;
        }
    }, [test, questions, loggedInUser, isSubmitted, userAnswers]);

    useEffect(() => {
        if (test) {
            const studentResult = results?.find(r => r.studentId === loggedInUser?.id);
            if (studentResult && !isSubmitted) {
                setIsSubmitted(true);
            }
        }
    }, [test, results, loggedInUser, isSubmitted]);
    
    useEffect(() => {
        if (test?.status !== 'in_progress' || !test.start_time || isSubmitted) {
            return;
        }

        const interval = setInterval(() => {
            const elapsedTime = Math.floor((Date.now() - (new Date(test.start_time!).getTime())) / 1000);
            const newTimeLeft = 600 - elapsedTime;

            if (newTimeLeft <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
                handleSubmit();
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [test?.status, test?.start_time, isSubmitted, handleSubmit]);

    useEffect(() => {
        if (test?.status === 'completed' && !isSubmitted) {
            handleSubmit();
        }
    }, [test?.status, isSubmitted, handleSubmit]);

    const currentQuestion: TestQuestion | undefined = questions?.[currentQuestionIndex];
    
    const handleAnswerChange = (answer: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setUserAnswers(newAnswers);
    };

    const goToNext = () => {
        if (test && questions && currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };
    
    const goToPrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!test) return <div>Loading test...</div>;
    
    if (isSubmitted) {
        return (
             <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                <h2 className="text-3xl font-bold mb-4">Test Submitted!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Your results have been sent to the teacher. You can now leave this page.</p>
                <button onClick={onExit} className="px-6 py-2 bg-blue-500 text-white rounded-lg">Back to Dashboard</button>
            </div>
        );
    }

    if (test.status === 'waiting' || !questions || questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                <h2 className="text-3xl font-bold mb-4">Waiting for the test to start...</h2>
                <p className="text-gray-600 dark:text-gray-400">The teacher has not started the test yet. Please wait.</p>
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 dark:border-gray-100 mt-8"></div>
            </div>
        );
    }
    
    const unit = units.find(u => u.id === test.unit_id);
    
    const renderQuestion = () => {
        if (!currentQuestion) return null;
        const questionContainerClasses = "w-full max-w-md mx-auto flex flex-col items-center";
        const questionCardClasses = "w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 text-center";

        switch(currentQuestion.type) {
            case 'spell':
                return (
                    <div className={questionContainerClasses}>
                        <div className={questionCardClasses}>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Spell the word correctly</p>
                             <div className="w-full h-40 sm:h-48 mb-4 flex items-center justify-center rounded-lg overflow-hidden bg-white p-2">
                                <img src={currentQuestion.word.image_url} alt={currentQuestion.word.russian} className="max-h-full max-w-full object-contain" />
                            </div>
                            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{currentQuestion.word.russian}</p>
                            <div className="relative w-full max-w-sm mx-auto">
                                <input
                                    type="text"
                                    value={userAnswers[currentQuestionIndex] || ''}
                                    onChange={(e) => handleAnswerChange(e.target.value)}
                                    onPaste={(e) => e.preventDefault()}
                                    autoCapitalize="none"
                                    autoComplete="one-time-code"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    className="w-full text-center text-2xl tracking-wider border-b-2 bg-gray-100 dark:bg-gray-700 focus:outline-none focus:border-yellow-400 p-2 rounded-t-lg dark:text-gray-200 dark:border-gray-600 dark:focus:border-yellow-500"
                                    placeholder="Type here..."
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'choose_translation':
                return (
                    <div className={questionContainerClasses}>
                         <div className={questionCardClasses}>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose the correct translation</p>
                            <div className="w-full h-32 sm:h-40 mb-4 flex items-center justify-center rounded-lg overflow-hidden bg-white p-2">
                                <img src={currentQuestion.word.image_url} alt="word image" className="max-h-full max-w-full object-contain" />
                            </div>
                            <p className="text-4xl font-bold mb-6">{currentQuestion.word.english}</p>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                {currentQuestion.options?.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleAnswerChange(option)}
                                        className={`p-4 rounded-xl text-lg font-semibold w-full transition-all duration-200 ${userAnswers[currentQuestionIndex] === option ? 'bg-blue-500 text-white ring-2 ring-blue-700' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'choose_picture':
                 return (
                    <div className={questionContainerClasses}>
                        <div className={questionCardClasses}>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose the correct picture</p>
                            <p className="text-4xl font-bold mb-6">{currentQuestion.word.english}</p>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                {currentQuestion.options?.map(optionUrl => (
                                    <button
                                        key={optionUrl}
                                        onClick={() => handleAnswerChange(optionUrl)}
                                        className={`p-2 bg-white dark:bg-gray-700 rounded-xl transition-all duration-200 ${userAnswers[currentQuestionIndex] === optionUrl ? 'ring-4 ring-blue-500' : 'hover:opacity-80'}`}
                                    >
                                        <img src={optionUrl} alt="option" className="w-full h-32 sm:h-40 object-contain rounded-lg"/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
        }
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            <header className="bg-gray-800 text-white p-4 rounded-b-2xl shadow-lg flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold">{unit?.title} Test</h1>
                        <p className="text-sm text-gray-400">Question {currentQuestionIndex + 1} of {questions.length}</p>
                    </div>
                    <div className="font-bold text-lg bg-gray-700 px-4 py-1 rounded-full">{formatTime(timeLeft)}</div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-4">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                {renderQuestion()}
            </main>

            <footer className="flex justify-between items-center p-4 border-t dark:border-gray-700 flex-shrink-0">
                <button onClick={goToPrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 border dark:border-gray-600 rounded-lg disabled:opacity-50 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800">Previous</button>
                {currentQuestionIndex === questions.length - 1 ? (
                    <button onClick={() => handleSubmit()} className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600">Submit Test</button>
                ) : (
                    <button onClick={goToNext} className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">Next</button>
                )}
            </footer>
        </div>
    );
};

export default StudentTestRoom;