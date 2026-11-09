-- Migration: 20261105000000_create_core_schema.sql
-- Description: Core 8 tables + organizations with cascading foreign keys and RLS policies

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 1: projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: analyses
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    commit_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, cloning, parsing, completed, failed
    error_message TEXT,
    summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 3: files
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    folder TEXT NOT NULL,
    lines INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: edges
CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    source_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    target_file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'import', -- import, dynamic_import, re_export
    raw_specifier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: routes
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 6: explanations
CREATE TABLE IF NOT EXISTS explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    folder_path TEXT,
    content_hash TEXT,
    explanation TEXT NOT NULL,
    prompt_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 7: file_roles
CREATE TABLE IF NOT EXISTS file_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    confidence NUMERIC NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'convention',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 8: insights
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Foreign Key Indexes
CREATE INDEX IF NOT EXISTS organizations_id_idx ON organizations (id);

CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON projects (organization_id);

CREATE INDEX IF NOT EXISTS analyses_organization_id_idx ON analyses (organization_id);
CREATE INDEX IF NOT EXISTS analyses_project_id_idx ON analyses (project_id);
CREATE INDEX IF NOT EXISTS analyses_status_idx ON analyses (status);

CREATE INDEX IF NOT EXISTS files_organization_id_idx ON files (organization_id);
CREATE INDEX IF NOT EXISTS files_analysis_id_idx ON files (analysis_id);
CREATE INDEX IF NOT EXISTS files_path_idx ON files (path);

CREATE INDEX IF NOT EXISTS edges_organization_id_idx ON edges (organization_id);
CREATE INDEX IF NOT EXISTS edges_analysis_id_idx ON edges (analysis_id);
CREATE INDEX IF NOT EXISTS edges_source_file_id_idx ON edges (source_file_id);
CREATE INDEX IF NOT EXISTS edges_target_file_id_idx ON edges (target_file_id);

CREATE INDEX IF NOT EXISTS routes_organization_id_idx ON routes (organization_id);
CREATE INDEX IF NOT EXISTS routes_analysis_id_idx ON routes (analysis_id);
CREATE INDEX IF NOT EXISTS routes_file_id_idx ON routes (file_id);

CREATE INDEX IF NOT EXISTS explanations_organization_id_idx ON explanations (organization_id);
CREATE INDEX IF NOT EXISTS explanations_analysis_id_idx ON explanations (analysis_id);
CREATE INDEX IF NOT EXISTS explanations_file_id_idx ON explanations (file_id);

CREATE INDEX IF NOT EXISTS file_roles_organization_id_idx ON file_roles (organization_id);
CREATE INDEX IF NOT EXISTS file_roles_analysis_id_idx ON file_roles (analysis_id);
CREATE INDEX IF NOT EXISTS file_roles_file_id_idx ON file_roles (file_id);

CREATE INDEX IF NOT EXISTS insights_organization_id_idx ON insights (organization_id);
CREATE INDEX IF NOT EXISTS insights_analysis_id_idx ON insights (analysis_id);

-- Enable Row Level Security (RLS) on all eight tables + organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Grant standard permissions to authenticated role (RLS strictly limits rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON edges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON explanations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON file_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON insights TO authenticated;

-- Policies reading the organization claim off the auth token
CREATE POLICY organizations_org_policy ON organizations
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = id);

CREATE POLICY projects_org_policy ON projects
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY analyses_org_policy ON analyses
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY files_org_policy ON files
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY edges_org_policy ON edges
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY routes_org_policy ON routes
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY explanations_org_policy ON explanations
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY file_roles_org_policy ON file_roles
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);

CREATE POLICY insights_org_policy ON insights
  FOR ALL
  TO authenticated
  USING ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id)
  WITH CHECK ((select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'organization_id')) = organization_id);
