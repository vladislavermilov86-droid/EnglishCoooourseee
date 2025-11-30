import React, { useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { XIcon, CameraIcon } from '../icons/Icons';
// FIX: Consolidate Appwrite imports into a single statement from the local module.
import { supabase } from '../../supabase';

const ProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state, dispatch } = useApp();
    const { loggedInUser } = state;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && loggedInUser) {
            try {
                // FIX: Use Supabase storage client
                if (loggedInUser.avatar_url) {
                    try {
                        const url = new URL(loggedInUser.avatar_url);
                        const pathParts = url.pathname.split('/');
                        const bucketNameIndex = pathParts.indexOf('avatars');
                         if (bucketNameIndex > -1) {
                            const oldFilePath = pathParts.slice(bucketNameIndex + 1).join('/');
                            await supabase.storage.from('avatars').remove([oldFilePath]);
                        }
                    } catch (e) {
                        console.warn("Could not delete old avatar file, it might not exist or permissions are insufficient:", e);
                    }
                }

                // 1. Upload file to Supabase Storage
                const fileName = `${loggedInUser.id}-${Date.now()}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                // 2. Get the public URL of the uploaded file
                const { data } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(fileName);
                const newAvatarUrl = data.publicUrl;

                // 3. Update the user's profile document with the new avatar URL
                await supabase
                    .from('profiles')
                    .update({ avatar_url: newAvatarUrl })
                    .eq('id', loggedInUser.id);
                
                // 4. Update local state
                dispatch({
                    type: 'UPDATE_AVATAR',
                    // FIX: Use 'id' for Supabase compatibility
                    payload: { userId: loggedInUser.id, newAvatarUrl }
                });

            } catch (error) {
                console.error("Failed to update avatar:", error);
                alert("Failed to update avatar. Please ensure the 'avatars' storage bucket exists and has the correct permissions.");
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    if (!loggedInUser) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h2 className="text-2xl font-bold text-center mb-6">Your Profile</h2>
                
                <div className="relative w-32 h-32 mx-auto mb-6">
                    <img src={loggedInUser.avatar_url} alt={loggedInUser.name} className="w-full h-full rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-md" />
                    <button 
                        onClick={handleUploadClick}
                        className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition shadow-md border-2 border-white dark:border-gray-800"
                        aria-label="Change profile picture"
                    >
                        <CameraIcon className="w-5 h-5" />
                    </button>
                    <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/gif"
                        className="hidden"
                    />
                </div>
                
                <p className="text-xl font-semibold text-center">{loggedInUser.name}</p>
                <p className="text-gray-500 dark:text-gray-400 text-center capitalize">{loggedInUser.role}</p>

            </div>
        </div>
    );
};

export default ProfileModal;