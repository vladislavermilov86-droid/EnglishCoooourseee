import React from 'react';
import { ChatMessage as MessageType, ChatGroup } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { XIcon } from '../icons/Icons';

interface ReadInfoModalProps {
    message: MessageType;
    chatGroup: ChatGroup;
    onClose: () => void;
}

const ReadInfoModal: React.FC<ReadInfoModalProps> = ({ message, chatGroup, onClose }) => {
    const { state } = useApp();
    const { users } = state;

    const formatReadTime = (isoString: string) => {
        return new Date(isoString).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // FIX: Use 'read_by' and 'id'
    const readByUsers = message.read_by
        .map(receipt => {
            const user = users.find(u => u.id === receipt.userId);
            return user ? { ...user, readAt: receipt.readAt } : null;
        })
        .filter(Boolean)
        // @ts-ignore
        .sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());

    const sender = users.find(u => u.id === message.sender_id);
    const unreadUsers = chatGroup.members
        .map(memberId => users.find(u => u.id === memberId))
        // @ts-ignore
        .filter(user => user && user.id !== sender?.id && !readByUsers.some(readUser => readUser.id === user.id));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Message Info</h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-400" /></button>
                </header>
                <div className="p-6 flex-1 overflow-y-auto">
                    {readByUsers.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Read by</h3>
                            <ul className="space-y-2">
                                {readByUsers.map(user => user && (
                                    <li key={user.id} className="flex items-center space-x-3">
                                        <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-xs text-gray-500">{formatReadTime(user.readAt)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {unreadUsers.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">Delivered to</h3>
                            <ul className="space-y-2">
                                {unreadUsers.map(user => user && (
                                    <li key={user.id} className="flex items-center space-x-3 opacity-70">
                                        <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-xs text-gray-500">Not read yet</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReadInfoModal;