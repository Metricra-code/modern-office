import { expect, test } from 'bun:test';
import { workspaceRoute } from '../../src/lib/routes';

test('office and engineering notes preserve only validated workspace and mode', () => {
  expect(workspaceRoute('notes', 'team-123', 'live')).toBe(
    '/case-study/?workspace=team-123&mode=live',
  );
  expect(workspaceRoute('office', 'team-123', 'demo')).toBe('/?workspace=team-123&mode=demo');
});

test('malformed or missing context falls back to fixed local routes', () => {
  for (const workspace of [null, '', 'x', '../office', 'https://example.com', 'a'.repeat(41)]) {
    expect(workspaceRoute('office', workspace, 'live')).toBe('/');
    expect(workspaceRoute('notes', workspace, 'live')).toBe('/case-study/');
  }
  for (const mode of [null, '', 'LIVE', 'javascript:alert(1)']) {
    expect(workspaceRoute('office', 'valid-workspace', mode)).toBe('/');
  }
});
