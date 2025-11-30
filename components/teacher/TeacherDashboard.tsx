import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { UserRole, Unit, UnitProgress, User, RoundProgress, ActivityItem, StudentTestResult } from '../../types';
import ActivityFeed from './ActivityFeed';

interface TeacherDashboardProps {
    onViewDetails: (student: User) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onViewDetails }) => {
    const { state } = useApp();
    const { users, units, studentProgress } = state;
    const students = state.users.filter(user => user.role.toLowerCase() === UserRole.Student);

    const calculateOverallProgress = (studentId: string): number => {
        const studentProgressData = studentProgress[studentId];
        if (!studentProgressData || units.length === 0) return 0;

        let unitsWithRoundsCount = 0;
        const totalProgressSum = units.reduce((acc: number, unit: Unit) => {
            if (!unit.rounds || unit.rounds.length === 0) {
                return acc;
            }
            unitsWithRoundsCount++;

            // FIX: Property '$id' does not exist on type 'Unit'.
            const unitProgress = studentProgressData.unitsProgress[unit.id];
            if (!unitProgress) {
                return acc;
            }
            
            const completedRoundsCount = Object.values(unitProgress.roundsProgress).filter((r: any) => r.completed).length;
            const unitCompletion = (completedRoundsCount / unit.rounds.length) * 100;

            return acc + unitCompletion;
        }, 0);

        return unitsWithRoundsCount > 0 ? totalProgressSum / unitsWithRoundsCount : 0;
    };


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
                    <h2 className="text-xl font-bold mb-4">Student Progress Overview</h2>
                    <div className="space-y-4">
                        {students.map(student => {
                            // FIX: Use 'id' instead of '$id' for Supabase compatibility
                            const progress = calculateOverallProgress(student.id);
                            return (
                                <div key={student.id} className="p-2 rounded-lg items-center">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-gray-800 dark:text-white">{student.name}</span>
                                                <button 
                                                    onClick={() => onViewDetails(student)}
                                                    className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900"
                                                >
                                                    Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 w-12 text-right">{progress.toFixed(0)}%</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <ActivityFeed />
            </div>
        </div>
    );
};

export default TeacherDashboard;