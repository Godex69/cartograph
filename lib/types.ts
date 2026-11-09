export type AnalysisStatus = 'pending' | 'cloning' | 'parsing' | 'completed' | 'failed';

export interface AnalysisSummary {
  files_count?: number;
  edges_count?: number;
  framework?: string;
  coverage_percentage?: number;
  [key: string]: unknown;
}

export interface Analysis {
  id: string;
  organization_id: string;
  project_id: string | null;
  repository_url: string;
  branch: string;
  commit_hash: string | null;
  status: AnalysisStatus;
  error_message: string | null;
  summary: AnalysisSummary | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
}
