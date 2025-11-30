import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import LoginPage from './components/auth/LoginPage';
import StudentView from './components/student/StudentView';
import TeacherView from './components/teacher/TeacherView';
import { UserRole } from './types';
import SupabaseSetupGuide from './components/auth/SupabaseSetupGuide';
import { areSupabaseKeysMissing } from './supabase';

const LoadingSpinner = () => (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
    </div>
);

const ErrorDisplay: React.FC<{ message: string, onReset: () => void }> = ({ message, onReset }) => (
     <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">An Error Occurred</h1>
            <pre className="bg-red-100 dark:bg-red-900/50 p-4 rounded-lg text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono text-sm mb-6">{message}</pre>
            <button
                onClick={onReset}
                className="w-full bg-red-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-600 transition"
            >
                Try Again
            </button>
        </div>
    </div>
);


const AppContent: React.FC = () => {
    const { state } = useApp();

    if (areSupabaseKeysMissing) {
        return <SupabaseSetupGuide />;
    }

    if (state.error) {
        return <ErrorDisplay message={state.error} onReset={() => window.location.reload()} />;
    }

    if (state.isLoading) {
        return <LoadingSpinner />;
    }

    if (!state.loggedInUser) {
        return <LoginPage />;
    }

    if (state.loggedInUser.role.toLowerCase() === UserRole.Teacher) {
        return <TeacherView />;
    } else {
        return <StudentView />;
    }
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;