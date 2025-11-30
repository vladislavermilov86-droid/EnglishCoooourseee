import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { BookOpenIcon } from '../icons/Icons';
import { supabase } from '../../supabase';

interface NavItem {
    name: string;
    icon: React.FC<{className?: string}>;
    notification?: boolean;
}

interface SidebarProps {
    navItems: NavItem[];
    activeView: string;
    setActiveView: (view: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Logo = () => (
    <div className="flex items-center space-x-2 px-4">
        <BookOpenIcon className="w-8 h-8 text-yellow-400" />
        <div>
            <span className="text-white text-xl font-bold">EnglishCourse Family</span>
            <p className="text-xs text-gray-400">English school</p>
        </div>
    </div>
);


const Sidebar: React.FC<SidebarProps> = ({ navItems, activeView, setActiveView, isOpen, setIsOpen }) => {
    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            ></div>
            <aside className={`fixed lg:relative inset-y-0 left-0 w-64 bg-gray-800 text-gray-300 flex flex-col p-4 z-40 transform lg:transform-none transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="mb-10">
                    <Logo />
                </div>
                <nav className="flex-1">
                    <ul>
                        {navItems.map((item) => (
                            <li key={item.name} className="mb-2">
                                <button
                                    onClick={() => {
                                        setActiveView(item.name);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center py-2.5 px-4 rounded-lg transition-colors duration-200 ${
                                        activeView === item.name
                                            ? 'bg-gray-700 text-white'
                                            : 'hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5 mr-3" />
                                    <span className="flex-1 text-left">{item.name}</span>
                                    {item.notification && (
                                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div>
                    <button 
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center py-2.5 px-4 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                    >
                        {/* FIX: The SVG path was corrupted. It has been replaced with a valid logout icon. */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

// FIX: Added a default export to resolve import errors in other components.
export default Sidebar;