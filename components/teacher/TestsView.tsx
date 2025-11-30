import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { UnitTest } from '../../types';
import { PlusCircleIcon, TrashIcon, AcademicCapIcon, CheckCircleIcon } from '../icons/Icons';
import { supabase } from '../../supabase';

interface TestsViewProps {
    onSelectTest: (test: UnitTest) => void;
}

const TestsView: React.FC<TestsViewProps> = ({ onSelectTest }) => {
    const { state, dispatch } = useApp();
    const { units, unitTests } = state;
    const [creatingTestUnitId, setCreatingTestUnitId] = useState<string | null>(null);

    const handleCreateTest = async (unitId: string) => {
        const unit = units.find(u => u.id === unitId);
        if (!unit || creatingTestUnitId) return;

        const alreadyExists = unitTests.some(test => test.unit_id === unitId);
        if (alreadyExists) {
            alert('A test for this unit already exists.');
            return;
        }

        setCreatingTestUnitId(unitId);

        try {
            const newTestPayload = {
                unit_id: unit.id,
                title: `${unit.title} Test`,
                status: 'waiting' as const,
            };
            
            const { data: newTest, error } = await supabase.from('unit_tests').insert([newTestPayload]).select().single();

            if (error) throw error;
            if (!newTest) throw new Error("Test creation did not return the new record.");

            // Manually dispatch to update UI immediately, rather than waiting for realtime.
            // The realtime listener will also fire, but the reducer handles upserts gracefully.
            dispatch({ type: 'UPSERT_UNIT_TEST', payload: newTest as UnitTest });

        } catch(error: any) {
            console.error('Error creating test:', error);
            let message = 'Failed to create test. Please check your Supabase RLS policies and that the unit_id is unique.';
            if (error.message.includes('duplicate key value violates unique constraint')) {
                message = 'A test for this unit already exists. The page might be out of sync.';
            }
            alert(message);
        } finally {
            setCreatingTestUnitId(null);
        }
    };

    const handleActivateTest = async (test: UnitTest) => {
        // Optimistic UI update
        const optimisticTest = { ...test, status: 'waiting' as const };
        dispatch({ type: 'UPSERT_UNIT_TEST', payload: optimisticTest });

        try {
            const { data: updatedDoc, error } = await supabase.from('unit_tests').update({ status: 'waiting' }).eq('id', test.id).select().single();
            if (error) throw error;
            onSelectTest(updatedDoc as UnitTest);
        } catch(error) {
            // Revert on failure
            dispatch({ type: 'UPSERT_UNIT_TEST', payload: test });
            console.error('Error activating test:', error);
            alert('Failed to activate test.');
        }
    };

    const handleDeleteTest = async (testId: string) => {
        const testToDelete = unitTests.find(t => t.id === testId);
        if (!testToDelete) return;

        if (window.confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
            // Optimistic UI update
            dispatch({ type: 'DELETE_TEST', payload: { testId } });

            try {
                const { error } = await supabase.from('unit_tests').delete().eq('id', testId);
                if (error) {
                    // Revert on error
                    dispatch({ type: 'UPSERT_UNIT_TEST', payload: testToDelete });
                    throw error;
                }
            } catch(error) {
                console.error('Error deleting test:', error);
                alert('Failed to delete test. It may have student results associated with it.');
            }
        }
    };

    const getStatusInfo = (status: UnitTest['status']) => {
        switch (status) {
            case 'inactive': return { text: 'Inactive', color: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' };
            case 'waiting': return { text: 'Waiting', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
            case 'in_progress': return { text: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
            case 'completed': return { text: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
            default: return { text: 'Unknown', color: 'bg-gray-200 text-gray-700' };
        }
    };

    const getUnitNumberFromTitle = (title: string): number => {
        const match = title.match(/\d+/);
        return match ? parseInt(match[0], 10) : Infinity;
    };
    
    const sortedTests = [...unitTests].sort((a, b) => 
        getUnitNumberFromTitle(a.title) - getUnitNumberFromTitle(b.title)
    );

    const unitsWithoutTests = units.filter(unit => !unitTests.some(test => test.unit_id === unit.id));

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Test Management</h1>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Create Test Column */}
                <div className="xl:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow p-6 h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                        <PlusCircleIcon className="w-6 h-6 text-blue-500"/>
                        <span>Create New Test</span>
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select a unit to generate a new test. A test can only be created once per unit.</p>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {unitsWithoutTests.length > 0 ? unitsWithoutTests.map(unit => (
                            <div key={unit.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="font-semibold">{unit.title}</p>
                                <button
                                    onClick={() => handleCreateTest(unit.id)}
                                    disabled={creatingTestUnitId === unit.id}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-wait w-24 text-center"
                                >
                                    {creatingTestUnitId === unit.id ? (
                                        <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : 'Create'}
                                </button>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 py-4">All units have a test.</p>
                        )}
                    </div>
                </div>

                {/* Existing Tests Column */}
                <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
                     <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                        <AcademicCapIcon className="w-6 h-6 text-purple-500"/>
                        <span>Existing Tests</span>
                    </h2>
                    <div className="space-y-4">
                        {sortedTests.map(test => {
                            const status = getStatusInfo(test.status);
                            const unit = units.find(u => u.id === test.unit_id);
                            const hasResults = (test.results || []).length > 0;

                            return (
                                <div key={test.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>{status.text}</span>
                                            <h3 className="font-bold">{test.title}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Associated with: {unit?.title}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                        {test.status === 'inactive' && (
                                            <button 
                                                onClick={() => handleActivateTest(test)} 
                                                className="px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-lg text-sm font-semibold hover:bg-yellow-500"
                                            >
                                                Activate
                                            </button>
                                        )}
                                        {(test.status === 'waiting' || test.status === 'in_progress') && (
                                            <button 
                                                onClick={() => onSelectTest(test)} 
                                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600"
                                            >
                                                Manage
                                            </button>
                                        )}
                                        {test.status === 'completed' && (
                                            <button 
                                                onClick={() => onSelectTest(test)} 
                                                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600"
                                            >
                                                Report
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDeleteTest(test.id)} 
                                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"
                                            title="Delete Test"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedTests.length === 0 && <p className="text-center text-gray-500 py-8">No tests created yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestsView;
