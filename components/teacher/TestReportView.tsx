import React, { useState, useMemo } from 'react';
import { UnitTest, StudentTestResult, UserRole, User } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon, ChevronLeftIcon } from '../icons/Icons';
import DetailedStudentTestView from './DetailedStudentTestView';

interface TestReportViewProps {
    testId: string;
    onBack: () => void;
}

const TestReportView: React.FC<TestReportViewProps> = ({ testId, onBack }) => {
    const { state } = useApp();
    const { users, unitTests } = state;
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const test = unitTests.find(t => t.id === testId);
    
    const results: StudentTestResult[] = useMemo(() => {
        return test?.results || [];
    }, [test?.results]);

    const students = users.filter(user => user.role.toLowerCase() === UserRole.Student);
    
    const selectedStudent = selectedStudentId ? users.find(u => u.id === selectedStudentId) : null;
    const selectedStudentResult = selectedStudentId ? results.find(r => r.studentId === selectedStudentId) : null;

    if (!test) {
        return (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-center">
                <p>Loading report...</p>
            </div>
        );
    }

    if (selectedStudent && selectedStudentResult) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl relative max-h-[90vh] flex flex-col">
                <DetailedStudentTestView
                    student={selectedStudent}
                    result={selectedStudentResult}
                    test={test}
                    onBack={() => setSelectedStudentId(null)}
                    onClose={onBack}
                />
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <header className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold">{test.title} - Report</h1>
                    <p className="text-gray-500 dark:text-gray-400">Completed on {new Date(results?.[0]?.completedAt || Date.now()).toLocaleDateString()}</p>
                </div>
            </header>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b dark:border-gray-600">
                        <tr className="text-sm text-gray-500 dark:text-gray-400">
                            <th className="p-2 font-semibold">Student</th>
                            <th className="p-2 text-center font-semibold">Score</th>
                            <th className="p-2 text-center font-semibold">Status</th>
                            <th className="p-2 text-center font-semibold">Final Grade</th>
                            <th className="p-2 font-semibold">Comment</th>
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
                                    <td className="p-2 text-sm italic text-gray-600 dark:text-gray-400">
                                        {result?.teacherComment || <span className="text-gray-400 dark:text-gray-500">-</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TestReportView;