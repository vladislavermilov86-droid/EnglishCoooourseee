import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { ChatAltIcon } from '../icons/Icons';

interface HeaderProps {
    onChatClick: () => void;
    onProfileClick: () => void;
    onMenuClick: () => void;
    activeViewName: string;
    chatNotification?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onChatClick, onProfileClick, onMenuClick, activeViewName, chatNotification }) => {
    const { state } = useApp();
    const { loggedInUser } = state;

    return (
        <header className="bg-white dark:bg-slate-900 p-4 flex justify-between items-center border-b dark:border-slate-800 border-t-4 border-red-500">
            <div className="flex items-center space-x-4">
                 <button 
                    onClick={onMenuClick} 
                    className="lg:hidden p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    aria-label="Open menu"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white hidden sm:block">{activeViewName}</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <button 
                    onClick={onChatClick}
                    className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    aria-label="Open Chat"
                >
                    <ChatAltIcon className="w-6 h-6" />
                    {chatNotification && (
                        <span className="absolute top-1 right-1 block w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                    )}
                </button>
                <button onClick={onProfileClick} className="flex items-center space-x-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <img src={loggedInUser?.avatar_url} alt={loggedInUser?.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="hidden sm:block">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white text-left">{loggedInUser?.name || loggedInUser?.email}</p>
                    </div>
                </button>
            </div>
        </header>
    );
};

export default Header;