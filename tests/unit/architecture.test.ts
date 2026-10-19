import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SRC = resolve(import.meta.dir, '../../src');
const IMPORT = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;

type Layer = { kind: 'shared' } | { kind: 'feature'; name: string } | { kind: 'app' };
const layerOf = (file: string): Layer => {
  const [top, name] = relative(SRC, file).split('/');
  if (top === 'features') return { kind: 'feature', name };
  if (top === 'app') return { kind: 'app' };
  return { kind: 'shared' };
};
const resolveImport = (from: string, specifier: string): string | undefined => {
  if (specifier.startsWith('@/')) return join(SRC, specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(from), specifier);
  return undefined;
};
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

// Dependencies flow one way: shared (components, lib) -> features -> app.
const violation = (from: Layer, to: Layer): string | undefined => {
  if (from.kind === 'shared' && to.kind !== 'shared') return 'shared code imports a feature or app';
  if (from.kind === 'feature' && to.kind === 'app') return 'a feature imports the app layer';
  if (from.kind === 'feature' && to.kind === 'feature' && from.name !== to.name)
    return 'a feature imports another feature';
  return undefined;
};

test('source imports follow the shared -> features -> app direction', () => {
  const problems = sourceFiles(SRC).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(IMPORT)].flatMap(([, specifier]) => {
      const target = resolveImport(file, specifier);
      const reason = target && violation(layerOf(file), layerOf(target));
      return reason ? [`${relative(SRC, file)} -> ${specifier}: ${reason}`] : [];
    }),
  );
  expect(problems).toEqual([]);
});

test('the boundary check catches a cross-feature import', () => {
  expect(violation({ kind: 'feature', name: 'chat' }, { kind: 'feature', name: 'call' })).toBe(
    'a feature imports another feature',
  );
  expect(violation({ kind: 'shared' }, { kind: 'app' })).toBe(
    'shared code imports a feature or app',
  );
});
