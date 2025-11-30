import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, UnitProgress, RoundProgress, ActivityItem, StudentTestResult } from '../../types';

const ActivityFeed: React.FC = () => {
    const { state } = useApp();
    const { users, units, studentProgress, unitTests } = state;

    const activities: ActivityItem[] = [];

    Object.entries(studentProgress).forEach(([studentId, studentData]) => {
        const data = studentData as { unitsProgress: { [unitId: string]: UnitProgress } };
        if (!data.unitsProgress) return;

        Object.entries(data.unitsProgress).forEach(([unitId, unitData]) => {
            const typedUnitData = unitData as UnitProgress;
            if (!typedUnitData.roundsProgress) return;

            Object.entries(typedUnitData.roundsProgress).forEach(([roundId, roundData]) => {
                const typedRoundData = roundData as RoundProgress;
                if (typedRoundData.completed) {
                    const lastAttempt = typedRoundData.history?.[typedRoundData.history.length - 1];
                    const unit = units.find(u => u.id === unitId);
                    const round = unit?.rounds?.find(r => r.id === roundId);
                    if (unit && round && lastAttempt) {
                        activities.push({
                            studentId,
                            type: 'round',
                            title: `${unit.title} - ${round.title}`,
                            score: lastAttempt.score,
                            timestamp: lastAttempt.completedAt,
                        });
                    }
                }
            });
        });
    });

    unitTests.forEach(test => {
        if (test.status === 'completed' && test.results) {
            const results: StudentTestResult[] = test.results || [];
            results.forEach(result => {
                activities.push({
                    studentId: result.studentId,
                    type: 'test',
                    title: test.title,
                    score: result.score,
                    timestamp: result.completedAt,
                });
            });
        }
    });

    const sortedActivities = activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const formatTimestamp = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {sortedActivities.slice(0, 10).map((activity, index) => {
                    const student = users.find(u => u.id === activity.studentId);
                    if (!student) return null;

                    return (
                        <div key={index} className="flex items-center space-x-4">
                            <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" />
                            <div className="flex-1">
                                <p className="text-sm">
                                    <span className="font-bold">{student.name.split(' ')[0]}</span> completed <span className="font-semibold text-blue-600 dark:text-blue-400">{activity.title}</span>
                                </p>
                                <p className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                            </div>
                            <div className={`font-bold text-lg ${activity.score >= 80 ? 'text-green-500' : 'text-red-500'}`}>
                                {activity.score.toFixed(0)}%
                            </div>
                        </div>
                    );
                })}
                 {sortedActivities.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No student activity yet.</p>
                )}
            </div>
        </div>
    );
};

export default ActivityFeed;
