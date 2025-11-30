import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { courseData } from '../../data/seedData';
import { BookOpenIcon, CheckCircleIcon, ExclamationCircleIcon } from '../icons/Icons';
import { useApp } from '../../contexts/AppContext';
import { UserRole } from '../../types';

const InitialSetup: React.FC = () => {
    const { state } = useApp();
    const { loggedInUser } = state;
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Ready to start.');
    const [isComplete, setIsComplete] = useState(false);

    const handleSeedData = async () => {
        setIsLoading(true);
        setIsComplete(false);
        setProgress(0);

        try {
            setStatusText('Cleaning up existing course data...');
            const { data: existingUnits, error: fetchError } = await supabase.from('units').select('id');
            if (fetchError) throw fetchError;

            if (existingUnits && existingUnits.length > 0) {
                 const { error: deleteError } = await supabase.from('units').delete().in('id', existingUnits.map(u => u.id));
                 if (deleteError) throw new Error(`Cleanup failed: ${deleteError.message}`);
            }
            setProgress(5);
            
            setStatusText('Starting data import...');
            const totalItems = courseData.reduce((acc, unit) => acc + 1 + unit.rounds.length + unit.rounds.reduce((rAcc, r) => rAcc + r.words.length, 0), 0);
            let itemsProcessed = 0;

            for (const unitData of courseData) {
                setStatusText(`Creating Unit: ${unitData.unit.title}`);
                const unitPayload = {
                    id: crypto.randomUUID(),
                    title: unitData.unit.title,
                    description: unitData.unit.description,
                    icon: unitData.unit.icon,
                    unlocked: unitData.unit.unlocked,
                    unit_number: unitData.unit.unit_number
                };
                const { data: unitDocs, error: unitError } = await supabase.from('units').insert([unitPayload]).select();
                if (unitError) throw unitError;
                if (!unitDocs || unitDocs.length === 0) throw new Error('Unit creation did not return the expected record.');
                const unitDoc = unitDocs[0];
                itemsProcessed++;
                setProgress(5 + (itemsProcessed / totalItems) * 95);

                for (const roundData of unitData.rounds) {
                    setStatusText(`Creating Round: ${roundData.title} in ${unitData.unit.title}`);
                    const { data: roundDocs, error: roundError } = await supabase.from('rounds').insert([{
                        id: crypto.randomUUID(),
                        title: roundData.title,
                        unit_id: unitDoc.id,
                    }]).select();

                    if (roundError) throw roundError;
                    if (!roundDocs || roundDocs.length === 0) throw new Error('Round creation did not return the expected record.');
                    const roundDoc = roundDocs[0];
                    itemsProcessed++;
                    setProgress(5 + (itemsProcessed / totalItems) * 95);

                    const wordsToInsert = roundData.words.map(wordData => ({
                        id: crypto.randomUUID(),
                        ...wordData,
                        round_id: roundDoc.id,
                    }));
                    
                    setStatusText(`Adding ${wordsToInsert.length} words to ${roundData.title}...`);
                    const { error: wordError } = await supabase.from('words').insert(wordsToInsert);
                    if (wordError) throw wordError;

                    itemsProcessed += wordsToInsert.length;
                    setProgress(5 + (itemsProcessed / totalItems) * 95);
                }
            }
            setStatusText('Course content created successfully!');
            setIsComplete(true);
            setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
            console.error('Failed to seed data:', error);
            setStatusText(`Error: ${error.message}.`);
            alert(`Failed to create course content. Please check your Supabase RLS policies and table structure. Details: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const LoadingSpinner = () => (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        </div>
    );
    
    if (!loggedInUser) {
        return <LoadingSpinner />;
    }

    const isTeacher = loggedInUser.role.toLowerCase() === UserRole.Teacher;

    if (!isTeacher) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-gray-900 p-4">
                <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <ExclamationCircleIcon className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h1 className="text-3xl font-bold text-red-600 dark:text-red-400">Permission Error</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-4 mb-6">
                        Your account does not have 'teacher' privileges required to set up the course content.
                    </p>
                    <div className="text-left bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">
                        <p className="font-semibold">How to fix:</p>
                        <ol className="list-decimal list-inside mt-2 text-sm">
                            <li>Go to the Supabase dashboard.</li>
                            <li>Navigate to <strong>Table Editor</strong> → <strong>profiles</strong> table.</li>
                            <li>Find the row with your email.</li>
                            <li>Change the value in the <strong>role</strong> column from 'student' to 'teacher'.</li>
                            <li>Save the change and refresh this page.</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                <BookOpenIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Course Setup</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">
                    Your course content is incomplete. Let's add the 10 initial units to get you started. This will clear any existing units and create a fresh course.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleSeedData}
                        disabled={isLoading || isComplete}
                        className="w-full bg-blue-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-600 transition disabled:bg-blue-300 dark:disabled:bg-blue-800 flex items-center justify-center text-lg"
                    >
                        {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isComplete ? 'Setup Complete!' : isLoading ? 'Creating Content...' : 'Generate Course Content'}
                        {isComplete && <CheckCircleIcon className="w-6 h-6 ml-2"/>}
                    </button>

                    {(isLoading || isComplete) && (
                        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 min-h-[20px]">{statusText}</p>
                </div>
            </div>
        </div>
    );
};

export default InitialSetup;