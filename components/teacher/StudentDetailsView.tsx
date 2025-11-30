import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { User, Unit, UnitProgress, StudentTestResult } from '../../types';
import { ChevronLeftIcon, AcademicCapIcon, BookOpenIcon, TrophyIcon, ChartBarIcon, TrashIcon } from '../icons/Icons';
import StudentProgressDetailsModal from './StudentProgressDetailsModal';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';

interface StudentDetailsViewProps {
    student: User;
    onBack: () => void;
}

const StatCard: React.FC<{ icon: React.FC<{className?: string}>, label: string, value: string | number, color: string }> = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
        </div>
    </div>
);

const StudentDetailsView: React.FC<StudentDetailsViewProps> = ({ student, onBack }) => {
    const { state, dispatch } = useApp();
    const { units, studentProgress, unlockedUnits, unitTests } = state;
    const [modalData, setModalData] = useState<{ student: User; unit: Unit; progress: UnitProgress | null } | null>(null);

    // FIX: Use 'id' instead of '$id'
    const studentData = studentProgress[student.id];

    // --- Calculations ---

    const overallProgress = (() => {
        if (!studentData || unlockedUnits.length === 0) return 0;

        const totalProgressSum = unlockedUnits.reduce((acc: number, unitId: string) => {
            // FIX: Use 'id' instead of '$id'
            const unit = units.find(u => u.id === unitId);
            const unitProgress = studentData.unitsProgress[unitId];
            if (!unit || !unitProgress) {
                return acc;
            }
            
            const totalRounds = unit.rounds?.length || 0;
            if (totalRounds === 0) {
                return acc;
            }
            
            const completedRoundsCount = Object.values(unitProgress.roundsProgress).filter((r: any) => r.completed).length;
            const unitCompletion = (completedRoundsCount / totalRounds) * 100;

            return acc + unitCompletion;
        }, 0);

        return unlockedUnits.length > 0 ? totalProgressSum / unlockedUnits.length : 0;
    })();

    const completedUnitsCount = unlockedUnits.filter(unitId => {
        // FIX: Use 'id' instead of '$id'
        const unit = units.find(u => u.id === unitId);
        const unitProgress = studentData?.unitsProgress[unitId];
        if (!unit || !unitProgress || !unit.rounds) return false;
        // FIX: Use 'id' instead of '$id'
        return unit.rounds.length > 0 && unit.rounds.every(round => unitProgress.roundsProgress[round.id]?.completed);
    }).length;

    const studentTestResults = unitTests
        .map(test => {
            const results: StudentTestResult[] = test.results || [];
            return results.find(r => r.studentId === student.id);
        })
        .filter((r): r is StudentTestResult => !!r);
    
    const completedTestsCount = studentTestResults.length;

    const averageTestScore = (() => {
        if (completedTestsCount === 0) return 0;
        const totalScore = studentTestResults.reduce((acc, result) => acc + (result?.score || 0), 0);
        return totalScore / completedTestsCount;
    })();
    
    const calculateUnitScore = (progress: UnitProgress | null, unit: Unit | undefined): number | null => {
        if (!progress || !unit || !unit.rounds || unit.rounds.length === 0) return null;
        const completedRounds = Object.values(progress.roundsProgress).filter((rp: any) => rp.completed);
        if (completedRounds.length !== unit.rounds.length) return null;
        const totalScore = completedRounds.reduce((acc, round: any) => {
            const lastAttempt = round.history?.[round.history.length - 1];
            return acc + (lastAttempt?.score || 0);
        }, 0);
        return totalScore / unit.rounds.length;
    };

    const handleResetProgress = async (unitId: string) => {
        // FIX: Use 'id' instead of '$id'
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        if (window.confirm(`Are you sure you want to reset all progress for ${student.name} on "${unit.title}"? This action cannot be undone.`)) {
            try {
                // FIX: Use Supabase client to delete progress
                const { error } = await supabase.from('round_progress').delete()
                    .match({ student_id: student.id, unit_id: unitId });
                
                if (error) throw error;
                
                dispatch({ type: 'RESET_STUDENT_UNIT_PROGRESS', payload: { studentId: student.id, unitId } });
            } catch (error) {
                 console.error("Error resetting progress:", error);
                alert("Failed to reset progress.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center space-x-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <img src={student.avatar_url} alt={student.name} className="w-12 h-12 rounded-full" />
                <div>
                    <h1 className="text-3xl font-bold">{student.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Student Profile</p>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={ChartBarIcon} label="Overall Progress" value={`${overallProgress.toFixed(0)}%`} color="bg-blue-500" />
                <StatCard icon={BookOpenIcon} label="Completed Units" value={completedUnitsCount} color="bg-green-500" />
                <StatCard icon={AcademicCapIcon} label="Completed Tests" value={completedTestsCount} color="bg-purple-500" />
                <StatCard icon={TrophyIcon} label="Average Test Score" value={`${averageTestScore.toFixed(0)}%`} color="bg-yellow-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-bold mb-4">Unit Progress</h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {unlockedUnits.map(unitId => {
                            // FIX: Use 'id' instead of '$id'
                            const unit = units.find(u => u.id === unitId);
                            if (!unit) return null;
                            const progress = studentData?.unitsProgress[unitId] || null;
                            const score = calculateUnitScore(progress, unit);
                            
                            return (
                                <div key={unitId} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">{unit.icon}</span>
                                        <div>
                                            <p className="font-semibold">{unit.title}</p>
                                            <p className="text-sm text-gray-500">{unit.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center space-x-2">
                                        <div>
                                            <p className={`font-bold text-lg ${score === null ? 'text-gray-400' : score >= 80 ? 'text-green-500' : 'text-red-500'}`}>
                                                {score?.toFixed(0) ?? 'Incomplete'}
                                            </p>
                                            <button onClick={() => setModalData({ student, unit, progress })} className="text-xs text-blue-500 hover:underline">
                                                View Details
                                            </button>
                                        </div>
                                        {progress && (
                                            // FIX: Use 'id' instead of '$id'
                                            <button onClick={() => handleResetProgress(unit.id)} title="Reset Progress" className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                         {unlockedUnits.length === 0 && <p className="text-gray-500 text-center pt-8">No units have been unlocked for this student yet.</p>}
                    </div>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-bold mb-4">Test Results</h2>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {studentTestResults.length > 0 ? studentTestResults.map(result => {
                             if (!result) return null;
                             const test = unitTests.find(t => {
                                const results = t.results || [];
                                return results.some((r: StudentTestResult) => r.studentId === result.studentId && r.completedAt === result.completedAt)
                             });
                             if (!test) return null;

                             return (
                                // FIX: Use 'id' instead of '$id'
                                <div key={test.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{test.title}</p>
                                        <p className="text-sm text-gray-500">Completed: {new Date(result.completedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${result.score >= 70 ? 'text-green-500' : 'text-red-500'}`}>
                                            {result.score.toFixed(0)}%
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Final Grade: <span className="font-bold">{result.teacherGrade || 'N/A'}</span>
                                        </p>
                                    </div>
                                </div>
                             )
                        }) : <p className="text-gray-500 text-center pt-8">No completed tests yet.</p>}
                    </div>
                </div>
            </div>

            {modalData && (
                <StudentProgressDetailsModal
                    student={modalData.student}
                    unit={modalData.unit}
                    progress={modalData.progress}
                    onClose={() => setModalData(null)}
                />
            )}
        </div>
    );
};

export default StudentDetailsView;