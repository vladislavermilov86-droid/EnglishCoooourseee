import React, { useState, useEffect, useMemo } from 'react';
import { UnitTest, StudentTestResult, User, TestQuestion } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon, ChevronLeftIcon } from '../icons/Icons';
import { supabase } from '../../supabase';

interface DetailedStudentTestViewProps {
    student: User;
    result: StudentTestResult;
    test: UnitTest;
    onBack: () => void;
    onClose: () => void;
}

const DetailedStudentTestView: React.FC<DetailedStudentTestViewProps> = ({ student, result, test, onBack, onClose }) => {
    const { state, dispatch } = useApp();
    const [grade, setGrade] = useState<number | ''>(result.teacherGrade || '');
    const [comment, setComment] = useState(result.teacherComment || '');
    const [passFail, setPassFail] = useState<boolean | undefined>(result.passed);
    
    // Pull the freshest version of the test from global state to avoid using stale props.
    const freshTest = useMemo(() => state.unitTests.find(t => t.id === test.id) || test, [state.unitTests, test.id]);

    const questions: TestQuestion[] = useMemo(() => {
        return freshTest.questions || [];
    }, [freshTest.questions]);
    
    useEffect(() => {
        setGrade(result.teacherGrade || '');
        setComment(result.teacherComment || '');
        setPassFail(result.passed);
    }, [result]);

    const handleSave = async () => {
        if (typeof grade === 'number' && grade >= 1 && grade <= 5 && passFail !== undefined) {
            
            const currentResults = freshTest.results || [];

            const newResults = currentResults.map((r: StudentTestResult) => 
                r.studentId === student.id 
                ? { ...r, teacherGrade: Number(grade), teacherComment: comment, passed: passFail }
                : r
            );
            
            const optimisticPayload = { ...freshTest, results: newResults } as UnitTest;
            // Dispatch update to local state for immediate UI feedback.
            dispatch({ type: 'UPSERT_UNIT_TEST', payload: optimisticPayload });

            try {
                const { error } = await supabase.from('unit_tests').update({
                    results: newResults
                }).eq('id', test.id);
                
                if (error) throw error;
                
                alert('Grade saved!');
            } catch(error: any) {
                 console.error("Error saving grade:", error);
                 alert(`Failed to save grade: ${error.message}`);
                 // Revert optimistic update on failure
                 dispatch({ type: 'UPSERT_UNIT_TEST', payload: freshTest });
            }
        } else {
            alert('Please enter a valid grade (1-5) and select pass/fail status.');
        }
    };
    
    const studentAnswers = Array.isArray(result.answers) ? result.answers : [];

    return (
        <>
            <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <button onClick={onBack} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                    <div>
                        <h2 className="text-xl font-bold">{student.name}'s Results</h2>
                        <p className={`font-bold ${result.score >= 70 ? 'text-green-500' : 'text-red-500'}`}>
                            Score: {result.score.toFixed(0)}%
                        </p>
                    </div>
                </div>
                <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-400" /></button>
            </header>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {questions.length > 0 ? questions.map((q, index) => {
                    const studentAnswerData = studentAnswers.find(a => a.questionIndex === index);
                    const hasAnswer = !!studentAnswerData && studentAnswerData.answer !== '';
                    const isCorrect = hasAnswer && studentAnswerData.isCorrect;
                    const studentAnswerText = studentAnswerData?.answer;
                    
                    const correctAnswerText = q.type === 'spell' ? q.word.english : q.type === 'choose_translation' ? q.word.russian : q.word.image_url;
                    
                    return (
                        <div key={index} className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <p className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Question {index + 1}: <span className="font-normal text-gray-600 dark:text-gray-400">{q.type.replace('_', ' ')} for "{q.word.english}"</span></p>
                            
                            {!hasAnswer ? (
                                <div>
                                    <p className="font-bold text-gray-500 dark:text-gray-400 italic">No answer</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">Correct Answer: <span className="font-semibold">{correctAnswerText}</span></p>
                                </div>
                            ) : !isCorrect ? (
                                <div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">Student's Answer: <span className="font-bold text-red-600 dark:text-red-400">{studentAnswerText}</span></p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">Correct Answer: <span className="font-semibold">{correctAnswerText}</span></p>
                                </div>
                            ) : (
                                 <p className="text-sm text-gray-700 dark:text-gray-300">Answer: <span className="font-bold text-green-700 dark:text-green-300">{correctAnswerText}</span></p>
                            )}

                            {q.type === 'choose_picture' && (
                                <div className="flex space-x-4 mt-2">
                                    <div>
                                        <p className="text-xs text-gray-500">Correct:</p>
                                        <div className="w-24 h-16 rounded bg-white flex items-center justify-center border-2 border-green-500">
                                            <img src={correctAnswerText} alt="Correct answer" className="max-w-full max-h-full object-contain rounded"/>
                                        </div>
                                    </div>
                                    {hasAnswer && !isCorrect && studentAnswerText &&
                                        <div>
                                            <p className="text-xs text-gray-500">Student's choice:</p>
                                            <div className="w-24 h-16 rounded bg-white flex items-center justify-center border-2 border-red-500">
                                                <img src={studentAnswerText} alt="Student's answer" className="max-w-full max-h-full object-contain rounded"/>
                                            </div>
                                        </div>
                                    }
                                </div>
                            )}
                        </div>
                    );
                }) : (
                     <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        <p className="font-semibold">No question details available.</p>
                        <p className="text-sm">The questions for this test could not be loaded.</p>
                    </div>
                )}
            </div>
             <footer className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <h3 className="font-bold mb-2">Grade and Feedback</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    <input
                        type="number"
                        placeholder="Grade (1-5)"
                        value={grade}
                        onChange={e => setGrade(e.target.value === '' ? '' : Number(e.target.value))}
                        className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        min="1"
                        max="5"
                    />
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" name={`passFail-${student.id}`} checked={passFail === true} onChange={() => setPassFail(true)} className="form-radio text-green-500"/>
                            <span>Passed</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" name={`passFail-${student.id}`} checked={passFail === false} onChange={() => setPassFail(false)} className="form-radio text-red-500"/>
                            <span>Failed</span>
                        </label>
                    </div>
                     <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600">
                        Save Grade
                    </button>
                </div>
                 <input
                        type="text"
                        placeholder="Optional comment..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="w-full mt-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
            </footer>
        </>
    );
};

export default DetailedStudentTestView;