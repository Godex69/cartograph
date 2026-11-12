import type { ParserFileNode } from '../parser/types';

export interface FileCategory {
  id: string;
  name: string;
  count: number;
  color: string;
}

/**
 * Standard palette for file kinds according to the 4-decision system:
 * greyscale UI surfaces with purposeful semantic accents for distinct kinds.
 */
const CATEGORY_DEFINITIONS: Array<{
  id: string;
  name: string;
  color: string;
  match: (file: ParserFileNode) => boolean;
}> = [
  {
    id: 'test',
    name: 'Tests & Specs',
    color: '#64748b', // Slate
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        p.includes('.test.') ||
        p.includes('.spec.') ||
        p.includes('/__tests__/') ||
        p.startsWith('test/') ||
        p.startsWith('tests/')
      );
    },
  },
  {
    id: 'config',
    name: 'Configuration',
    color: '#78716c', // Stone
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'config' ||
        p.includes('.config.') ||
        p.endsWith('rc.ts') ||
        p.endsWith('rc.js') ||
        p.includes('/config/')
      );
    },
  },
  {
    id: 'entry',
    name: 'Entry Points & Core',
    color: '#ec4899', // Pink / magenta
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'page' ||
        f.role === 'entry' ||
        (f.folder === '.' && (f.name.startsWith('index.') || f.name.startsWith('hono.'))) ||
        p === 'src/index.ts' ||
        p === 'index.ts'
      );
    },
  },
  {
    id: 'component',
    name: 'Components & UI',
    color: '#8b5cf6', // Violet
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'component' ||
        f.extension === '.tsx' ||
        f.extension === '.jsx' ||
        p.includes('/components/') ||
        p.startsWith('components/') ||
        p.includes('/jsx/') ||
        p.startsWith('jsx/')
      );
    },
  },
  {
    id: 'router',
    name: 'Routers & Routing',
    color: '#3b82f6', // Accent Blue
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'route' ||
        f.role === 'controller' ||
        p.includes('/router/') ||
        p.startsWith('router/') ||
        p.includes('/routes/') ||
        p.startsWith('routes/') ||
        p.includes('/api/') ||
        p.startsWith('api/')
      );
    },
  },
  {
    id: 'middleware',
    name: 'Middleware & Adapters',
    color: '#06b6d4', // Cyan
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        p.includes('/middleware/') ||
        p.startsWith('middleware/') ||
        p.includes('/adapter/') ||
        p.startsWith('adapter/')
      );
    },
  },
  {
    id: 'type',
    name: 'Types & Schemas',
    color: '#10b981', // Emerald
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'model' ||
        p.includes('type') ||
        p.includes('/validator/') ||
        p.startsWith('validator/') ||
        p.includes('/schema/') ||
        p.startsWith('schema/') ||
        f.extension === '.d.ts'
      );
    },
  },
  {
    id: 'util',
    name: 'Utils & Helpers',
    color: '#f59e0b', // Amber
    match: (f) => {
      const p = f.path.toLowerCase();
      return (
        f.role === 'util' ||
        f.role === 'helper' ||
        p.includes('/utils/') ||
        p.startsWith('utils/') ||
        p.includes('/helper/') ||
        p.startsWith('helper/') ||
        p.includes('/lib/') ||
        p.startsWith('lib/')
      );
    },
  },
];

const DEFAULT_CATEGORY: Omit<FileCategory, 'count'> = {
  id: 'module',
  name: 'Modules',
  color: '#94a3b8',
};

/**
 * Deterministically categorize files into a small set of semantic categories
 * with colour swatches and counts for the left rail.
 */
export function deriveFileCategories(files: ParserFileNode[]): FileCategory[] {
  const counts: Record<string, number> = {};

  for (const file of files) {
    let matchedId = DEFAULT_CATEGORY.id;
    for (const def of CATEGORY_DEFINITIONS) {
      if (def.match(file)) {
        matchedId = def.id;
        break;
      }
    }
    counts[matchedId] = (counts[matchedId] || 0) + 1;
  }

  const result: FileCategory[] = [];

  for (const def of CATEGORY_DEFINITIONS) {
    const count = counts[def.id] || 0;
    if (count > 0) {
      result.push({
        id: def.id,
        name: def.name,
        color: def.color,
        count,
      });
    }
  }

  const fallbackCount = counts[DEFAULT_CATEGORY.id] || 0;
  if (fallbackCount > 0) {
    result.push({
      id: DEFAULT_CATEGORY.id,
      name: DEFAULT_CATEGORY.name,
      color: DEFAULT_CATEGORY.color,
      count: fallbackCount,
    });
  }

  return result;
}

/**
 * Resolves the semantic category for a single file, indicating if it was
 * recognized by an established convention.
 */
export function getFileCategory(file: ParserFileNode): {
  id: string;
  name: string;
  color: string;
  isIdentified: boolean;
} {
  for (const def of CATEGORY_DEFINITIONS) {
    if (def.match(file)) {
      return { id: def.id, name: def.name, color: def.color, isIdentified: true };
    }
  }
  return {
    id: DEFAULT_CATEGORY.id,
    name: DEFAULT_CATEGORY.name,
    color: DEFAULT_CATEGORY.color,
    isIdentified: false,
  };
}

/**
 * Counts how many files no convention could identify.
 */
export function countUnidentifiedFiles(files: ParserFileNode[]): number {
  return files.filter((f) => !CATEGORY_DEFINITIONS.some((def) => def.match(f))).length;
}

/**
 * Returns the list of files that no convention could identify.
 */
export function getUnidentifiedFiles(files: ParserFileNode[]): ParserFileNode[] {
  return files.filter((f) => !CATEGORY_DEFINITIONS.some((def) => def.match(f)));
}

/**
 * Returns the breakdown of file kinds/categories within a folder.
 */
export function getFolderCategoryBreakdown(files: ParserFileNode[]): Array<{
  id: string;
  name: string;
  color: string;
  count: number;
}> {
  const counts = new Map<string, { id: string; name: string; color: string; count: number }>();
  for (const f of files) {
    const cat = getFileCategory(f);
    const existing = counts.get(cat.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(cat.id, { id: cat.id, name: cat.name, color: cat.color, count: 1 });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

/**
 * Pure framework detector based on convention files in the repository.
 */
export function detectFramework(files: ParserFileNode[]): string {
  const paths = files.map((f) => f.path.toLowerCase());

  if (
    paths.some(
      (p) =>
        p.includes('next.config') ||
        p.startsWith('app/') ||
        p.startsWith('pages/') ||
        p.includes('/app/') ||
        p.includes('/pages/'),
    )
  ) {
    return 'Next.js';
  }

  if (
    paths.some(
      (p) =>
        p === 'hono.ts' ||
        p.endsWith('/hono.ts') ||
        p.startsWith('hono/') ||
        p.includes('adapter/aws-lambda') ||
        p.includes('router/reg-exp-router'),
    )
  ) {
    return 'Hono';
  }

  if (paths.some((p) => p.includes('remix.config') || p.includes('root.tsx'))) {
    return 'Remix';
  }

  if (paths.some((p) => p.includes('astro.config'))) {
    return 'Astro';
  }

  if (paths.some((p) => p.includes('vite.config'))) {
    return 'Vite';
  }

  return 'None detected';
}
