import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { User, Unit, UnitProgress, UserRole } from '../../types';
import StudentProgressDetailsModal from './StudentProgressDetailsModal';
import { UsersIcon } from '../icons/Icons';

const MarksView: React.FC = () => {
    const { state } = useApp();
    const [modalData, setModalData] = useState<{ student: User; unit: Unit; progress: UnitProgress | null } | null>(null);

    const students = state.users.filter(user => user.role.toLowerCase() === UserRole.Student);
    const units = state.units;

    const gridStyle = {
        gridTemplateColumns: `250px repeat(${units.length}, minmax(120px, 1fr))`
    };


    const getUnitProgress = (studentId: string, unitId: string): UnitProgress | null => {
        return state.studentProgress[studentId]?.unitsProgress[unitId] || null;
    };

    const calculateUnitScore = (progress: UnitProgress | null, unit: Unit | undefined): number | null => {
        if (!progress || !unit || !unit.rounds || unit.rounds.length === 0) return null;

        const hasAnyProgress = Object.values(progress.roundsProgress).some((rp: any) => rp.completed);
        if (!hasAnyProgress) return null;

        let totalScore = 0;
        unit.rounds.forEach(round => {
            // FIX: Use 'id' instead of '$id' for Supabase compatibility
            const roundProgress = progress.roundsProgress[round.id];
            if (roundProgress?.completed) {
                const lastAttempt = roundProgress.history?.[roundProgress.history.length - 1];
                if (lastAttempt) {
                    totalScore += lastAttempt.score;
                }
            }
        });
        
        return totalScore / unit.rounds.length;
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Marks</h1>
            </div>

            <div className="overflow-x-auto">
                {units.length > 0 ? (
                    <div className="min-w-max">
                        <div className="grid" style={gridStyle}>
                            {/* Header Row */}
                            <div className="text-left font-semibold p-2 sticky left-0 bg-white dark:bg-gray-800 border-b-2 dark:border-gray-700 flex items-center space-x-2 text-gray-500 z-10">
                                <UsersIcon className="w-5 h-5" />
                                <span>Students</span>
                            </div>
                            {units.map((unit) => (
                                <div key={unit.id} className="text-center font-semibold p-2 border-b-2 dark:border-gray-700 whitespace-nowrap">
                                    {unit.title}
                                </div>
                            ))}
                            
                            {/* Student Rows */}
                            {students.map((student: User, index) => (
                                <React.Fragment key={student.id}>
                                    <div className="text-left font-semibold p-2 sticky left-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex items-center space-x-3 z-10">
                                        <span className="text-gray-400 w-5 text-right">{index + 1}</span>
                                        <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                                        <span>{student.name}</span>
                                    </div>
                                    {units.map((unit) => {
                                        // FIX: Use 'id' instead of '$id' for Supabase compatibility
                                        const progress = getUnitProgress(student.id, unit.id);
                                        const score = calculateUnitScore(progress, unit);
                                        
                                        let color = 'bg-gray-200 dark:bg-gray-600';
                                        if (score !== null) {
                                        color = score >= 80 ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
                                        }

                                        return (
                                            <div key={unit.id} className="text-center p-2 border-l border-t dark:border-gray-700 flex items-center justify-center">
                                                <button
                                                    onClick={() => setModalData({ student, unit, progress })}
                                                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm mx-auto ${color} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    disabled={!unit.unlocked}
                                                >
                                                    {score !== null ? score.toFixed(0) : '-'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p className="font-semibold">No course content found.</p>
                        <p>Go to the "Content" tab to create your first unit.</p>
                    </div>
                )}
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

export default MarksView;