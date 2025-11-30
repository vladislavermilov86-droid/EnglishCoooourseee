import * as React from 'react';
import { useApp } from './contexts/AppContext';
import LoginPage from './components/auth/LoginPage';
import StudentView from './components/student/StudentView';
import TeacherView from './components/teacher/TeacherView';
import { UserRole } from './types';
import SupabaseSetupGuide from './components/auth/SupabaseSetupGuide';
import { supabase } from './supabase';

const App: React.FC = () => {
  const { state, dispatch } = useApp();
  const { loggedInUser, isLoading, error } = state;
  const [showSetupGuide, setShowSetupGuide] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
        if (isLoading) {
            dispatch({ type: 'SET_ERROR', payload: 'Authentication timed out. Please check your connection and Supabase configuration.' });
        }
    }, 10000);

    return () => clearTimeout(timer);
  }, [isLoading, dispatch]);

  if (showSetupGuide) {
    return <SupabaseSetupGuide />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700 p-4">
        <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-2">An Error Occurred</h2>
            <p className="mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  window.location.reload();
                }}
                className="w-full px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Back to Login
              </button>
              {(error.includes('Supabase') || error.includes('RLS') || error.includes('JWT') || error.includes('relation') || error.includes('check your setup')) && (
                  <button
                    onClick={() => setShowSetupGuide(true)}
                    className="w-full px-6 py-2 bg-yellow-500 text-yellow-900 font-semibold rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    Show Setup Guide
                  </button>
              )}
            </div>
        </div>
      </div>
    );
  }

  if (!loggedInUser) {
    return <LoginPage />;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen">
      {loggedInUser.role.toLowerCase() === UserRole.Student ? <StudentView /> : <TeacherView />}
    </div>
  );
};

export default App;