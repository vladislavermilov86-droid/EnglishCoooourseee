import React, { useState, useMemo } from 'react';
import { UnitTest, UserRole, User, StudentTestResult } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon, ChevronLeftIcon } from '../icons/Icons';
import DetailedStudentTestView from './DetailedStudentTestView';

interface TestResultsModalProps {
    test: UnitTest;
    onClose: () => void;
}

const TestResultsModal: React.FC<TestResultsModalProps> = ({ test: initialTest, onClose }) => {
    const { state } = useApp();
    const { users } = state;
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const test = state.unitTests.find(t => t.id === initialTest.id) || initialTest;
    
    const results: StudentTestResult[] = useMemo(() => {
        return test.results || [];
    }, [test.results]);

    const students = users.filter(user => user.role.toLowerCase() === UserRole.Student);
    
    const selectedStudent = selectedStudentId ? users.find(u => u.id === selectedStudentId) : null;
    const selectedStudentResult = selectedStudentId ? results.find(r => r.studentId === selectedStudentId) : null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {selectedStudent && selectedStudentResult ? (
                    <DetailedStudentTestView 
                        student={selectedStudent} 
                        result={selectedStudentResult}
                        test={test}
                        onBack={() => setSelectedStudentId(null)}
                        onClose={onClose}
                    />
                ) : (
                    <>
                        <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{test.title} - Results</h2>
                            <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-400" /></button>
                        </header>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="border-b dark:border-gray-600">
                                    <tr className="text-sm text-gray-500 dark:text-gray-400">
                                        <th className="p-2 font-semibold">Student</th>
                                        <th className="p-2 text-center font-semibold">Score</th>
                                        <th className="p-2 text-center font-semibold">Status</th>
                                        <th className="p-2 text-center font-semibold">Final Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => {
                                        const result = results.find(r => r.studentId === student.id);
                                        const score = result?.score;
                                        const scoreColor = score == null ? '' : score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                                        return (
                                            <tr key={student.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => result && setSelectedStudentId(student.id)}>
                                                <td className="p-2 flex items-center space-x-3">
                                                    <img src={student.avatar_url} alt={student.name} className="w-8 h-8 rounded-full" />
                                                    <span className="font-semibold">{student.name}</span>
                                                </td>
                                                <td className={`p-2 text-center font-bold text-lg ${scoreColor}`}>
                                                    {result ? `${score?.toFixed(0)}%` : <span className="text-gray-400 text-sm">N/A</span>}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {result?.passed === true && <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 dark:bg-green-900/50 dark:text-green-300 rounded-full">Passed</span>}
                                                    {result?.passed === false && <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 dark:bg-red-900/50 dark:text-red-300 rounded-full">Failed</span>}
                                                    {result?.passed === undefined && <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>}
                                                </td>
                                                 <td className="p-2 text-center font-bold text-lg">
                                                    {result?.teacherGrade || <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TestResultsModal;