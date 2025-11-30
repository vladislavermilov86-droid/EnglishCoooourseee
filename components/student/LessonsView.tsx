import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit } from '../../types';
import RoundView from './RoundView';
import { LockClosedIcon } from '../icons/Icons';

const UnitCard: React.FC<{ unit: Unit, onSelect: () => void, isLocked: boolean, progress: number, isComplete: boolean }> = ({ unit, onSelect, isLocked, progress, isComplete }) => {
    const cardColor = progress === 100 ? 'bg-green-500' : 'bg-blue-500';

    let progressColor = 'bg-yellow-400 text-gray-800'; // Default for in-progress
    if (isComplete) {
        if (progress < 80) {
            progressColor = 'bg-red-500 text-white';
        } else {
            progressColor = 'bg-green-500 text-white';
        }
    }


    return (
        <button 
            onClick={onSelect} 
            disabled={isLocked}
            className={`relative w-full sm:w-64 h-72 rounded-3xl p-6 text-white flex flex-col justify-between items-center text-center transform hover:-translate-y-2 transition-transform duration-300 ${isLocked ? 'bg-gray-600 cursor-not-allowed' : cardColor} shadow-lg`}
        >
            <div className="flex-1 flex flex-col justify-center items-center">
                <h3 className="font-bold text-2xl">{unit.title.split(':')[0]}</h3>
                <p className="text-sm font-light">{unit.description}</p>
                <div className="text-6xl my-4">{unit.icon}</div>
            </div>
            {isLocked ? (
                <div className="w-full flex items-center justify-center bg-black/30 rounded-full py-2">
                    <LockClosedIcon className="w-5 h-5 mr-2" />
                    Locked
                </div>
            ) : (
                <div className={`w-full ${progressColor} font-bold rounded-full py-2`}>
                    {progress.toFixed(0)}%
                </div>
            )}
        </button>
    );
};

interface LessonsViewProps {
    directToUnitId: string | null;
    resetDirectToUnit: () => void;
}

const LessonsView: React.FC<LessonsViewProps> = ({ directToUnitId, resetDirectToUnit }) => {
    const { state } = useApp();
    const { units, loggedInUser, studentProgress } = state;
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const getUnitProgressDetails = (unitId: string): { score: number, isComplete: boolean } => {
        if (!loggedInUser) return { score: 0, isComplete: false };
        const unit = units.find(u => u.id === unitId);
        if (!unit) return { score: 0, isComplete: false };

        const unitProgressData = studentProgress[loggedInUser.id]?.unitsProgress[unitId];
        if (!unitProgressData) return { score: 0, isComplete: false };
        
        const totalRounds = unit.rounds?.length || 0;
        if (totalRounds === 0) return { score: 0, isComplete: false };

        const completedRoundsCount = (unit.rounds || []).filter(round => unitProgressData.roundsProgress[round.id]?.completed).length;
        const isComplete = totalRounds > 0 && completedRoundsCount === totalRounds;

        const totalScore = (unit.rounds || []).reduce((acc, round) => {
            const roundProgress = unitProgressData.roundsProgress[round.id];
            if (roundProgress && roundProgress.completed) {
                const lastAttempt = roundProgress.history?.[roundProgress.history.length - 1];
                return acc + (lastAttempt?.score || 0);
            }
            return acc;
        }, 0);
        
        const progressPercentage = totalRounds > 0 ? totalScore / totalRounds : 0;
        
        return { score: progressPercentage, isComplete };
    };

    useEffect(() => {
        if (directToUnitId) {
            const unit = units.find(u => u.id === directToUnitId);
            if (unit) {
                setSelectedUnit(unit);
            }
            resetDirectToUnit();
        }
    }, [directToUnitId, units, resetDirectToUnit]);


    if (selectedUnit) {
        return <RoundView unit={selectedUnit} onBack={() => setSelectedUnit(null)} />;
    }

    return (
        <div className="w-full relative">
            <h1 className="text-3xl font-bold mb-8">Lessons</h1>
             {alertMessage && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg z-20 animate-bounce">
                    {alertMessage}
                </div>
            )}
            <div className="flex flex-wrap gap-8 justify-center">
                 {units.map((unit) => {
                    const isLocked = !unit.unlocked;
                    const progressDetails = getUnitProgressDetails(unit.id);
                    return (
                        <UnitCard 
                            key={unit.id} 
                            unit={unit} 
                            onSelect={() => {
                                if (isLocked) {
                                    setAlertMessage("Учитель не открыл юнит");
                                    setTimeout(() => setAlertMessage(null), 3000);
                                } else {
                                    setSelectedUnit(unit);
                                }
                            }}
                            isLocked={isLocked} 
                            progress={progressDetails.score}
                            isComplete={progressDetails.isComplete}
                        />
                    )
                 })}
            </div>
        </div>
    );
};

export default LessonsView;