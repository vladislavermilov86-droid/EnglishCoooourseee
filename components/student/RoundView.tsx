import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, Round, Word, AttemptHistory, RoundProgress, Answer } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon, VolumeUpIcon, ArrowRightIcon, CheckCircleIcon } from '../icons/Icons';
import { supabase } from '../../supabase';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

type Stage = 'learn' | 'spell' | 'choose_translation' | 'choose_picture' | 'results';
const STAGES_ORDER: Stage[] = ['learn', 'spell', 'choose_translation', 'choose_picture', 'results'];
const TEST_STAGES: ('spell' | 'choose_translation' | 'choose_picture')[] = ['spell', 'choose_translation', 'choose_picture'];

const shuffleArray = <T,>(array: T[]): T[] => {
    return [...array].sort(() => Math.random() - 0.5);
};

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
        // Using word boundaries (\\b) to avoid replacing parts of words.
        const regex = new RegExp(`\\b${contraction}\\b`, 'g');
        normalizedText = normalizedText.replace(regex, contractionMap[contraction]);
    }
    
    // Also normalize multi-word forms like "cannot" to a standard "can not"
    normalizedText = normalizedText.replace(/\bcannot\b/g, "can not");
    
    return normalizedText;
};


const CorrectAnswerDisplay: React.FC<{ stage: Stage, word: Word }> = ({ stage, word }) => {
    switch (stage) {
        case 'spell':
            return <p className="font-semibold mt-2">Correct answer: <span className="font-bold">{word.english}</span></p>;
        case 'choose_translation':
            return <p className="font-semibold mt-2">Correct answer: <span className="font-bold">{word.russian}</span></p>;
        case 'choose_picture':
            return (
                <div className="mt-2 text-center">
                    <p className="font-semibold">Correct answer:</p>
                    <img src={word.image_url} alt={word.english} className="w-24 h-24 object-contain rounded-lg bg-white p-1 inline-block mt-1" />
                </div>
            );
        default:
            return null;
    }
};

const RoundView: React.FC<{ unit: Unit, onBack: () => void }> = ({ unit, onBack }) => {
    const { state, dispatch } = useApp();
    const { loggedInUser, studentProgress } = state;

    const [selectedRound, setSelectedRound] = useState<Round | null>(null);
    const [stage, setStage] = useState<Stage>('learn');
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [currentAttemptNumber, setCurrentAttemptNumber] = useState(1);
    const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
    const [translationOptions, setTranslationOptions] = useState<string[]>([]);
    const [pictureOptions, setPictureOptions] = useState<string[]>([]);
    const saveCompleted = useRef(false);
    
    const onBackRef = useRef(onBack);
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);
    
    const loggedInUserRef = useRef(loggedInUser);
    useEffect(() => {
        loggedInUserRef.current = loggedInUser;
    }, [loggedInUser]);
    
    const studentProgressRef = useRef(studentProgress);
    useEffect(() => {
        studentProgressRef.current = studentProgress;
    }, [studentProgress]);
    
    const selectedRoundRef = useRef(selectedRound);
    useEffect(() => {
        selectedRoundRef.current = selectedRound;
    }, [selectedRound]);
    
    const currentAttemptNumberRef = useRef(currentAttemptNumber);
    useEffect(() => {
        currentAttemptNumberRef.current = currentAttemptNumber;
    }, [currentAttemptNumber]);


    const currentWord = shuffledWords[currentWordIndex];

    const resetWordState = () => {
        setInputValue('');
        setFeedback(null);
        setIsAnswered(false);
        setSelectedAnswer(null);
    };

    const resetRoundState = () => {
        setStage('learn');
        setCurrentWordIndex(0);
        setUserAnswers([]);
        resetWordState();
    };

    const handleSelectRound = (round: Round) => {
        resetRoundState();
        saveCompleted.current = false; // Reset save guard for new round attempt
        const existingProgress = loggedInUser 
            ? studentProgress[loggedInUser.id]?.unitsProgress[unit.id]?.roundsProgress[round.id] 
            : null;
        
        const newAttemptNumber = (existingProgress?.attempts || 0) + 1;
        setCurrentAttemptNumber(newAttemptNumber);
        setShuffledWords(shuffleArray(round.words));
        setSelectedRound(round);
    };
    
    const handleBackToRoundSelection = () => {
        setSelectedRound(null);
    };

    const speak = (text: string) => {
        if (Capacitor.isNativePlatform()) {
            TextToSpeech.speak({
                text: text,
                lang: 'en-US',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
            }).catch(e => {
                console.error("Error using native TTS", e);
            });
        } else {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            speechSynthesis.speak(utterance);
        }
    };

    const nextStage = () => {
        const currentStageIndex = STAGES_ORDER.indexOf(stage);
        if (currentStageIndex < STAGES_ORDER.length - 1) {
            setStage(STAGES_ORDER[currentStageIndex + 1]);
            setCurrentWordIndex(0);
            resetWordState();
        }
    };

    const nextWord = () => {
        if (currentWordIndex < (selectedRound?.words.length || 0) - 1) {
            setCurrentWordIndex(prev => prev + 1);
            resetWordState();
        } else {
            nextStage();
        }
    };
    
    useEffect(() => {
        if (stage !== 'results' || saveCompleted.current) {
            return;
        }
        
        const saveAndExit = async () => {
             // Use refs to access the latest state
            const currentUser = loggedInUserRef.current;
            const currentRound = selectedRoundRef.current;
            const attemptNum = currentAttemptNumberRef.current;
            const currentProgress = studentProgressRef.current;

            if (!currentUser || !currentRound) {
                console.warn("User or round not available for saving.");
                return;
            }

            saveCompleted.current = true;

            const score = (userAnswers.filter(a => a.isCorrect).length / (currentRound.words.length * TEST_STAGES.length)) * 100;
            
            const newAttempt: AttemptHistory = {
                attemptNumber: attemptNum,
                score: score,
                completedAt: new Date().toISOString(),
                answers: userAnswers,
            };

            const existingProgressDoc = currentProgress[currentUser.id]?.unitsProgress[unit.id]?.roundsProgress[currentRound.id];

            try {
                const newHistory = existingProgressDoc ? [...existingProgressDoc.history, newAttempt] : [newAttempt];
                
                const { data, error } = await supabase.from('round_progress').upsert({
                    id: existingProgressDoc?.id, // Supabase uses id for upsert matching
                    student_id: currentUser.id,
                    unit_id: unit.id,
                    round_id: currentRound.id,
                    completed: true,
                    history: newHistory,
                    attempts: attemptNum
                }).select().single();

                if (error) throw error;
                
                dispatch({ type: 'UPSERT_ROUND_PROGRESS', payload: data as RoundProgress });
                onBackRef.current();

            } catch (error) {
                console.error("Failed to save round progress:", error);
                alert("Could not save your progress. Please check your connection.");
                 saveCompleted.current = false; // Allow retry on failure
            }
        };
        
        saveAndExit();

    }, [stage, userAnswers, unit.id, dispatch]);


    const checkAnswer = (answer: string) => {
        if (isAnswered) return;
        
        if (stage !== 'spell' && stage !== 'choose_translation' && stage !== 'choose_picture') {
            return;
        }
        
        setSelectedAnswer(answer);
        setIsAnswered(true);

        let isCorrect = false;
        switch (stage) {
            case 'spell':
                const normalizedStudentAnswer = normalizeSpelling(answer);
                const normalizedCorrectAnswer = normalizeSpelling(currentWord.english);
                isCorrect = normalizedStudentAnswer === normalizedCorrectAnswer;
                break;
            case 'choose_translation':
                isCorrect = answer === currentWord.russian;
                break;
            case 'choose_picture':
                isCorrect = answer === currentWord.image_url;
                break;
        }

        setUserAnswers(prev => [...prev, { wordId: currentWord.id, stage, answer, isCorrect }]);
        setFeedback(isCorrect ? 'correct' : 'incorrect');

        if (stage === 'choose_translation' || stage === 'choose_picture') {
            setTimeout(() => {
                nextWord();
            }, 1200);
        }
    };

    useEffect(() => {
        if (stage === 'choose_translation' && selectedRound) {
            const allRussianWords = unit.rounds.flatMap(r => r.words.map(w => w.russian));
            const options = [currentWord.russian];
            while (options.length < 4) {
                const randomWord = allRussianWords[Math.floor(Math.random() * allRussianWords.length)];
                if (!options.includes(randomWord)) {
                    options.push(randomWord);
                }
            }
            setTranslationOptions(shuffleArray(options));
        }
        if (stage === 'choose_picture' && selectedRound) {
            const allImageUrls = unit.rounds.flatMap(r => r.words.map(w => w.image_url));
            const options = [currentWord.image_url];
            while (options.length < 4) {
                const randomUrl = allImageUrls[Math.floor(Math.random() * allImageUrls.length)];
                if (!options.includes(randomUrl)) {
                    options.push(randomUrl);
                }
            }
            setPictureOptions(shuffleArray(options));
        }
    }, [stage, currentWordIndex, selectedRound, unit.rounds, currentWord]);


    if (!selectedRound) {
        return (
            <div className="p-4">
                <button onClick={onBack} className="mb-4 font-semibold text-blue-500">&larr; Back to Lessons</button>
                <h2 className="text-2xl font-bold mb-4">{unit.title}</h2>
                <div className="space-y-4">
                    {(unit.rounds || []).map(round => {
                        const roundProgress = loggedInUser ? studentProgress[loggedInUser.id]?.unitsProgress[unit.id]?.roundsProgress[round.id] : null;
                        const lastAttempt = roundProgress?.history?.[roundProgress.history.length - 1];
                        const score = lastAttempt?.score;
                        
                        let scoreColor = 'text-gray-500';
                        if (score !== undefined) {
                            scoreColor = score >= 80 ? 'text-green-500' : 'text-red-500';
                        }

                        return (
                            <div key={round.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex justify-between items-center">
                                <div className="flex items-center space-x-4">
                                    {score !== undefined && (
                                        <div className={`font-bold text-lg ${scoreColor}`}>
                                            {score.toFixed(0)}%
                                        </div>
                                    )}
                                    <p className="font-semibold">{round.title}: Vocabulary Practice</p>
                                </div>
                                <button onClick={() => handleSelectRound(round)} className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition">
                                    {score !== undefined ? 'Retry' : 'Start'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }
    
    const progressPercentage = stage === 'learn'
        ? ((currentWordIndex + 1) / shuffledWords.length) * 100
        : ((userAnswers.length) / (shuffledWords.length * TEST_STAGES.length)) * 100;

    return (
        <div className="flex flex-col h-full max-h-screen">
             <header className="p-4 flex items-center justify-between">
                 <button onClick={handleBackToRoundSelection} className="font-semibold text-blue-500">&larr; Back to Rounds</button>
                <h2 className="text-xl font-bold">{selectedRound.title}</h2>
                 <button onClick={onBack} className="p-2"><XIcon className="w-6 h-6"/></button>
            </header>
             <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-4">
                {stage === 'learn' && (
                    <div className="text-center">
                        <img src={currentWord.image_url} alt={currentWord.english} className="w-80 h-80 object-contain mb-4 rounded-lg bg-white p-2" />
                        <h3 className="text-4xl font-bold">{currentWord.english}</h3>
                        <p className="text-xl text-gray-500">{currentWord.transcription}</p>
                        <p className="text-2xl font-semibold mb-4">{currentWord.russian}</p>
                        <button onClick={() => speak(currentWord.english)} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full"><VolumeUpIcon className="w-8 h-8"/></button>
                    </div>
                )}
                {stage === 'spell' && (
                     <div className="w-full max-w-sm text-center">
                        <p className="mb-4 font-semibold">Spell the word</p>
                        <img src={currentWord.image_url} alt={currentWord.russian} className="w-56 h-56 object-contain mb-4 rounded-lg mx-auto bg-white p-2" />
                        <p className="text-3xl font-bold mb-4">{currentWord.russian}</p>
                        <div className="relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !isAnswered && checkAnswer(inputValue)}
                                onPaste={(e) => e.preventDefault()}
                                autoCapitalize="none" autoComplete="one-time-code" autoCorrect="off" spellCheck="false"
                                className={`w-full text-center text-2xl p-2 border-b-2 bg-gray-100 dark:bg-gray-700 rounded-t-lg focus:outline-none 
                                ${isAnswered && feedback === 'correct' ? 'border-green-500' : isAnswered && feedback === 'incorrect' ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                                disabled={isAnswered}
                            />
                        </div>
                    </div>
                )}
                 {stage === 'choose_translation' && (
                    <div className="w-full max-w-md text-center">
                        <p className="mb-4 font-semibold">Choose the correct translation</p>
                        <div className="w-full h-48 sm:h-56 mb-4 flex items-center justify-center rounded-lg overflow-hidden bg-white p-2">
                            <img src={currentWord.image_url} alt={currentWord.english} className="max-h-full max-w-full object-contain" />
                        </div>
                        <p className="text-4xl font-bold mb-6">{currentWord.english}</p>
                        <div className="grid grid-cols-2 gap-4">
                            {translationOptions.map(option => {
                                const isCorrectOption = option === currentWord.russian;
                                const isSelectedOption = option === selectedAnswer;

                                let buttonClass = 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600';
                                if (isAnswered) {
                                    if (isCorrectOption) {
                                        buttonClass = 'bg-green-500 text-white';
                                    } else if (isSelectedOption) {
                                        buttonClass = 'bg-red-500 text-white';
                                    }
                                }

                                return (
                                    <button
                                        key={option}
                                        onClick={() => checkAnswer(option)}
                                        disabled={isAnswered}
                                        className={`p-4 rounded-lg text-lg font-semibold w-full transition-colors ${buttonClass}`}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {stage === 'choose_picture' && (
                     <div className="w-full max-w-md text-center">
                        <p className="mb-4 font-semibold">Choose the correct picture</p>
                        <p className="text-4xl font-bold mb-6">{currentWord.english}</p>
                        <div className="grid grid-cols-2 gap-4">
                            {pictureOptions.map(optionUrl => {
                                const isCorrectOption = optionUrl === currentWord.image_url;
                                const isSelectedOption = optionUrl === selectedAnswer;

                                let ringClass = '';
                                if (isAnswered) {
                                    if (isCorrectOption) {
                                        ringClass = 'ring-4 ring-green-500';
                                    } else if (isSelectedOption) {
                                        ringClass = 'ring-4 ring-red-500';
                                    }
                                }
                                return (
                                    <button
                                        key={optionUrl}
                                        onClick={() => checkAnswer(optionUrl)}
                                        disabled={isAnswered}
                                        className={`p-2 bg-white rounded-lg transition-all ${ringClass}`}
                                    >
                                        <img src={optionUrl} alt="option" className="w-full h-40 object-contain rounded"/>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {stage === 'results' && (
                    <div className="text-center">
                        <h2 className="text-3xl font-bold mb-4">Round Complete!</h2>
                        <p className="text-5xl font-bold mb-4 text-green-500">
                             {((userAnswers.filter(a => a.isCorrect).length / userAnswers.length) * 100 || 0).toFixed(0)}%
                        </p>
                        <p className="text-xl text-gray-500">You got {userAnswers.filter(a => a.isCorrect).length} out of {userAnswers.length} correct.</p>
                         <div className="mt-8 animate-pulse text-gray-500 dark:text-gray-400">
                            Saving progress and returning to menu...
                         </div>
                    </div>
                )}
            </main>

            <footer className="p-0 sm:p-4 w-full sticky bottom-0">
                {isAnswered && stage === 'spell' ? (
                    <div className={`
                        p-4 text-center
                        ${feedback === 'correct' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}
                        sm:rounded-2xl
                    `}>
                        <div className="flex items-center justify-center mb-2">
                            {feedback === 'correct' ? (
                                <>
                                    <CheckCircleIcon className="w-8 h-8 mr-2" />
                                    <h3 className="font-bold text-xl">You are correct!</h3>
                                </>
                            ) : (
                                <>
                                    <XIcon className="w-8 h-8 mr-2" />
                                    <h3 className="font-bold text-xl">Incorrect answer</h3>
                                </>
                            )}
                        </div>
                        {feedback === 'incorrect' && currentWord && <CorrectAnswerDisplay stage={stage} word={currentWord} />}
                        <button 
                            onClick={nextWord} 
                            className={`w-full max-w-md mx-auto mt-4 py-3 font-bold rounded-xl text-lg text-white
                            ${feedback === 'correct' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                        >
                            Continue
                        </button>
                    </div>
                ) : (
                    !isAnswered && (
                        <div className="p-4">
                            {stage === 'learn' && (
                                <div className="flex justify-between">
                                    <button onClick={() => setCurrentWordIndex(i => Math.max(0, i-1))} disabled={currentWordIndex === 0} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50">Previous</button>
                                    <button onClick={nextWord} className="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold flex items-center">
                                        {currentWordIndex === shuffledWords.length - 1 ? "Start Test" : "Next"} <ArrowRightIcon className="w-5 h-5 ml-2"/>
                                    </button>
                                </div>
                            )}
                            {(stage === 'spell') && (
                                <button onClick={() => checkAnswer(inputValue)} className="w-full py-3 bg-yellow-400 text-gray-800 font-bold rounded-lg">Check</button>
                            )}
                        </div>
                    )
                )}
            </footer>
        </div>
    );
};

export default RoundView;