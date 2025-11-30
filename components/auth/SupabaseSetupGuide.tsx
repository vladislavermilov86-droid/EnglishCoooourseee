import React, { useState } from 'react';

const CodeBlock: React.FC<{ children: React.ReactNode; lang?: string }> = ({ children, lang }) => {
    const [copied, setCopied] = useState(false);
    const text = React.Children.toArray(children).join('');

    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="bg-gray-800 text-gray-200 rounded-lg p-4 my-4 relative font-mono text-sm">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 text-xs rounded"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre><code className={lang ? `language-${lang}` : ''}>{children}</code></pre>
        </div>
    );
};

const fullSetupSql_v25 = `
-- EnglishCourse: ПОЛНЫЙ СКРИПТ v25 -- СТРУКТУРА, ПРАВА, ПОЛЬЗОВАТЕЛИ И ХРАНИЛИЩЕ
-- ВНИМАНИЕ: Этот скрипт полностью пересоздаст структуру БД, хранилище и создаст 3-х пользователей.
-- Он предназначен для запуска на ЧИСТОЙ базе данных.

-- ШАГ 1: Полная очистка структуры
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_groups CASCADE;
DROP TABLE IF EXISTS public.round_progress CASCADE;
DROP TABLE IF EXISTS public.unit_tests CASCADE;
DROP TABLE IF EXISTS public.words CASCADE;
DROP TABLE IF EXISTS public.rounds CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.submit_test_answers(uuid, jsonb) CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- ШАГ 2: Создание типов и таблиц
CREATE TYPE public.user_role AS ENUM ('student', 'teacher');
CREATE TABLE public.profiles ( id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text, role public.user_role NOT NULL, avatar_url text, last_seen timestamp with time zone, email text );
CREATE TABLE public.units ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), title text NOT NULL, description text, icon text, unlocked boolean NOT NULL DEFAULT false, unit_number integer NOT NULL UNIQUE );
CREATE TABLE public.rounds ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), title text NOT NULL, unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE );
CREATE TABLE public.words ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), english text NOT NULL, russian text NOT NULL, transcription text, image_url text, round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE );
CREATE TABLE public.round_progress ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE, round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE, completed boolean NOT NULL DEFAULT false, history jsonb, attempts integer NOT NULL DEFAULT 0, UNIQUE(student_id, unit_id, round_id) );
CREATE TABLE public.unit_tests ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), unit_id uuid NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE, title text NOT NULL, status text NOT NULL DEFAULT 'inactive', joined_students uuid[], questions jsonb, results jsonb, start_time timestamp with time zone );
CREATE TABLE public.chat_groups ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), name text NOT NULL, members uuid[] NOT NULL, avatar_url text );
CREATE TABLE public.chat_messages ( id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp with time zone NOT NULL DEFAULT now(), chat_group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE, sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, content text NOT NULL, read_by jsonb DEFAULT '[]'::jsonb );

-- ШАГ 3: Создание триггера для новых пользователей
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, avatar_url, email)
  VALUES ( new.id, new.raw_user_meta_data->>'name', COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'), new.raw_user_meta_data->>'avatar_url', new.email );
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ШАГ 4: Создание вспомогательных функций
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RETURN (SELECT role::text FROM public.profiles WHERE id = user_id); END; $$;
CREATE OR REPLACE FUNCTION public.submit_test_answers(test_id uuid, student_result jsonb) RETURNS void LANGUAGE plpgsql AS $$ DECLARE current_results jsonb; BEGIN LOCK TABLE public.unit_tests IN ROW EXCLUSIVE MODE; SELECT results INTO current_results FROM public.unit_tests WHERE id = test_id; SELECT jsonb_agg(elem) INTO current_results FROM jsonb_array_elements(COALESCE(current_results, '[]'::jsonb)) AS elem WHERE (elem->>'studentId')::uuid <> (student_result->>'studentId')::uuid; UPDATE public.unit_tests SET results = COALESCE(current_results, '[]'::jsonb) || student_result WHERE id = test_id; END; $$;

-- ШАГ 5: Настройка разрешений
GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ШАГ 6: Включение RLS и создание политик
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Units are viewable by authenticated users." ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage units." ON public.units FOR ALL TO authenticated USING ((get_user_role(auth.uid())) = 'teacher');

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rounds are viewable by authenticated users." ON public.rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage rounds." ON public.rounds FOR ALL TO authenticated USING ((get_user_role(auth.uid())) = 'teacher');

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Words are viewable by authenticated users." ON public.words FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage words." ON public.words FOR ALL TO authenticated USING ((get_user_role(auth.uid())) = 'teacher');

ALTER TABLE public.round_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own progress." ON public.round_progress FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view all progress." ON public.round_progress FOR SELECT USING ((get_user_role(auth.uid())) = 'teacher');

ALTER TABLE public.unit_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tests are viewable by authenticated users." ON public.unit_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage tests." ON public.unit_tests FOR ALL TO authenticated USING ((get_user_role(auth.uid())) = 'teacher');

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access groups they are members of." ON public.chat_groups FOR ALL USING (members @> ARRAY[auth.uid()]);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access messages in their groups." ON public.chat_messages FOR ALL USING ((SELECT members @> ARRAY[auth.uid()] FROM public.chat_groups WHERE id = chat_group_id));

-- ШАГ 7: Настройка Realtime
ALTER TABLE public.round_progress REPLICA IDENTITY FULL;
ALTER TABLE public.words REPLICA IDENTITY FULL;
ALTER TABLE public.units REPLICA IDENTITY FULL;
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER TABLE public.unit_tests REPLICA IDENTITY FULL;
ALTER TABLE public.chat_groups REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- ШАГ 8: Создание пользователей (Ученики и Учитель)
-- Этот блок создает пользователей и их профили через триггер handle_new_user.
-- ВНИМАНИЕ: При повторном запуске скрипта этот блок вызовет ошибку, так как пользователи уже существуют.
-- Это нормальное поведение, просто проигнорируйте ошибку.

-- Создаем учителя
SELECT auth.admin_create_user(
  'vladislav15@gmail.com'::text,
  'vladislav15'::text,
  '{
    "name": "Vladislav",
    "role": "teacher",
    "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
  }'::jsonb,
  '{ "email_confirm": true }'::jsonb
);

-- Создаем ученика 1
SELECT auth.admin_create_user(
  'alexander23@gmail.com'::text,
  'alexander23'::text,
  '{
    "name": "Alexander",
    "role": "student",
    "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
  }'::jsonb,
  '{ "email_confirm": true }'::jsonb
);

-- Создаем ученика 2
SELECT auth.admin_create_user(
  'oksana25@gmail.com'::text,
  'oksana25'::text,
  '{
    "name": "Oksana",
    "role": "student",
    "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
  }'::jsonb,
  '{ "email_confirm": true }'::jsonb
);

-- ШАГ 9: Настройка Storage (Хранилища)
-- Создаем "bucket" (контейнер) для аватаров пользователей и групп
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
-- Создаем "bucket" для изображений слов
INSERT INTO storage.buckets (id, name, public) VALUES ('word_images', 'word_images', true) ON CONFLICT (id) DO NOTHING;

-- Настраиваем политики доступа для "avatars"
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
CREATE POLICY "Public read access for avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (auth.uid() = owner);

-- Настраиваем политики доступа для "word_images"
DROP POLICY IF EXISTS "Public read access for word images" ON storage.objects;
CREATE POLICY "Public read access for word images" ON storage.objects FOR SELECT USING (bucket_id = 'word_images');
DROP POLICY IF EXISTS "Teachers can manage word images" ON storage.objects;
CREATE POLICY "Teachers can manage word images" ON storage.objects
FOR ALL TO authenticated -- ALL covers INSERT, UPDATE, DELETE
USING (bucket_id = 'word_images' AND (SELECT get_user_role(auth.uid())) = 'teacher')
WITH CHECK (bucket_id = 'word_images' AND (SELECT get_user_role(auth.uid())) = 'teacher');


SELECT 'Supabase full setup script v25 completed successfully!';
`;


const SupabaseSetupGuide: React.FC = () => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const projectRef = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : 'YOUR_PROJECT_REF';

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            <div className="max-w-4xl mx-auto p-4 sm:p-8">
                <h1 className="text-4xl font-bold mb-2">Welcome to EnglishCourse Setup!</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                    Let's get your Supabase backend configured correctly.
                </p>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 space-y-8">
                    <div>
                        <h2 className="text-2xl font-semibold mb-3">Step 1: Set Environment Variables</h2>
                        <p className="mb-4">
                            First, you need to provide the application with your Supabase project URL and Anon Key.
                            These are used to connect to your database and authentication services.
                        </p>
                         <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                            <p className="font-semibold">Where to find your keys:</p>
                            <ol className="list-decimal list-inside mt-2 text-sm">
                                <li>Go to your Supabase project dashboard.</li>
                                <li>Navigate to <strong>Project Settings</strong> (the gear icon).</li>
                                <li>Click on the <strong>API</strong> tab.</li>
                                <li>You will find your <strong>Project URL</strong> and <strong>Project API Keys</strong> (use the `anon` `public` key).</li>
                            </ol>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-semibold mb-3">Step 2: Run the Database Setup SQL</h2>
                        <p className="mb-2">
                           This SQL script will set up all the necessary tables, relationships, storage, and security policies for the application to function correctly. It also pre-populates the database with a teacher and two student accounts for easy testing.
                        </p>
                        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
                            <p className="font-semibold text-red-700 dark:text-red-300">Important:</p>
                             <p className="text-sm">
                                This script is designed for a new or empty project. It will delete any existing tables with the same names. Please run this in your Supabase <strong>SQL Editor</strong>.
                            </p>
                             <p className="text-sm mt-2">
                                Your Project Reference ID is: <strong className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded">{projectRef}</strong>. Ensure you are running this script in the correct project.
                            </p>
                        </div>
                        
                        <p>1. Go to the <strong>SQL Editor</strong> in your Supabase dashboard.</p>
                        <p>2. Click <strong>+ New query</strong>.</p>
                        <p>3. Copy the entire script below and paste it into the query window.</p>
                        <p>4. Click <strong>RUN</strong>.</p>

                        <CodeBlock lang="sql">{fullSetupSql_v25.trim()}</CodeBlock>
                    </div>

                     <div>
                        <h2 className="text-2xl font-semibold mb-3">Step 3: Refresh the Application</h2>
                        <p>
                            Once the SQL script has finished successfully, simply reload this page. The application should now be fully functional.
                        </p>
                         <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600"
                         >
                            Reload Page
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupabaseSetupGuide;