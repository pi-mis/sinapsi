create extension if not exists vector with schema extensions;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default '',
  content text not null default '',
  enriched text,
  type text not null default 'idea',
  is_private boolean not null default false,
  is_demo boolean not null default false,
  pinned boolean not null default false,
  ai_status text not null default 'pending',
  embedding extensions.vector(768),
  weight real not null default 0.3,
  cluster_id int,
  pos_x real, pos_y real, pos_z real,
  open_count int not null default 0,
  last_opened_at timestamptz,
  event_date date,
  source_id uuid,
  fts tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || coalesce(enriched,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_idx on public.notes(user_id);
create index notes_fts_idx on public.notes using gin(fts);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "own notes" on public.notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  a uuid not null references public.notes(id) on delete cascade,
  b uuid not null references public.notes(id) on delete cascade,
  score real not null,
  kind text not null default 'semantic',
  components jsonb,
  explanation text,
  evidence jsonb,
  validated boolean,
  user_feedback smallint,
  created_at timestamptz not null default now(),
  unique (a, b)
);
create index edges_user_idx on public.edges(user_id);
grant select, insert, update, delete on public.edges to authenticated;
grant all on public.edges to service_role;
alter table public.edges enable row level security;
create policy "own edges" on public.edges for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  unique (user_id, name)
);
grant select, insert, update, delete on public.tags to authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;
create policy "own tags" on public.tags for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  source text not null default 'user',
  primary key (note_id, tag_id)
);
grant select, insert, update, delete on public.note_tags to authenticated;
grant all on public.note_tags to service_role;
alter table public.note_tags enable row level security;
create policy "own note_tags" on public.note_tags for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  kind text not null default 'concept',
  unique (user_id, kind, name)
);
grant select, insert, update, delete on public.entities to authenticated;
grant all on public.entities to service_role;
alter table public.entities enable row level security;
create policy "own entities" on public.entities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.note_entities (
  note_id uuid not null references public.notes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (note_id, entity_id)
);
grant select, insert, update, delete on public.note_entities to authenticated;
grant all on public.note_entities to service_role;
alter table public.note_entities enable row level security;
create policy "own note_entities" on public.note_entities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.clusters (
  user_id uuid not null default auth.uid(),
  cluster_id int not null,
  label text,
  summary text,
  hue real,
  member_count int not null default 0,
  primary key (user_id, cluster_id)
);
grant select, insert, update, delete on public.clusters to authenticated;
grant all on public.clusters to service_role;
alter table public.clusters enable row level security;
create policy "own clusters" on public.clusters for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.graph_settings (
  user_id uuid primary key default auth.uid(),
  w_sem real not null default 0.55,
  w_kw real not null default 0.2,
  w_ent real not null default 0.15,
  w_tmp real not null default 0.05,
  w_expl real not null default 0.05,
  cos_min real not null default 0.55,
  cos_max real not null default 0.9,
  threshold real not null default 0.35,
  top_k int not null default 6,
  max_degree int not null default 12,
  daily_ai_cap int not null default 200,
  quality text not null default 'auto',
  show_people boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.graph_settings to authenticated;
grant all on public.graph_settings to service_role;
alter table public.graph_settings enable row level security;
create policy "own settings" on public.graph_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null,
  note_id uuid references public.notes(id) on delete cascade,
  payload jsonb,
  status text not null default 'queued',
  attempts int not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index jobs_queue_idx on public.jobs(user_id, status, run_after);
grant select, insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "own jobs" on public.jobs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ai_usage (
  user_id uuid not null default auth.uid(),
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
grant select, insert, update, delete on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "own usage" on public.ai_usage for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null,
  uri text,
  folder text,
  extracted_text text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sources to authenticated;
grant all on public.sources to service_role;
alter table public.sources enable row level security;
create policy "own sources" on public.sources for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  full_name text not null,
  email text,
  company text,
  position text,
  url text,
  connected_on date,
  show_in_graph boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy "own contacts" on public.contacts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();

create or replace function public.match_notes(query_embedding extensions.vector(768), match_count int default 30, exclude_id uuid default null)
returns table (id uuid, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select n.id, 1 - (n.embedding <=> query_embedding) as similarity
  from public.notes n
  where n.user_id = auth.uid() and n.embedding is not null and (exclude_id is null or n.id <> exclude_id)
  order by n.embedding <=> query_embedding
  limit match_count
$$;