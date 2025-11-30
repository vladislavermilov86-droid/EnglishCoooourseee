import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { UnitTest, UserRole, TestQuestion, Word, StudentTestResult, User } from '../../types';
import { XIcon } from '../icons/Icons';
import TestReportView from './TestReportView';
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

    const [isStarting, setIsStarting] = useState(false);

    const joinedStudents: User[] = useMemo(() => {
        const studentIds = test?.joined_students || [];
        return users.filter(user => studentIds.includes(user.id));
    }, [test?.joined_students, users]);
    
    const results: StudentTestResult[] = useMemo(() => {
        return test?.results || [];
    }, [test?.results]);


    const students = users.filter(user => user.role.toLowerCase() === UserRole.Student);
    const unit = units.find(u => u.id === test?.unit_id);

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
                let options: string[] | undefined = undefined;
                switch (type) {
                    case 'choose_translation': {
                        const translationOptions = [word.russian];
                        const otherWords = allWords.filter(w => w.id !== word.id).map(w => w.russian);
                        const shuffledOther = shuffleArray(otherWords);
                        for(let i=0; i < shuffledOther.length && translationOptions.length < 4; i++) {
                            if(!translationOptions.includes(shuffledOther[i])) {
                                translationOptions.push(shuffledOther[i]);
                            }
                        }
                        options = shuffleArray(translationOptions);
                        break;
                    }
                    case 'choose_picture': {
                        const pictureOptions = [word.image_url];
                        const otherImages = allWords.filter(w => w.id !== word.id).map(w => w.image_url);
                        const shuffledOther = shuffleArray(otherImages);
                         for(let i=0; i < shuffledOther.length && pictureOptions.length < 4; i++) {
                            if(!pictureOptions.includes(shuffledOther[i])) {
                                pictureOptions.push(shuffledOther[i]);
                            }
                        }
                        options = shuffleArray(pictureOptions);
                        break;
                    }
                }
                 generatedQuestions.push({ word, type, options });
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
    
    if (!test || !unit) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="ml-4 text-gray-500">Loading Test or Unit not found...</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{test.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Managing live test session</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <XIcon className="w-6 h-6"/>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <h2 className="font-bold text-lg mb-2">Controls</h2>
                        <div>
                            <button 
                                onClick={handleStartTest} 
                                className="w-full py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
                                disabled={joinedStudents.length === 0 || isStarting || test.status !== 'waiting'}
                            >
                                {isStarting ? 'Starting...' : 'Start Test'}
                            </button>
                            {test.status === 'waiting' && joinedStudents.length === 0 && (
                                <p className="text-xs text-center text-gray-500 mt-2">Waiting for at least one student to join.</p>
                            )}
                        </div>
                    </div>
                     <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                        <h2 className="font-bold text-lg mb-1">Status</h2>
                        <p className="font-semibold text-xl uppercase">{test.status}</p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                     <h2 className="font-bold text-lg mb-2">Student Progress ({joinedStudents.length} / {students.length})</h2>
                     <div className="space-y-2">
                         {students.map(student => {
                            const hasJoined = joinedStudents.some(s => s.id === student.id);
                            
                            return (
                                <div key={student.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="flex items-center space-x-3">
                                        <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                                        <span>{student.name}</span>
                                    </div>
                                    <div>
                                        {hasJoined ? (
                                             <span className="text-xs font-bold text-green-600 px-2 py-1 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-full">JOINED</span>
                                        ) : (
                                            <span className="text-xs font-bold text-gray-400 px-2 py-1 bg-gray-200 dark:bg-gray-600 dark:text-gray-300 rounded-full">NOT JOINED</span>
                                        )}
                                    </div>
                                </div>
                            )
                         })}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default TestRoom;