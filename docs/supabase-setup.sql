-- ─────────────────────────────────────────────────────────────────────────────
-- AgentKit — Supabase Database Setup
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this in your Supabase project:
--   Dashboard → SQL Editor → paste and run
--
-- Prerequisites:
--   1. Create a free project at https://supabase.com
--   2. Enable the pgvector extension (Dashboard → Extensions → search "vector")
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector for semantic search
create extension if not exists vector with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Long-term memory
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists agent_memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  content     text not null,
  metadata    jsonb not null default '{}',
  tier        text not null default 'long_term',
  embedding   vector(768),         -- text-embedding-004 output dimension
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast user-scoped lookups
create index if not exists agent_memories_user_id_idx
  on agent_memories (user_id);

-- Index for vector similarity search
create index if not exists agent_memories_embedding_idx
  on agent_memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic recall function — finds memories similar to a query embedding
create or replace function match_memories(
  query_embedding  vector(768),
  match_user_id    text,
  match_count      int     default 5,
  match_threshold  float   default 0.7
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  tier        text,
  similarity  float,
  created_at  timestamptz
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    tier,
    1 - (embedding <=> query_embedding) as similarity,
    created_at
  from agent_memories
  where
    user_id = match_user_id
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agent_memories_updated_at
  before update on agent_memories
  for each row execute function update_updated_at();

-- Row Level Security — users can only see their own memories
alter table agent_memories enable row level security;

create policy "Users can manage their own memories"
  on agent_memories
  for all
  using (user_id = current_setting('app.user_id', true))
  with check (user_id = current_setting('app.user_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- Knowledge base (RAG)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists agent_knowledge (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,         -- text chunk
  source      text,                  -- filename, URL, or document title
  metadata    jsonb not null default '{}',
  embedding   vector(768),
  created_at  timestamptz not null default now()
);

create index if not exists agent_knowledge_embedding_idx
  on agent_knowledge using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic knowledge search function
create or replace function match_knowledge(
  query_embedding  vector(768),
  match_count      int   default 4,
  match_threshold  float default 0.65
)
returns table (
  id          uuid,
  content     text,
  source      text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    content,
    source,
    1 - (embedding <=> query_embedding) as similarity
  from agent_knowledge
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agent registry (for the public dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists registered_agents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  url          text not null unique,
  color        text default '#0F6E56',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Public read access for the dashboard
alter table registered_agents enable row level security;

create policy "Public read on registered_agents"
  on registered_agents for select
  using (is_active = true);

create policy "Service role can do anything"
  on registered_agents for all
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpful views
-- ─────────────────────────────────────────────────────────────────────────────

-- How many memories per user?
create or replace view memory_stats as
  select
    user_id,
    count(*) as memory_count,
    min(created_at) as first_memory,
    max(created_at) as latest_memory
  from agent_memories
  group by user_id;

-- Dashboard aggregate stats
create or replace view dashboard_stats as
  select
    (select count(*) from registered_agents where is_active) as total_agents,
    (select count(*) from agent_memories)                     as total_memories,
    (select count(distinct user_id) from agent_memories)      as total_users;
