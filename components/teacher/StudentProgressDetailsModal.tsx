import React, { useState } from 'react';
import { User, Unit, UnitProgress, Word, RoundProgress, AttemptHistory } from '../../types';
import { XIcon, CheckCircleIcon } from '../icons/Icons';

interface StudentProgressDetailsModalProps {
    student: User;
    unit: Unit;
    progress: UnitProgress | null;
    onClose: () => void;
}

const StudentProgressDetailsModal: React.FC<StudentProgressDetailsModalProps> = ({ student, unit, progress, onClose }) => {
    const [selectedAttempt, setSelectedAttempt] = useState<number>(1);

    const calculateOverallUnitScore = (p: UnitProgress | null): number => {
        if (!p) return 0;
        let totalScore = 0;
        let roundsWithHistory = 0;
        unit.rounds.forEach(round => {
            // FIX: Use 'id' instead of '$id'
            const roundProgress = p.roundsProgress[round.id];
            const lastAttempt = roundProgress?.history?.[roundProgress.history.length - 1];
            if (lastAttempt) {
                totalScore += lastAttempt.score;
                roundsWithHistory++;
            }
        });
        return roundsWithHistory > 0 ? totalScore / unit.rounds.length : 0;
    };

    const overallScore = calculateOverallUnitScore(progress);

    const formatCompletionTime = (isoString?: string) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // FIX: Use 'id' instead of '$id'
    const attemptOptions = progress?.roundsProgress[unit.rounds[0]?.id]?.history?.length || 0;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl ${overallScore >= 80 ? 'bg-green-500' : 'bg-red-500'}`}>
                            {overallScore.toFixed(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{student.name}</h2>
                            <p className="text-gray-500">{unit.title}</p>
                        </div>
                    </div>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-6 flex-1 overflow-y-auto">
                    {attemptOptions > 1 && (
                        <div className="mb-4">
                            <label htmlFor="attempt-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Show Attempt:
                            </label>
                            <select
                                id="attempt-selector"
                                value={selectedAttempt}
                                onChange={(e) => setSelectedAttempt(Number(e.target.value))}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            >
                                {Array.from({ length: attemptOptions }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>
                                        Attempt {num}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-4">
                        {!progress && <p className="text-center text-gray-500">This student has not started this unit yet.</p>}
                        {unit.rounds.map(round => {
                            const roundProgress = progress?.roundsProgress[round.id];
                            const attemptData = roundProgress?.history?.[selectedAttempt - 1];
                            
                            if (!attemptData) {
                                return (
                                    <div key={round.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 opacity-50">
                                         <p className="font-bold">{round.title}: Vocabulary practice</p>
                                         <p className="text-sm text-gray-500">No data for this attempt.</p>
                                    </div>
                                );
                            }
                            
                            const getAnswerForWord = (wordId: string, stage: string) => {
                                return attemptData.answers.find(a => a.wordId === wordId && a.stage === stage);
                            };

                            return (
                                <details key={`${round.id}-${selectedAttempt}`} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4" open>
                                    <summary className="font-bold cursor-pointer flex justify-between items-center">
                                        <div>
                                            <span>{round.title}: Vocabulary practice</span>
                                            <p className="text-xs text-gray-500 font-normal">
                                                Completed: {formatCompletionTime(attemptData.completedAt)} (Score: {attemptData.score.toFixed(0)}%)
                                            </p>
                                        </div>
                                        <CheckCircleIcon className="w-6 h-6 text-green-500" />
                                    </summary>
                                    <div className="mt-4 space-y-3">
                                        <div>
                                            <h4 className="font-semibold mb-2">Spelling</h4>
                                            {round.words.map(word => {
                                                const answer = getAnswerForWord(word.id, 'spell');
                                                const isCorrect = answer?.isCorrect ?? false;
                                                return (
                                                     <div key={word.id} className={`p-2 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                                        <p><strong>Word:</strong> {word.russian}</p>
                                                        <p><strong>Correct Answer:</strong> {word.english}</p>
                                                        <p><strong>Student's Answer:</strong> <span className={!isCorrect ? 'text-red-600 font-bold' : ''}>{answer?.answer || 'No answer'}</span></p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Choose Translation</h4>
                                             {round.words.map(word => {
                                                const answer = getAnswerForWord(word.id, 'choose_translation');
                                                const isCorrect = answer?.isCorrect ?? false;
                                                return (
                                                     <div key={word.id} className={`p-2 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                                        <p><strong>Word:</strong> {word.english}</p>
                                                        <p><strong>Correct Answer:</strong> {word.russian}</p>
                                                        <p><strong>Student's Choice:</strong> <span className={!isCorrect ? 'text-red-600 font-bold' : ''}>{answer?.answer || 'No answer'}</span></p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                         <div>
                                            <h4 className="font-semibold mb-2">Choose Picture</h4>
                                             {round.words.map(word => {
                                                const answer = getAnswerForWord(word.id, 'choose_picture');
                                                const isCorrect = answer?.isCorrect ?? false;
                                                return (
                                                    <div key={word.id} className={`p-2 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                                        <p><strong>Word:</strong> {word.english}</p>
                                                        <div className="flex space-x-4 items-center mt-2">
                                                            <div>
                                                                <p className="text-xs">Correct Image:</p>
                                                                <div className="w-20 h-12 rounded border-2 border-green-500 bg-white flex items-center justify-center">
                                                                    {/* FIX: Use 'image_url' instead of 'imageUrl' */}
                                                                    <img src={word.image_url} alt="correct answer" className="max-w-full max-h-full object-contain" />
                                                                </div>
                                                            </div>
                                                            {answer && !isCorrect && (
                                                                <div>
                                                                    <p className="text-xs">Student's Choice:</p>
                                                                    <div className="w-20 h-12 rounded border-2 border-red-500 bg-white flex items-center justify-center">
                                                                        <img src={answer.answer} alt="student's answer" className="max-w-full max-h-full object-contain" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </details>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentProgressDetailsModal;