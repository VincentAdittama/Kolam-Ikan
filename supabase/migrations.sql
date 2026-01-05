-- Create tables for Kolam Ikan

-- 1. Streams
CREATE TABLE IF NOT EXISTS public.streams (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    color TEXT,
    pinned BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT,
    color TEXT,
    initials TEXT,
    bio TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 3. Entries
CREATE TABLE IF NOT EXISTS public.entries (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id TEXT NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    content JSONB NOT NULL,
    sequence_id INTEGER NOT NULL,
    version_head INTEGER DEFAULT 0,
    is_staged BOOLEAN DEFAULT FALSE,
    parent_context_ids JSONB DEFAULT '[]'::jsonb,
    ai_metadata JSONB,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 4. Pending Blocks
CREATE TABLE IF NOT EXISTS public.pending_blocks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id TEXT NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    bridge_key TEXT NOT NULL,
    staged_context_ids JSONB DEFAULT '[]'::jsonb,
    directive TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Streams
CREATE POLICY "Users can view their own streams" ON public.streams 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own streams" ON public.streams 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own streams" ON public.streams 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own streams" ON public.streams 
    FOR DELETE USING (auth.uid() = user_id);

-- Profiles
CREATE POLICY "Users can view their own profiles" ON public.profiles 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profiles" ON public.profiles 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profiles" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profiles" ON public.profiles 
    FOR DELETE USING (auth.uid() = user_id);

-- Entries
CREATE POLICY "Users can view their own entries" ON public.entries 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own entries" ON public.entries 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own entries" ON public.entries 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own entries" ON public.entries 
    FOR DELETE USING (auth.uid() = user_id);

-- Pending Blocks
CREATE POLICY "Users can view their own pending blocks" ON public.pending_blocks 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pending blocks" ON public.pending_blocks 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pending blocks" ON public.pending_blocks 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pending blocks" ON public.pending_blocks 
    FOR DELETE USING (auth.uid() = user_id);
