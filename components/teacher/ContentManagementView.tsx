import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, Round, Word } from '../../types';
import { PlusCircleIcon, PencilIcon, CameraIcon, XIcon, ChevronDownIcon, LockClosedIcon, LockOpenIcon, TrashIcon } from '../icons/Icons';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';

// Word Edit Modal Component
const WordEditModal: React.FC<{
    wordData: { word: Word, unitId: string, roundId: string };
    onClose: () => void;
}> = ({ wordData, onClose }) => {
    const { dispatch } = useApp();
    const { word, unitId, roundId } = wordData;
    const [editedWord, setEditedWord] = useState<Word>(word);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditedWord({ ...editedWord, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                // FIX: Use 'image_url' instead of 'imageUrl'
                setEditedWord({ ...editedWord, image_url: event.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // FIX: Use 'image_url' instead of 'imageUrl'
            let finalImageUrl = editedWord.image_url;
            
            if (imageFile) {
                // FIX: Use 'word_images' bucket for course content and Supabase storage client
                 const fileName = `${Date.now()}_${imageFile.name}`;
                 const { error: uploadError } = await supabase.storage.from('word_images').upload(fileName, imageFile);
                 if (uploadError) throw uploadError;
                 
                 const { data } = supabase.storage.from('word_images').getPublicUrl(fileName);
                 
                 if (!data || !data.publicUrl) {
                     throw new Error("Could not get public URL for the uploaded image.");
                 }
                 finalImageUrl = data.publicUrl;

                if (word.image_url && word.image_url.includes('supabase.co/storage/v1/object/public/')) {
                    try {
                        const url = new URL(word.image_url);
                        const pathParts = url.pathname.split('/');
                        // Path is like /storage/v1/object/public/BUCKET/FILE
                        const publicIndex = pathParts.indexOf('public');
                        if (publicIndex > -1 && pathParts.length > publicIndex + 2) {
                            const oldBucket = pathParts[publicIndex + 1];
                            const oldFilePath = pathParts.slice(publicIndex + 2).join('/');
                            if (oldBucket && oldFilePath) {
                                await supabase.storage.from(oldBucket).remove([oldFilePath]);
                            }
                        }
                    } catch (err) {
                        console.warn("Could not parse or delete old image.", err);
                    }
                }
            }
            
            const payload = {
                english: editedWord.english,
                russian: editedWord.russian,
                transcription: editedWord.transcription,
                image_url: finalImageUrl,
            };

            // FIX: Use Supabase client to update document and select the result
            const { data: updatedDoc, error } = await supabase.from('words').update(payload).eq('id', word.id).select().single();
            if (error) throw error;


            const finalUpdatedWord: Word = {
                ...word,
                ...updatedDoc
            };

            dispatch({ 
                type: 'EDIT_WORD', 
                payload: { 
                    unitId, 
                    roundId, 
                    wordId: word.id, 
                    updatedWord: finalUpdatedWord
                } 
            });

            onClose();
        } catch (error: any) {
            console.error("Failed to update word:", error);
            let userMessage = "Could not save changes. Please try again.";
            if (error.message) {
                userMessage = `Failed to save changes: ${error.message}. Check storage permissions and RLS policies.`;
            }
            alert(userMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Edit Word</h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-400" /></button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="relative w-full h-48 mb-4 bg-white rounded-lg flex items-center justify-center">
                        <img src={editedWord.image_url} alt={editedWord.english} className="w-full h-full object-contain rounded-lg" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600">
                            <CameraIcon className="w-5 h-5" />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">English</label>
                        <input type="text" name="english" value={editedWord.english} onChange={handleChange} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Russian</label>
                        <input type="text" name="russian" value={editedWord.russian} onChange={handleChange} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Transcription</label>
                        <input type="text" name="transcription" value={editedWord.transcription} onChange={handleChange} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-wait flex items-center">
                            {isSaving && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const UnitCreateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state } = useApp();
    const [unitData, setUnitData] = useState({ title: '', description: '', icon: '🆕' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setUnitData({ ...unitData, [e.target.name]: e.target.value });
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
             const nextUnitNumber = (state.units.length > 0 ? Math.max(...state.units.map(u => u.unit_number)) : 0) + 1;
             // FIX: Use Supabase client to create document
             await supabase.from('units').insert({
                ...unitData,
                unlocked: false,
                unit_number: nextUnitNumber,
             });
            onClose();
        } catch (error) {
            console.error('Failed to create unit:', error);
            alert('Could not create unit. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Create New Unit</h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-400" /></button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Title (e.g., Unit 11: Transport)</label>
                        <input type="text" name="title" value={unitData.title} onChange={handleChange} required className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Description</label>
                         <textarea name="description" value={unitData.description} onChange={handleChange} required rows={3} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                     <div>
                        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Icon (Emoji)</label>
                        <input type="text" name="icon" value={unitData.icon} onChange={handleChange} required className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600">Create Unit</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ContentManagementView: React.FC = () => {
    const { state, dispatch } = useApp();
    const { units } = state;
    const [editingWordData, setEditingWordData] = useState<{ word: Word, unitId: string, roundId: string } | null>(null);
    const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false);

    const handleToggleUnitLock = async (unit: Unit) => {
        // Optimistic update for instant UI feedback
        const optimisticUnit = { ...unit, unlocked: !unit.unlocked };
        dispatch({ type: 'UPSERT_UNIT', payload: optimisticUnit });

        try {
            const { error } = await supabase.from('units').update({
                unlocked: !unit.unlocked,
            }).eq('id', unit.id);

            if (error) {
                // Revert on error
                dispatch({ type: 'UPSERT_UNIT', payload: unit });
                throw error;
            }
        } catch (error) {
            console.error('Failed to toggle unit lock:', error);
            alert('Failed to update unit status.');
        }
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (window.confirm('Are you sure you want to delete this unit and all its rounds and words? This action cannot be undone.')) {
            try {
                // FIX: Use Supabase client. ON DELETE CASCADE will handle related rounds and words.
                await supabase.from('units').delete().eq('id', unitId);
            } catch (error) {
                console.error('Failed to delete unit:', error);
                alert('Failed to delete unit.');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Content Management</h1>
                <button
                    onClick={() => setIsCreateUnitModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
                >
                    <PlusCircleIcon className="w-6 h-6" />
                    <span>Create New Unit</span>
                </button>
            </div>

            <div className="space-y-4">
                {units.map((unit) => (
                    <details key={unit.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <summary className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center space-x-4">
                                <span className="text-3xl">{unit.icon}</span>
                                <div>
                                    <h2 className="font-bold text-lg">{unit.title}</h2>
                                    <p className="text-sm text-gray-500">{unit.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={(e) => { e.preventDefault(); handleToggleUnitLock(unit); }}
                                    className={`p-2 rounded-full ${unit.unlocked ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    title={unit.unlocked ? 'Lock Unit' : 'Unlock Unit'}
                                >
                                    {unit.unlocked ? <LockOpenIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
                                </button>
                                <button
                                    // FIX: Use 'id' instead of '$id'
                                    onClick={(e) => { e.preventDefault(); handleDeleteUnit(unit.id); }}
                                    className="p-2 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                    title="Delete Unit"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <ChevronDownIcon className="w-6 h-6 transition-transform transform details-arrow" />
                            </div>
                        </summary>
                        <div className="p-4 border-t dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                            {unit.rounds?.map((round) => (
                                <details key={round.id} className="bg-white dark:bg-gray-700 rounded-lg">
                                    <summary className="p-3 font-semibold cursor-pointer flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-600/50">
                                        {round.title}
                                        <ChevronDownIcon className="w-5 h-5 transition-transform transform details-arrow" />
                                    </summary>
                                    <div className="p-3 border-t dark:border-gray-600">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase">
                                                <tr>
                                                    <th className="px-2 py-2">Image</th>
                                                    <th className="px-2 py-2">English</th>
                                                    <th className="px-2 py-2">Russian</th>
                                                    <th className="px-2 py-2">Transcription</th>
                                                    <th className="px-2 py-2 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {round.words?.map((word) => (
                                                    <tr key={word.id} className="border-b dark:border-gray-600 last:border-b-0">
                                                        <td className="p-2">
                                                            <img src={word.image_url} alt={word.english} className="w-12 h-12 object-contain rounded bg-white p-1" />
                                                        </td>
                                                        <td className="px-2 py-2 font-medium">{word.english}</td>
                                                        <td className="px-2 py-2">{word.russian}</td>
                                                        <td className="px-2 py-2 text-gray-500">{word.transcription}</td>
                                                        <td className="px-2 py-2 text-right">
                                                            <button
                                                                onClick={() => setEditingWordData({ word, unitId: unit.id, roundId: round.id })}
                                                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"
                                                            >
                                                                <PencilIcon className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </details>
                ))}
            </div>

            {editingWordData && (
                <WordEditModal
                    wordData={editingWordData}
                    onClose={() => setEditingWordData(null)}
                />
            )}
            
            {isCreateUnitModalOpen && (
                <UnitCreateModal onClose={() => setIsCreateUnitModalOpen(false)} />
            )}
            <style>{`.details-arrow { transition: transform 0.2s; } details[open] > summary .details-arrow { transform: rotate(180deg); }`}</style>
        </div>
    );
};

export default ContentManagementView;