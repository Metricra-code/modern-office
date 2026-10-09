import { workspaceSchema } from './protocol';

export const workspaceRoute = (
  page: 'office' | 'notes',
  workspace: string | null,
  mode: string | null,
): string => {
  const path = page === 'notes' ? '/case-study/' : '/';
  const parsed = workspaceSchema.safeParse(workspace);
  if (!parsed.success || (mode !== 'demo' && mode !== 'live')) return path;
  return `${path}?${new URLSearchParams({ workspace: parsed.data, mode })}`;
};
