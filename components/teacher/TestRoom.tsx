import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { UnitTest, UserRole, TestQuestion, Word, StudentTestResult } from '../../types';
import { XIcon } from '../icons/Icons';
import TestResultsModal from './TestResultsModal';
import { supabase } from '../../supabase';

interface TestRoomProps {
    testId: string;
    onClose: () => void;
}

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const TestRoom: React.FC<TestRoomProps> = ({ testId, onClose }) => {
    const { state } = useApp();
    const { users, units, unitTests } = state;

    const test = unitTests.find(t => t.id === testId);

    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
    const [isEndingTest, setIsEndingTest] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    const joinedStudents: string[] = useMemo(() => {
        return Array.isArray(test?.joined_students) ? test.joined_students : [];
    }, [test?.joined_students]);
    
    const results: StudentTestResult[] = useMemo(() => {
        return test?.results || [];
    }, [test?.results]);


    const students = users.filter(user => user.role.toLowerCase() === UserRole.Student);
    const unit = units.find(u => u.id === test?.unit_id);

    useEffect(() => {
        if (!test || test.status !== 'in_progress' || !test.start_time) {
            setTimeLeft(600);
            return;
        }

        const intervalId = setInterval(async () => {
            const elapsedTime = Math.floor((Date.now() - (new Date(test.start_time!).getTime())) / 1000);
            const remaining = 600 - elapsedTime;
            
            if (remaining <= 0) {
                setTimeLeft(0);
                clearInterval(intervalId);
                if (test.status === 'in_progress') {
                    await supabase.from('unit_tests').update({ status: 'completed' }).eq('id', test.id);
                }
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [test]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartTest = async () => {
        if (!test || isStarting) return;
        if (joinedStudents.length === 0) {
            alert("Cannot start test. At least one student must join.");
            return;
        }
        if (!unit) {
            alert("A critical error occurred: The unit for this test could not be found.");
            return;
        }

        setIsStarting(true);
        
        const allWords = (unit.rounds || []).flatMap(r => r.words);
        if (allWords.length === 0) {
            alert("Cannot start test: Unit has no words.");
            setIsStarting(false);
            return;
        }

        const generatedQuestions: TestQuestion[] = [];
        const shuffledWords = shuffleArray(allWords);

        shuffledWords.forEach((word: Word) => {
            const questionTypes: ('spell' | 'choose_translation' | 'choose_picture')[] = shuffleArray(['spell', 'choose_translation', 'choose_picture']);

            for (const type of questionTypes) {
                switch (type) {
                    case 'spell':
                        generatedQuestions.push({ word, type: 'spell' });
                        break;
                    case 'choose_translation': {
                        const translationOptions = [word.russian];
                        while (translationOptions.length < 4) {
                            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
                            if (randomWord.id !== word.id && !translationOptions.includes(randomWord.russian)) {
                                translationOptions.push(randomWord.russian);
                            }
                        }
                        generatedQuestions.push({ word, type: 'choose_translation', options: shuffleArray(translationOptions) });
                        break;
                    }
                    case 'choose_picture': {
                        const pictureOptions = [word.image_url];
                        while (pictureOptions.length < 4) {
                            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
                            if (randomWord.id !== word.id && !pictureOptions.includes(randomWord.image_url)) {
                                pictureOptions.push(randomWord.image_url);
                            }
                        }
                        generatedQuestions.push({ word, type: 'choose_picture', options: shuffleArray(pictureOptions) });
                        break;
                    }
                }
            }
        });

        const testQuestions = shuffleArray(generatedQuestions);

        try {
            await supabase.from('unit_tests').update({
                questions: testQuestions,
                status: 'in_progress',
                start_time: new Date().toISOString()
            }).eq('id', test.id);
        } catch (error) {
            console.error("Failed to start test:", error);
            alert("Failed to start test. Please check console for errors.");
        }
        
        setIsStarting(false);
    };

    const handleEndTest = async () => {
        if (!isEndingTest && test && test.status === 'in_progress') {
            setIsEndingTest(true);
            try {
                await supabase.from('unit_tests').update({ status: 'completed' }).eq('id', test.id);
            } catch (error) {
                 console.error("Failed to end test:", error);
                 setIsEndingTest(false);
            }
        }
    };
    
    if (!test) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                <p className="ml-4">Loading Test...</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{test.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Managing live test session</p>
                </div>
                <button onClick={onClose}><XIcon className="w-6 h-6"/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h2 className="font-bold text-lg mb-2">Controls</h2>
                        {test.status === 'waiting' && (
                            <div>
                                <button 
                                    onClick={handleStartTest} 
                                    className="w-full py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
                                    disabled={joinedStudents.length === 0 || isStarting}
                                >
                                    {isStarting ? 'Starting...' : 'Start Test'}
                                </button>
                                {joinedStudents.length === 0 && (
                                    <p className="text-xs text-center text-gray-500 mt-2">Waiting for at least one student to join.</p>
                                )}
                            </div>
                        )}
                        {test.status === 'in_progress' && (
                             <button onClick={handleEndTest} disabled={isEndingTest} className="w-full py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-red-300 disabled:cursor-wait">
                                {isEndingTest ? 'Ending...' : 'End Test'}
                             </button>
                        )}
                         {test.status === 'completed' && (
                             <button onClick={() => setIsResultsModalOpen(true)} className="w-full py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">View Results</button>
                        )}
                    </div>
                     <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                        <h2 className="font-bold text-lg mb-1">Status</h2>
                        <p className="font-semibold text-xl">{test.status.replace('_', ' ').toUpperCase()}</p>
                         {test.status === 'in_progress' && (
                             <div className="mt-2">
                                <p className="text-sm">Time Remaining</p>
                                <p className="font-mono text-3xl font-bold">{formatTime(timeLeft)}</p>
                             </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                     <h2 className="font-bold text-lg mb-2">Student Progress ({joinedStudents.length} / {students.length})</h2>
                     <div className="space-y-2">
                         {students.map(student => {
                            const hasJoined = joinedStudents.includes(student.id);
                            const result = results.find(r => r.studentId === student.id);
                            
                            return (
                                <div key={student.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="flex items-center space-x-3">
                                        <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                                        <span>{student.name}</span>
                                    </div>
                                    <div>
                                        {!hasJoined && <span className="text-xs font-bold text-gray-400 px-2 py-1 bg-gray-200 dark:bg-gray-600 dark:text-gray-300 rounded-full">NOT JOINED</span>}
                                        {hasJoined && !result && test.status === 'in_progress' && <span className="text-xs font-bold text-yellow-600 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full">IN PROGRESS</span>}
                                        {hasJoined && !result && test.status === 'waiting' && <span className="text-xs font-bold text-green-600 px-2 py-1 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-full">JOINED</span>}
                                        {result && <span className="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">SUBMITTED: {result.score.toFixed(0)}%</span>}
                                    </div>
                                </div>
                            )
                         })}
                     </div>
                </div>
            </div>
            {isResultsModalOpen && <TestResultsModal test={test} onClose={() => setIsResultsModalOpen(false)} />}
        </div>
    );
};

export default TestRoom;