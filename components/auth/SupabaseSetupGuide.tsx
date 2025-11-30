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

const finalAllInOneSql = `
-- EnglishCourse: ФИНАЛЬНЫЙ ЕДИНЫЙ СКРИПТ v14 -- ОБНОВЛЕННЫЙ С ФИНАЛЬНОЙ СИНХРОНИЗАЦИЕЙ
-- ВНИМАНИЕ: Этот скрипт сначала удалит старых тестовых пользователей, затем полностью пересоздаст структуру БД.

-- ЧАСТЬ 1: ПРИНУДИТЕЛЬНАЯ ОЧИСТКА
-- Этот блок удалит пользователей, чтобы избежать ошибок "duplicate key". Ошибки здесь можно игнорировать.
DELETE FROM auth.users WHERE email = 'vladislav15@gmail.com';
DELETE FROM auth.users WHERE email = 'oksana25@gmail.com';
DELETE FROM auth.users WHERE email = 'alexander23@gmail.com';

-- ЧАСТЬ 2: НАСТРОЙКА БАЗЫ ДАННЫХ

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
DROP FUNCTION IF EXISTS public.sync_all_profiles() CASCADE;
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

-- ШАГ 5: Настройка разрешений (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ОШИБКИ 500)
-- Даем права внутренним ролям Supabase и пользователям.
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

-- ЧАСТЬ 3: СОЗДАНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'vladislav15@gmail.com',
  crypt('password123', gen_salt('bf')), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name": "Vladislav Teacher", "role": "teacher", "avatar_url": "https://i.pravatar.cc/150?u=vladislav15"}'
);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'oksana25@gmail.com',
  crypt('password123', gen_salt('bf')), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name": "Oksana Student", "role": "student", "avatar_url": "https://i.pravatar.cc/150?u=oksana25"}'
);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'alexander23@gmail.com',
  crypt('password123', gen_salt('bf')), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name": "Alexander Student", "role": "student", "avatar_url": "https://i.pravatar.cc/150?u=alexander23"}'
);

-- ЧАСТЬ 4: ФИНАЛЬНАЯ СИНХРОНИЗАЦИЯ И ЗАВЕРШЕНИЕ
-- Эта функция принудительно создаст профили для всех пользователей из auth.users,
-- если по какой-то причине автоматический триггер не сработал.
-- Это должно гарантированно исправить ошибку "Database error querying schema".
CREATE OR REPLACE FUNCTION public.sync_all_profiles()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  user_record record;
BEGIN
  FOR user_record IN SELECT * FROM auth.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_record.id) THEN
      INSERT INTO public.profiles (id, name, role, avatar_url, email)
      VALUES (
        user_record.id,
        user_record.raw_user_meta_data->>'name',
        COALESCE((user_record.raw_user_meta_data->>'role')::public.user_role, 'student'),
        user_record.raw_user_meta_data->>'avatar_url',
        user_record.email
      );
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  RETURN 'Failsafe sync complete. Created ' || inserted_count || ' missing profiles.';
END;
$$;

-- Вызываем функцию для гарантии синхронизации
SELECT public.sync_all_profiles();

SELECT 'Supabase setup and user creation completed successfully! You can now log in (password: password123).';
`;


const SupabaseSetupGuide: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">Supabase Setup Guide</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                    Follow these steps to configure your Supabase project correctly. An incorrect setup is the most common cause of errors.
                </p>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-2">Step 1: Set Environment Variables</h2>
                    <p className="mb-2">
                        First, your application needs to connect to your Supabase project. You must provide your Project URL and anon key.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 my-4 pl-4">
                        <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Supabase Dashboard</a> and select your project.</li>
                        <li>Navigate to <strong className="font-semibold">Project Settings</strong> (the gear icon).</li>
                        <li>Click on the <strong className="font-semibold">API</strong> tab.</li>
                        <li>Under <strong className="font-semibold">Project API keys</strong>, find your <strong className="font-semibold">URL</strong> and your <strong className="font-semibold">anon public key</strong>.</li>
                        <li>Create a new file named <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded text-sm">.env.local</code> in the root directory of this project.</li>
                        <li>Copy the following into the file and replace the placeholders with your actual credentials:</li>
                    </ol>
                    <CodeBlock lang="sh">
{`VITE_SUPABASE_URL="YOUR_PROJECT_URL_HERE"
VITE_SUPABASE_ANON_KEY="YOUR_ANON_PUBLIC_KEY_HERE"`}
                    </CodeBlock>
                    <p className="mt-2 text-sm text-gray-500">
                        After creating this file, you <strong className="font-semibold">must restart the application</strong> or reload the page for the changes to take effect.
                    </p>
                </section>
                
                <section className="mb-8 p-4 border-2 border-green-400 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <h2 className="text-2xl font-semibold mb-2 text-green-800 dark:text-green-300">Step 2: Run the Final All-in-One Setup SQL</h2>
                    <p className="mb-2 text-green-700 dark:text-green-400">
                        This is the final step. This single script will completely clean and configure your database, including fixing the permission error you were seeing. It creates all tables, policies, and test users in one go.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 my-4 pl-4">
                         <li>Go to the <strong className="font-semibold">SQL Editor</strong> in your Supabase project dashboard.</li>
                         <li>Click <strong className="font-semibold">New query</strong>.</li>
                         <li>Copy the entire script below, paste it into the editor, and click <strong className="font-semibold">RUN</strong>.</li>
                    </ol>
                    <CodeBlock lang="sql">{finalAllInOneSql}</CodeBlock>
                </section>

                <div className="text-center mt-12">
                     <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition"
                    >
                        I've completed the setup, Reload App
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupabaseSetupGuide;