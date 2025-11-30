import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { ArrowRightIcon, BellIcon, AcademicCapIcon, TrophyIcon, BookOpenIcon } from '../icons/Icons';
import { Unit, RoundProgress, StudentTestResult } from '../../types';

interface StudentDashboardProps {
    onHomeworkClick: (unitId: string) => void;
    onJoinTest: (testId: string) => void;
    isJoiningTest: boolean;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ onHomeworkClick, onJoinTest, isJoiningTest }) => {
    const { state } = useApp();
    const { loggedInUser, units, studentProgress, unitTests, unlockedUnits } = state;

    const getAssignedUnit = (): Unit | null | undefined => {
        if (!unlockedUnits || unlockedUnits.length === 0) return null;
        const latestUnlockedUnitId = unlockedUnits[unlockedUnits.length - 1];
        return units.find(unit => unit.id === latestUnlockedUnitId);
    };

    const homeworkUnit = getAssignedUnit();

    const getHomeworkProgress = () => {
        if (!homeworkUnit || !loggedInUser) return 0;
        const unitProgress = studentProgress[loggedInUser.id]?.unitsProgress[homeworkUnit.id];
        
        const totalRounds = homeworkUnit.rounds?.length || 0;
        if (totalRounds === 0) return 0;

        if (!unitProgress) return 0;

        const totalScore = (homeworkUnit.rounds || []).reduce((acc, round) => {
            const roundProgress = unitProgress.roundsProgress[round.id];
            if (roundProgress && roundProgress.history && roundProgress.history.length > 0) {
                const lastAttempt = roundProgress.history[roundProgress.history.length - 1];
                return acc + (lastAttempt?.score || 0);
            }
            return acc;
        }, 0);
        
        const averageScore = totalScore / totalRounds;

        return averageScore;
    };
    
    const homeworkProgress = getHomeworkProgress();

    const activeTest = unitTests.find(test => 
        test.status === 'waiting' || test.status === 'in_progress'
    );

    const hasUserSubmitted = React.useMemo(() => {
        if (!activeTest || !loggedInUser) return false;
        // Defensively check if results is an array
        const testResults = activeTest.results || [];
        return Array.isArray(testResults) && testResults.some(r => r.studentId === loggedInUser.id);
    }, [activeTest, loggedInUser]);
    
    const studentData = loggedInUser ? studentProgress[loggedInUser.id] : null;

    const completedTestsCount = unitTests.filter(test => {
        if (test.status === 'completed' && Array.isArray(test.results)) {
            return test.results.some(r => r.studentId === loggedInUser?.id);
        }
        return false;
    }).length;
    
    const completedUnits = units.filter(unit => {
        if (!studentData) return false;
        const unitProgress = studentData.unitsProgress[unit.id];
        if (!unitProgress || !unit.rounds || unit.rounds.length === 0) return false;
        
        const allRoundsCompleted = unit.rounds.every(round => unitProgress.roundsProgress[round.id]?.completed);
        return allRoundsCompleted;
    });

    const hundredPercentUnitsCount = completedUnits.filter(unit => {
        if (!studentData) return false;
        const unitProgress = studentData.unitsProgress[unit.id];
        const totalScore = (unit.rounds || []).reduce((acc, round) => {
            const roundProgress = unitProgress.roundsProgress[round.id];
            const lastAttempt = roundProgress?.history?.[roundProgress.history.length - 1];
            return acc + (lastAttempt?.score || 0);
        }, 0);
        const averageScore = (unit.rounds?.length || 0) > 0 ? totalScore / unit.rounds.length : 0;
        return averageScore === 100;
    }).length;


    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Welcome back, {loggedInUser?.name?.split(' ')[0] || 'friend'}!</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {activeTest && (
                         <div className="bg-green-500 text-white rounded-2xl p-6 flex flex-col items-center text-center shadow-lg">
                            <BellIcon className="w-12 h-12 mb-2" />
                            <h2 className="text-2xl font-bold mb-2">A test is active!</h2>
                            <p className="mb-4">Your teacher has started a test for "{units.find(u => u.id === activeTest.unit_id)?.title}".</p>
                            <button 
                                onClick={() => onJoinTest(activeTest.id)} 
                                className="bg-white text-green-600 font-bold py-2 px-6 rounded-full hover:bg-green-100 transition disabled:opacity-75 disabled:cursor-not-allowed"
                                disabled={isJoiningTest || hasUserSubmitted}
                            >
                                {isJoiningTest ? 'Joining...' : (hasUserSubmitted ? 'Submitted' : 'Join Test')}
                            </button>
                        </div>
                    )}
                    {homeworkUnit && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
                            <h2 className="text-xl font-bold mb-4">Your Homework</h2>
                            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                                <div className="text-5xl">{homeworkUnit.icon}</div>
                                <div className="flex-1 text-center sm:text-left w-full">
                                    <h3 className="text-lg font-bold">{homeworkUnit.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{homeworkUnit.description}</p>
                                    <div className="mt-3">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-700 dark:text-white">Progress</span>
                                            <span className="text-sm font-medium text-gray-700 dark:text-white">{homeworkProgress.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                            <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${homeworkProgress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => onHomeworkClick(homeworkUnit.id)} className="bg-yellow-400 text-gray-800 font-bold py-2 px-4 rounded-xl flex items-center space-x-2 hover:bg-yellow-500 transition">
                                    <span>Start</span>
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                     <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
                        <h2 className="text-xl font-bold mb-4">Your Progress</h2>
                         {completedUnits.length > 0 ? (
                            <div className="space-y-2">
                                <p className="text-gray-500 dark:text-gray-400 mb-2">Great job on finishing these units!</p>
                                {completedUnits.map(unit => {
                                    const unitProgress = studentData?.unitsProgress[unit.id];
                                    const totalScore = (unit.rounds || []).reduce((acc, round) => {
                                        const roundProgress = unitProgress?.roundsProgress[round.id];
                                        const lastAttempt = roundProgress?.history?.[roundProgress.history.length - 1];
                                        return acc + (lastAttempt?.score || 0);
                                    }, 0);
                                    const averageScore = (unit.rounds?.length || 0) > 0 ? totalScore / unit.rounds.length : 0;
                                    return (
                                        <div key={unit.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <div className="text-2xl">{unit.icon}</div>
                                                <p className="font-semibold">{unit.title}</p>
                                            </div>
                                            <div className={`font-bold px-3 py-1 text-sm rounded-full ${averageScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {averageScore.toFixed(0)}%
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                         ) : (
                            <p className="text-gray-500 dark:text-gray-400">Keep up the good work! Complete your first unit to see your progress here.</p>
                         )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center">
                         <AcademicCapIcon className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                         <p className="text-3xl font-bold">{completedTestsCount}</p>
                         <p className="text-gray-500">Completed Tests</p>
                    </div>
                     <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center">
                         <TrophyIcon className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                         <p className="text-3xl font-bold">{hundredPercentUnitsCount}</p>
                         <p className="text-gray-500">100% Completed Units</p>
                    </div>
                     <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 text-center">
                         <BookOpenIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                         <p className="text-3xl font-bold">{completedUnits.length}</p>
                         <p className="text-gray-500">Finished Units</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;