import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { AcademicCapIcon } from '../icons/Icons';
import { StudentTestResult } from '../../types';

const MarksView: React.FC = () => {
    const { state } = useApp();
    const { loggedInUser } = state;

    if (!loggedInUser) {
        return <div className="p-8 text-center">Loading your marks...</div>;
    }
    
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Marks</h1>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 sm:p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center space-x-3">
                    <AcademicCapIcon className="w-6 h-6" />
                    <span>My Test Results</span>
                </h2>
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-left">
                        <thead className="border-b dark:border-gray-600">
                            <tr className="text-sm text-gray-500 dark:text-gray-400">
                                <th className="p-2 font-semibold">Test</th>
                                <th className="p-2 text-center font-semibold">My Score</th>
                                <th className="p-2 text-center font-semibold">Final Grade</th>
                                <th className="p-2 font-semibold">Teacher's Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.unitTests
                                .filter(test => {
                                    if (test.status === 'completed' && test.results) {
                                        const results: StudentTestResult[] = test.results || [];
                                        return results.some(r => r.studentId === loggedInUser?.id);
                                    }
                                    return false;
                                })
                                .map(test => {
                                    if (!test.results) return null;
                                    const myResult: StudentTestResult | undefined = (test.results || []).find(r => r.studentId === loggedInUser?.id);
                                    
                                    if (!myResult) return null;
                                    
                                    const score = myResult.score;
                                    const scoreColor = score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                                    return (
                                        // FIX: Use 'id' instead of '$id'
                                        <tr key={test.id} className="border-b dark:border-gray-700">
                                            <td className="p-3 font-semibold">{test.title}</td>
                                            <td className={`p-3 text-center font-bold text-lg ${scoreColor}`}>{score.toFixed(0)}%</td>
                                            <td className="p-3 text-center font-bold text-lg text-blue-600 dark:text-blue-400">{myResult.teacherGrade || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400 italic">{myResult.teacherComment || '-'}</td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
                 {/* Mobile Cards */}
                <div className="block md:hidden space-y-4">
                    {state.unitTests
                        .filter(test => {
                             if (test.status === 'completed' && test.results) {
                                const results: StudentTestResult[] = test.results || [];
                                return results.some(r => r.studentId === loggedInUser?.id);
                            }
                            return false;
                        })
                        .map(test => {
                            if (!test.results) return null;
                             const myResult: StudentTestResult | undefined = (test.results || []).find(r => r.studentId === loggedInUser?.id);
                            
                            if (!myResult) return null;

                            const score = myResult.score;
                            const scoreColor = score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                            return (
                                // FIX: Use 'id' instead of '$id'
                                <div key={test.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="font-semibold mb-2 text-gray-800 dark:text-gray-100">{test.title}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">My Score</p>
                                            <p className={`font-bold text-xl ${scoreColor}`}>{score.toFixed(0)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Final Grade</p>
                                            <p className="font-bold text-xl text-blue-600 dark:text-blue-400">{myResult.teacherGrade || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Comment</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 italic">{myResult.teacherComment || '-'}</p>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </div>
        </div>
    );
};

export default MarksView;