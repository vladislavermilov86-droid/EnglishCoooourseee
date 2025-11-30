import React, { useState, useEffect } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import CreateChatView from './CreateChatView';
import { ChatGroup } from '../../types';
import { useApp } from '../../contexts/AppContext';

interface ChatMainProps {
    onClose: () => void;
}

const ChatMain: React.FC<ChatMainProps> = ({ onClose }) => {
    const [view, setView] = useState<'list' | 'window' | 'create'>('list');
    const [activeChat, setActiveChat] = useState<ChatGroup | null>(null);
    const { state } = useApp();

    useEffect(() => {
        if (activeChat) {
            // FIX: Use 'id' instead of '$id' for Supabase compatibility
            const updatedChat = state.chatGroups.find(g => g.id === activeChat.id);
            if (!updatedChat) {
                setActiveChat(null);
                setView('list');
            } else {
                setActiveChat(updatedChat);
            }
        }
    }, [state.chatGroups, activeChat]);

    const handleSelectChat = (chatGroup: ChatGroup) => {
        setActiveChat(chatGroup);
        setView('window');
    };
    
    const handleBackToList = () => {
        setActiveChat(null);
        setView('list');
    };

    const handleChatCreated = (chatGroup: ChatGroup) => {
        setActiveChat(chatGroup);
        setView('window');
    };

    const renderContent = () => {
        switch(view) {
            case 'create':
                return <CreateChatView onBack={handleBackToList} onChatCreated={handleChatCreated} />;
            case 'window':
                if (activeChat) {
                    return <ChatWindow chatGroup={activeChat} onBack={handleBackToList} />;
                }
                return <ChatList onSelectChat={handleSelectChat} onClose={onClose} onCreateChat={() => setView('create')} />;
            case 'list':
            default:
                return <ChatList onSelectChat={handleSelectChat} onClose={onClose} onCreateChat={() => setView('create')} />;
        }
    };

    return (
        <div className="h-full bg-white dark:bg-gray-800 z-50 flex flex-col border-l dark:border-gray-700 shadow-2xl">
            {renderContent()}
        </div>
    );
};

export default ChatMain;