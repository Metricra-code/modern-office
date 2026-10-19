import { workspaceSchema } from './protocol';

export type OfficeMode = 'demo' | 'live';
export interface OfficeContext {
  workspace: string;
  mode: OfficeMode;
}

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

export const readOfficeContext = (search: string, defaultMode: OfficeMode): OfficeContext => {
  const params = new URLSearchParams(search);
  const workspace = workspaceSchema.safeParse(params.get('workspace'));
  const requested = params.get('mode');
  return {
    workspace: workspace.success ? workspace.data : `office-${crypto.randomUUID().slice(0, 8)}`,
    mode: requested === 'live' || requested === 'demo' ? requested : defaultMode,
  };
};

export const writeOfficeContext = ({ workspace, mode }: OfficeContext): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', workspace);
  url.searchParams.set('mode', mode);
  window.history.replaceState({}, '', url);
};
