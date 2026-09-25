import type { ComponentProp, ComponentSourceFile, ComponentSummary } from './contracts';

/**
 * Generates the copy-paste prompt developers hand to Cursor, Copilot Chat or
 * ChatGPT. The prompt is deterministic (no timestamps or randomness) so it can
 * be snapshot-tested and diffed between versions.
 */
export interface AgentPromptInput {
  component: ComponentSummary;
  propsSchema: ReadonlyArray<ComponentProp>;
  dependencies: { npm: Record<string, string>; internal: string[] };
  files: ReadonlyArray<ComponentSourceFile>;
  /** Omit the source when the caller is not entitled to it. */
  includeSource?: boolean;
  /** Directory the component should be written to in the consumer project. */
  targetDirectory?: string;
}

/** The design tokens every generated component must consume rather than hardcode. */
const THEME_TOKENS = [
  '--background / --foreground (page surface and text)',
  '--card / --card-foreground (elevated surfaces)',
  '--primary / --primary-foreground (brand accent)',
  '--muted / --muted-foreground (secondary text, subtle fills)',
  '--accent / --accent-foreground (highlighted states)',
  '--success, --warning, --destructive (+ their -foreground and -subtle variants)',
  '--border, --input, --ring (hairlines and focus rings)',
  '--radius-sm | --radius-md | --radius-lg | --radius-xl (corner radii)'
] as const;

function fence(language: string, body: string): string {
  return ['```' + language, body, '```'].join('\n');
}

function languageFor(filePath: string): string {
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.ts')) return 'ts';
  return 'tsx';
}

/** Turns a props schema into a compact markdown table. */
export function renderPropsTable(propsSchema: ReadonlyArray<ComponentProp>): string {
  if (propsSchema.length === 0) return '_This component takes no props._';

  const rows = propsSchema.map((prop) => {
    const type = prop.type === 'enum' && prop.options ? prop.options.map((o) => `'${o}'`).join(' | ') : prop.type;
    const defaultValue = prop.default === undefined || prop.default === null ? '—' : `\`${String(prop.default)}\``;
    return `| \`${prop.name}\` | ${type} | ${prop.required ? 'yes' : 'no'} | ${defaultValue} |`;
  });

  return ['| Prop | Type | Required | Default |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/** Formats the npm install line, or an empty string when nothing is needed. */
export function renderDependencyCommand(npm: Record<string, string>): string {
  const entries = Object.entries(npm);
  if (entries.length === 0) return '';
  return `npm install ${entries.map(([name, range]) => `${name}@"${range}"`).join(' ')}`;
}

export function buildAgentPrompt(input: AgentPromptInput): string {
  const {
    component,
    propsSchema,
    dependencies,
    files,
    includeSource = true,
    targetDirectory = 'components/ui'
  } = input;

  const installLine = renderDependencyCommand(dependencies.npm);
  const sourceFiles = files.filter((file) => file.fileType === 'SOURCE');
  const fixtureFiles = files.filter((file) => file.fileType === 'PREVIEW_FIXTURE');

  const sections: string[] = [
    `# Task: add the \`${component.name}\` component to my project`,
    '',
    `Add the Tech Inject Design Library component **${component.name}** (\`${component.slug}\`, v${component.version}, ` +
      `category: ${component.category}, tier: ${component.tier}) to this codebase.`,
    '',
    component.description,
    '',
    '## 1. Where to put it',
    '',
    `- Write the source file(s) under \`${targetDirectory}/\`, keeping the relative paths listed below.`,
    '- Match the existing project conventions for imports, formatting and the `cn()` class-merging helper.',
    '- Do not rename exported symbols; other generated code may import them.',
    '',
    '## 2. Theme contract (important)',
    '',
    'This component belongs to a CRM design system driven by CSS variables. Style it **only** through those',
    'tokens and their Tailwind aliases (`bg-card`, `text-muted-foreground`, `border-border`, `rounded-lg`, …).',
    'Never hardcode hex colours, RGB values or arbitrary radii.',
    '',
    ...THEME_TOKENS.map((token) => `- \`${token}\``),
    '',
    'If the project has no such tokens yet, add them to the global stylesheet as HSL channel triples under',
    '`:root` (and a `.dark` override) before using the component.',
    '',
    '## 3. Props',
    '',
    renderPropsTable(propsSchema),
    '',
    '## 4. Dependencies',
    '',
    installLine.length > 0
      ? `Install the external packages first:\n\n${fence('bash', installLine)}`
      : 'No external npm packages are required.',
    dependencies.internal.length > 0
      ? `\nThis component also composes these design-library primitives — reuse the project's equivalents if they ` +
        `already exist, otherwise implement them with the same token contract: ${dependencies.internal
          .map((name) => `\`${name}\``)
          .join(', ')}.`
      : ''
  ];

  sections.push('', '## 5. Source');

  if (!includeSource) {
    sections.push(
      '',
      `> The source for this **${component.tier}** component was not included because the requesting account is not entitled to it.`,
      '> Upgrade to premium, then regenerate this prompt to embed the real implementation.'
    );
  } else if (sourceFiles.length === 0) {
    sections.push('', '_No source files were provided._');
  } else {
    for (const file of sourceFiles) {
      sections.push('', `### \`${file.filePath}\``, '', fence(languageFor(file.filePath), file.content));
    }
  }

  if (includeSource && fixtureFiles.length > 0) {
    sections.push('', '## 6. Usage example', '');
    for (const file of fixtureFiles) {
      sections.push(`### \`${file.filePath}\``, '', fence(languageFor(file.filePath), file.content), '');
    }
  }

  sections.push(
    '',
    `## ${includeSource && fixtureFiles.length > 0 ? '7' : '6'}. Verification steps`,
    '',
    '1. TypeScript compiles with no new errors (`tsc --noEmit`) and the lint task passes.',
    '2. Every colour, radius and shadow resolves to a design token — grep the new file for `#`, `rgb(` and',
    '   `[0-9]px` radii and replace any literal you find with the matching token.',
    '3. The component renders correctly in both light and dark mode (toggle the `dark` class on `<html>`).',
    '4. Interactive elements expose visible `focus-visible` rings and correct `disabled` styling.',
    '5. Required props are typed as required; optional props keep the defaults documented above.',
    '6. Report back with the files you created or changed and any token you had to add.'
  );

  // Collapse the blank lines that optional sections leave behind.
  return sections.join('\n').replace(/\n{3,}/gu, '\n\n').trim() + '\n';
}
