import React, { useState } from 'react';
import { UserRole } from '../../types';
import { BookOpenIcon, CheckCircleIcon, UsersIcon, AcademicCapIcon, ExclamationCircleIcon } from '../icons/Icons';
import { supabase } from '../../supabase';
import { useApp } from '../../contexts/AppContext';

const Logo = () => (
    <div className="flex items-center space-x-2">
        <BookOpenIcon className="w-8 h-8 text-yellow-400" />
        <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
            EnglishCourse Family
        </div>
    </div>
);

const LoginPage: React.FC = () => {
    const { state, dispatch } = useApp();
    const { selectedLoginRole } = state;
    const [view, setView] = useState<'profile' | 'form'>('profile');
    const [selectedProfile, setSelectedProfile] = useState<UserRole | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const resetFormState = () => {
        setEmail('');
        setPassword('');
        setError('');
        setIsLoading(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        dispatch({ type: 'SET_LOADING', payload: true });
        
        try {
            const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;
            if (!user) throw new Error("Login successful, but no user object returned.");

            const { data: userProfiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id);

            if (profileError) {
                throw new Error(`Ошибка при загрузке профиля: ${profileError.message}`);
            }
            
            if (!userProfiles || userProfiles.length === 0) {
                throw new Error("Профиль не найден. Пожалуйста, убедитесь, что ваш аккаунт существует.");
            }
            
            const userProfile = userProfiles[0];
            if (userProfiles.length > 1) {
                console.warn(`Duplicate profiles found for user ${user.id}. Using the first one.`);
            }

            if (selectedLoginRole && userProfile.role !== selectedLoginRole) {
                await supabase.auth.signOut();
                setError('Вы выбрали неверный тип профиля. Пожалуйста, выберите правильный и попробуйте снова.');
                setIsLoading(false);
                dispatch({ type: 'SET_LOADING', payload: false });
                return;
            }

        } catch (err: any) {
            console.error('Login failed:', err);

            if (err.message.includes('Database error querying schema')) {
                const projectRef = import.meta.env.VITE_SUPABASE_URL?.split('.')[0]?.split('//')[1] || 'НЕИЗВЕСТНО';
                const errorMessage = `Ошибка входа из-за проблемы с правами доступа к базе данных.\n\n` +
                                     `**ВАЖНО:** Эта ошибка почти всегда возникает, когда SQL-скрипт для настройки выполняется в **неправильном проекте Supabase**.\n\n` +
                                     `Пожалуйста, перейдите в SQL Editor вашего проекта Supabase и убедитесь, что "Reference ID" проекта точно совпадает с этим: **${projectRef}**.\n\n` +
                                     `После этого снова запустите полный скрипт настройки, используя кнопку "Show Setup Guide".`;
                dispatch({ type: 'SET_ERROR', payload: errorMessage });
            } else {
                let localErrorMessage = `Произошла непредвиденная ошибка при входе.`;
                if (err.message.includes('Invalid login credentials')) {
                    localErrorMessage = "Неверный логин или пароль. Пожалуйста, проверьте правильность ввода.";
                } else if (err.message.includes('Email not confirmed')) {
                    localErrorMessage = "Ваш email не подтвержден. Пожалуйста, проверьте почту и перейдите по ссылке для активации.";
                } else if (err.message.includes('Failed to fetch')) {
                    localErrorMessage = "Не удалось подключиться к серверу. Проверьте ваше интернет-соединение и конфигурацию Supabase.";
                } else {
                    localErrorMessage = err.message || localErrorMessage;
                }
                setError(localErrorMessage);
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (selectedProfile) {
            dispatch({ type: 'SET_LOGIN_ROLE', payload: selectedProfile });
            resetFormState();
            setView('form');
        }
    };

    if (view === 'profile') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-4">
                <div className="w-full max-w-md">
                    <div className="mb-12">
                        <Logo />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-8">Выберите ваш профиль</h1>
                    <div className="space-y-4 mb-8">
                        <button
                            onClick={() => setSelectedProfile(UserRole.Student)}
                            className={`w-full text-left p-4 border rounded-xl flex items-center justify-between transition-all ${
                                selectedProfile === UserRole.Student
                                ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/50 dark:border-yellow-700'
                                : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                            }`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                                    <UsersIcon className="w-6 h-6 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ученик</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Доступ к урокам и домашним заданиям.</p>
                                </div>
                            </div>
                            {selectedProfile === UserRole.Student && <CheckCircleIcon className="w-6 h-6 text-yellow-500" />}
                        </button>
                        <button
                            onClick={() => setSelectedProfile(UserRole.Teacher)}
                            className={`w-full text-left p-4 border rounded-xl flex items-center justify-between transition-all ${
                                selectedProfile === UserRole.Teacher
                                ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/50 dark:border-blue-700'
                                : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                            }`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                    <AcademicCapIcon className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Учитель</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Управление уроками и отслеживание прогресса.</p>
                                </div>
                            </div>
                            {selectedProfile === UserRole.Teacher && <CheckCircleIcon className="w-6 h-6 text-blue-500" />}
                        </button>
                    </div>
                     <button 
                        onClick={handleNext} 
                        disabled={!selectedProfile}
                        className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition disabled:bg-blue-300 dark:disabled:bg-blue-800"
                    >
                        Далее
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8">
                    <Logo />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                   Вход в аккаунт
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Введите ваши данные для продолжения.</p>

                <form onSubmit={handleLogin} className="space-y-6">
                     {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative flex items-start space-x-3" role="alert">
                            <ExclamationCircleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <span className="block sm:inline text-sm">{error}</span>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400 block mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
                            placeholder="Введите ваш email"
                        />
                    </div>
                    <div>
                         <div className="flex items-center justify-between mb-2">
                             <label className="text-sm font-bold text-gray-600 dark:text-gray-400 block">Пароль</label>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
                            placeholder="Введите ваш пароль"
                        />
                    </div>
                   
                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition disabled:bg-blue-300 dark:disabled:bg-blue-800 flex items-center justify-center"
                        >
                            {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isLoading ? 'Вход...' : 'Войти'}
                        </button>
                    </div>
                </form>
                <button onClick={() => {
                    setView('profile'); 
                    setSelectedProfile(null); 
                    resetFormState();
                    dispatch({ type: 'SET_LOGIN_ROLE', payload: null });
                }} className="mt-8 text-sm text-gray-500 hover:underline w-full text-center">
                    Назад к выбору профиля
                </button>
            </div>
        </div>
    );
};

export default LoginPage;