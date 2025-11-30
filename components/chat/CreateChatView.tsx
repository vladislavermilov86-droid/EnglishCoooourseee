import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { ChatGroup, UserRole } from '../../types';
import { ChevronLeftIcon, CameraIcon, UserPlusIcon } from '../icons/Icons';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';


interface CreateChatViewProps {
    onBack: () => void;
    onChatCreated: (chatGroup: ChatGroup) => void;
}

const CreateChatView: React.FC<CreateChatViewProps> = ({ onBack, onChatCreated }) => {
    const { state } = useApp();
    const { users, loggedInUser } = state;
    
    const [groupName, setGroupName] = useState('');
    const [groupAvatarPreview, setGroupAvatarPreview] = useState('https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=150'); // Generic placeholder
    const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const students = users.filter(user => user.role.toLowerCase() === UserRole.Student);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setGroupAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (event) => setGroupAvatarPreview(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const toggleStudentSelection = (studentId: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleCreateChat = async () => {
        if (!groupName.trim()) {
            setError('Group name is required.');
            return;
        }
        if (selectedStudentIds.length === 0) {
            setError('Select at least one student.');
            return;
        }
        setError('');
        setIsCreating(true);

        if (!loggedInUser) {
            setError('You must be logged in to create a chat.');
            setIsCreating(false);
            return;
        }

        try {
            let finalAvatarUrl = groupAvatarPreview;
            if (groupAvatarFile) {
                // FIX: Use Supabase storage client
                const fileName = `${Date.now()}_${groupAvatarFile.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, groupAvatarFile);
                if (uploadError) throw uploadError;
                
                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                finalAvatarUrl = data.publicUrl;
            }

            // FIX: Use 'id' instead of '$id'
            const teacherId = loggedInUser.id;
            
            const allMemberIds = [...selectedStudentIds, teacherId];
            const validMemberIds = [...new Set(allMemberIds.filter(id => typeof id === 'string' && id.trim() !== ''))];
            
            if (validMemberIds.length < 2) {
                throw new Error("A chat must have at least two valid members (teacher and one student).");
            }
            
            const newGroupData = {
                name: groupName,
                avatar_url: finalAvatarUrl,
                // FIX: Send a native array
                members: validMemberIds,
            };
            
            // FIX: Use Supabase client to create document
            const { error: insertError } = await supabase.from('chat_groups').insert(newGroupData);
            if (insertError) throw insertError;
            
            // Real-time subscription will update the state, no 'onChatCreated' needed.
            onBack(); // Go back to the list view after creation.
        } catch (err: any) {
            console.error("Supabase insert error object:", err);
            const errorMessage = err.message || 'An unknown error occurred.';
            console.error("Failed to create chat group:", errorMessage);
            setError(`Failed to create chat group: ${errorMessage}. Check RLS policies.`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="p-3 border-b dark:border-gray-700 flex items-center space-x-4 flex-shrink-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Create New Chat</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-2">
                        <img src={groupAvatarPreview} alt="Group Avatar" className="w-24 h-24 rounded-full object-cover" />
                        <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition shadow-md">
                            <CameraIcon className="w-5 h-5" />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>
                    <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group Name"
                        className="text-xl font-bold text-center bg-transparent border-b-2 dark:border-gray-600 focus:outline-none focus:border-blue-500 dark:text-gray-100 w-full max-w-xs"
                    />
                </div>

                <div>
                    <h3 className="font-bold text-gray-600 dark:text-gray-400 text-sm tracking-wider uppercase mb-2">Select Students</h3>
                    <div className="space-y-2">
                        {students.map(student => (
                            <label key={student.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedStudentIds.includes(student.id)}
                                    onChange={() => toggleStudentSelection(student.id)}
                                    className="h-5 w-5 rounded text-blue-500 focus:ring-blue-500 border-gray-300 dark:bg-gray-600 dark:border-gray-500"
                                />
                                <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-semibold">{student.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <footer className="p-4 border-t dark:border-gray-700 flex-shrink-0">
                {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
                <button
                    onClick={handleCreateChat}
                    disabled={isCreating}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-800"
                >
                    {isCreating && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    <span>{isCreating ? 'Creating...' : 'Create Chat'}</span>
                    <UserPlusIcon className="w-6 h-6" />
                </button>
            </footer>
        </div>
    );
};

export default CreateChatView;