import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAgentPrompt, renderDependencyCommand, renderPropsTable } from './agent-prompt';
import { buildInstallCommand, componentSourcePayloadSchema } from './contracts';
import { assertSafeRelativePath, isSafeRelativePath, resolveSafeTargetPath, UnsafePathError } from './safe-path';

const component = {
  slug: 'crm-metric-card',
  name: 'CRM Metric Card',
  description: 'Displays key performance indicators with comparative deltas.',
  category: 'Data Display',
  tier: 'FREE' as const,
  version: '1.0.0',
  updatedAt: '2026-02-01T00:00:00.000Z'
};

const promptInput = {
  component,
  propsSchema: [
    { name: 'title', type: 'string' as const, required: true, default: 'Total Revenue' },
    { name: 'trend', type: 'enum' as const, required: false, options: ['up', 'down'] }
  ],
  dependencies: { npm: { 'lucide-react': '^0.300.0' }, internal: ['Card'] },
  files: [
    { filePath: 'components/data-metric.tsx', fileType: 'SOURCE' as const, content: 'export const A = 1;' },
    { filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE' as const, content: 'export default null;' }
  ]
};

describe('safe path handling', () => {
  const target = path.resolve('/tmp/project/components/ui');

  it.each([
    '../../etc/passwd',
    '../outside.tsx',
    '/etc/passwd',
    'C:/Windows/system32.tsx',
    '\\\\server\\share\\evil.tsx',
    '~/.ssh/authorized_keys',
    'nested/../../../escape.tsx',
    'bad\0name.tsx',
    'con.tsx',
    ''
  ])('rejects %j', (filePath) => {
    expect(() => assertSafeRelativePath(filePath)).toThrow(UnsafePathError);
    expect(isSafeRelativePath(filePath)).toBe(false);
    expect(() => resolveSafeTargetPath({ targetDirectory: target, filePath })).toThrow(UnsafePathError);
  });

  it.each(['data-metric.tsx', 'components/data-metric.tsx', 'nested/deep/file.ts', 'styles/tokens.css'])(
    'accepts %j and keeps it inside the target directory',
    (filePath) => {
      const resolved = resolveSafeTargetPath({ targetDirectory: target, filePath });
      expect(resolved.startsWith(target)).toBe(true);
      expect(path.relative(target, resolved)).toBe(path.normalize(filePath));
    }
  );

  it('does not allow the target directory itself to be the write target', () => {
    expect(() => resolveSafeTargetPath({ targetDirectory: target, filePath: '.' })).toThrow(UnsafePathError);
  });
});

describe('install command', () => {
  it('builds the free and premium variants', () => {
    expect(buildInstallCommand('crm-metric-card')).toBe('npx @tech-inject/cli add crm-metric-card');
    expect(buildInstallCommand('crm-metric-card', { premium: true })).toContain('--token <your-access-token>');
  });
});

describe('agent prompt generator', () => {
  it('includes the task, theme contract, props, dependencies, source and verification steps', () => {
    const prompt = buildAgentPrompt(promptInput);

    expect(prompt).toContain('# Task: add the `CRM Metric Card` component to my project');
    expect(prompt).toContain('--primary / --primary-foreground');
    expect(prompt).toContain('| `title` | string | yes | `Total Revenue` |');
    expect(prompt).toContain("| `trend` | 'up' | 'down' | no | — |");
    expect(prompt).toContain('npm install lucide-react@"^0.300.0"');
    expect(prompt).toContain('export const A = 1;');
    expect(prompt).toContain('## 7. Verification steps');
    expect(prompt).toContain('Report back with the files you created or changed');
  });

  it('omits source and explains why when the caller is not entitled', () => {
    const prompt = buildAgentPrompt({
      ...promptInput,
      component: { ...component, tier: 'PREMIUM' },
      includeSource: false
    });

    expect(prompt).not.toContain('export const A = 1;');
    expect(prompt).toContain('not entitled to it');
    expect(prompt).toContain('Upgrade to premium');
  });

  it('is deterministic', () => {
    expect(buildAgentPrompt(promptInput)).toBe(buildAgentPrompt(promptInput));
  });

  it('honours a custom target directory', () => {
    expect(buildAgentPrompt({ ...promptInput, targetDirectory: 'src/design-system' })).toContain(
      '`src/design-system/`'
    );
  });

  it('renders empty states for missing props and dependencies', () => {
    expect(renderPropsTable([])).toBe('_This component takes no props._');
    expect(renderDependencyCommand({})).toBe('');
  });
});

describe('componentSourcePayloadSchema', () => {
  it('validates a complete payload', () => {
    const payload = {
      component,
      propsSchema: promptInput.propsSchema,
      dependencies: promptInput.dependencies,
      files: promptInput.files,
      installCommand: buildInstallCommand(component.slug),
      agentPrompt: buildAgentPrompt(promptInput)
    };

    expect(componentSourcePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects a payload with no files', () => {
    const result = componentSourcePayloadSchema.safeParse({
      component,
      propsSchema: [],
      dependencies: { npm: {}, internal: [] },
      files: [],
      installCommand: 'x',
      agentPrompt: 'y'
    });
    expect(result.success).toBe(false);
  });
});
