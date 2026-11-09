-- Seed data for Phase 2
-- Seeds two distinct organizations with projects, analyses, files, edges, routes, explanations, file_roles, insights.

-- 1. Organizations
INSERT INTO organizations (id, name, slug)
VALUES
  ('org_3Lh6MZkjsgdO4J0O6XrdgobKFGz', 'My Organization', 'my-organization-1793893904761828632'),
  ('org_3Lh9IY24gx3nQXFalIoEugOgWQv', 'Acme Engineering', 'acme-engineering-1793895352734497229')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;

-- 2. Projects
INSERT INTO projects (id, organization_id, name, repository_url, default_branch)
VALUES
  -- Org 1 projects
  ('11111111-1111-4111-8111-111111111111', 'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz', 'react', 'https://github.com/facebook/react', 'main'),
  ('22222222-2222-4222-8222-222222222222', 'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz', 'next.js', 'https://github.com/vercel/next.js', 'canary'),
  ('33333333-3333-4333-8333-333333333333', 'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz', 'express', 'https://github.com/expressjs/express', 'master'),
  -- Org 2 projects
  ('44444444-4444-4444-8444-444444444444', 'org_3Lh9IY24gx3nQXFalIoEugOgWQv', 'tailwindcss', 'https://github.com/tailwindlabs/tailwindcss', 'main'),
  ('55555555-5555-4555-8555-555555555555', 'org_3Lh9IY24gx3nQXFalIoEugOgWQv', 'trpc', 'https://github.com/trpc/trpc', 'main')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  repository_url = EXCLUDED.repository_url;

-- 3. Analyses
INSERT INTO analyses (id, organization_id, project_id, repository_url, branch, commit_hash, status, error_message, summary, created_at)
VALUES
  -- Org 1 analyses
  (
    'a1111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    '11111111-1111-4111-8111-111111111111',
    'https://github.com/facebook/react',
    'main',
    'b284cf1',
    'completed',
    NULL,
    '{"files_count": 482, "edges_count": 1240, "framework": "React", "coverage_percentage": 94}'::jsonb,
    now() - interval '2 hours'
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    '22222222-2222-4222-8222-222222222222',
    'https://github.com/vercel/next.js',
    'canary',
    '7a91de0',
    'parsing',
    NULL,
    '{"files_count": 310, "edges_count": 890, "framework": "Next.js", "coverage_percentage": 62}'::jsonb,
    now() - interval '25 minutes'
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    '33333333-3333-4333-8333-333333333333',
    'https://github.com/expressjs/express',
    'master',
    '0e4f882',
    'failed',
    'Failed to resolve circular barrel dependencies in middleware chain',
    '{"files_count": 45, "edges_count": 32, "framework": "Express", "coverage_percentage": 18}'::jsonb,
    now() - interval '1 day'
  ),
  -- Org 2 analyses
  (
    'a4444444-4444-4444-8444-444444444444',
    'org_3Lh9IY24gx3nQXFalIoEugOgWQv',
    '44444444-4444-4444-8444-444444444444',
    'https://github.com/tailwindlabs/tailwindcss',
    'main',
    '5c8d19a',
    'completed',
    NULL,
    '{"files_count": 128, "edges_count": 412, "framework": "Tailwind", "coverage_percentage": 98}'::jsonb,
    now() - interval '4 hours'
  ),
  (
    'a5555555-5555-4555-8555-555555555555',
    'org_3Lh9IY24gx3nQXFalIoEugOgWQv',
    '55555555-5555-4555-8555-555555555555',
    'https://github.com/trpc/trpc',
    'main',
    'fa3920c',
    'pending',
    NULL,
    '{"files_count": 0, "edges_count": 0, "framework": "TypeScript", "coverage_percentage": 0}'::jsonb,
    now() - interval '8 minutes'
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  summary = EXCLUDED.summary,
  commit_hash = EXCLUDED.commit_hash;

-- 4. Files
INSERT INTO files (id, organization_id, analysis_id, path, folder, lines, content_hash)
VALUES
  (
    'f1111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'packages/react/src/React.js',
    'packages/react/src',
    184,
    'sha256:abc12345'
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'packages/react/src/ReactHooks.js',
    'packages/react/src',
    96,
    'sha256:def67890'
  ),
  (
    'f4444444-4444-4444-8444-444444444444',
    'org_3Lh9IY24gx3nQXFalIoEugOgWQv',
    'a4444444-4444-4444-8444-444444444444',
    'src/index.js',
    'src',
    240,
    'sha256:tailwind01'
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Edges
INSERT INTO edges (id, organization_id, analysis_id, source_path, target_path, source_file_id, target_file_id, type, raw_specifier)
VALUES
  (
    'e1111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'packages/react/src/React.js',
    'packages/react/src/ReactHooks.js',
    'f1111111-1111-4111-8111-111111111111',
    'f2222222-2222-4222-8222-222222222222',
    'import',
    './ReactHooks'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Routes
INSERT INTO routes (id, organization_id, analysis_id, file_id, path, method)
VALUES
  (
    '61111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a2222222-2222-4222-8222-222222222222',
    NULL,
    '/api/v1/health',
    'GET'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Explanations
INSERT INTO explanations (id, organization_id, analysis_id, file_id, folder_path, content_hash, explanation, prompt_version)
VALUES
  (
    '71111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'f1111111-1111-4111-8111-111111111111',
    NULL,
    'sha256:abc12345',
    'Primary entry point for React primitives and dispatchers.',
    'v1.0'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. File Roles
INSERT INTO file_roles (id, organization_id, analysis_id, file_id, role, confidence, source)
VALUES
  (
    '81111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'f1111111-1111-4111-8111-111111111111',
    'entry_point',
    1.0,
    'convention'
  )
ON CONFLICT (id) DO NOTHING;

-- 9. Insights
INSERT INTO insights (id, organization_id, analysis_id, title, description, kind, metadata)
VALUES
  (
    '91111111-1111-4111-8111-111111111111',
    'org_3Lh6MZkjsgdO4J0O6XrdgobKFGz',
    'a1111111-1111-4111-8111-111111111111',
    'Hub Module Detected',
    'ReactHooks is referenced by 42 separate internal packages.',
    'hub',
    '{"fan_in": 42}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
