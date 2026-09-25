import { Command } from 'commander';
import prompts from 'prompts';
import { UnsafePathError } from '@tech-inject/shared';
import { installComponent } from './installer';
import { DEFAULT_REGISTRY_URL, fetchComponentSource, RegistryError } from './registry-client';

/** Terminal colours, skipped when the output is not a TTY or NO_COLOR is set. */
const colour = (code: number, text: string): string =>
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined ? `\u001B[${String(code)}m${text}\u001B[0m` : text;

const bold = (text: string): string => colour(1, text);
const dim = (text: string): string => colour(2, text);
const green = (text: string): string => colour(32, text);
const yellow = (text: string): string => colour(33, text);
const red = (text: string): string => colour(31, text);

interface AddOptions {
  token?: string;
  dir: string;
  registry: string;
  force?: boolean;
  dryRun?: boolean;
  fixtures?: boolean;
  yes?: boolean;
}

async function runAdd(slug: string, options: AddOptions): Promise<void> {
  const token = options.token ?? process.env.TECH_INJECT_TOKEN;

  console.info(`\n${bold('Tech Inject')} ${dim('· fetching')} ${slug}`);

  let payload;
  try {
    payload = await fetchComponentSource({ slug, registryUrl: options.registry, token });
  } catch (error) {
    if (error instanceof RegistryError && error.status === 403 && !token && options.yes !== true) {
      // Premium component without credentials: offer an interactive token prompt.
      const answer = (await prompts({
        type: 'password',
        name: 'token',
        message: 'This component requires a premium access token. Paste it to continue (or press Enter to abort):'
      })) as { token?: string };

      if (answer.token === undefined || answer.token.trim().length === 0) throw error;
      payload = await fetchComponentSource({ slug, registryUrl: options.registry, token: answer.token.trim() });
    } else {
      throw error;
    }
  }

  const result = await installComponent({
    payload,
    targetDirectory: options.dir,
    force: options.force === true,
    dryRun: options.dryRun === true,
    includeFixtures: options.fixtures === true
  });

  console.info(
    `\n${bold(payload.component.name)} ${dim(`v${payload.component.version} · ${payload.component.tier}`)}`
  );
  console.info(dim(`→ ${result.targetDirectory}${options.dryRun === true ? ' (dry run)' : ''}\n`));

  for (const file of result.files) {
    const label =
      file.outcome === 'written'
        ? green('written ')
        : file.outcome === 'unchanged'
          ? dim('unchanged')
          : yellow('skipped ');
    console.info(`  ${label} ${file.filePath}`);
  }

  if (result.skipped.length > 0) {
    console.info(
      `\n${yellow('!')} ${String(result.skipped.length)} file(s) already existed and were left untouched. ` +
        `Re-run with ${bold('--force')} to overwrite them.`
    );
  }

  if (result.dependencyCommand) {
    console.info(`\n${bold('Missing dependencies')} — please run:\n\n  ${result.dependencyCommand}\n`);
  } else {
    console.info(`\n${dim('No external npm dependencies required.')}\n`);
  }

  if (result.internalDependencies.length > 0) {
    console.info(
      `${dim('Composes design-library primitives:')} ${result.internalDependencies.join(', ')}\n` +
        `${dim('Add them with:')} npx @tech-inject/cli add <their-slugs>\n`
    );
  }
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('tech-inject')
    .description('Add Tech Inject Design Library components to your project.')
    .version('0.1.0');

  program
    .command('add')
    .argument('<component-slug>', 'slug of a published component, e.g. crm-metric-card')
    .description('Fetch a component and write its source files into your project')
    .option('-t, --token <token>', 'access token for premium components (or TECH_INJECT_TOKEN)')
    .option('-d, --dir <directory>', 'target directory for the component files', 'components/ui')
    .option(
      '-r, --registry <url>',
      'catalogue base URL (or TECH_INJECT_REGISTRY_URL)',
      process.env.TECH_INJECT_REGISTRY_URL ?? DEFAULT_REGISTRY_URL
    )
    .option('-f, --force', 'overwrite files that already exist', false)
    .option('--dry-run', 'validate and report without writing files', false)
    .option('--fixtures', 'also write preview fixture files', false)
    .option('-y, --yes', 'never prompt interactively', false)
    .action(async (slug: string, options: AddOptions) => {
      await runAdd(slug, options);
    });

  return program;
}

/** Entry point. Maps known failures onto clean messages and a non-zero exit. */
export async function main(argv: readonly string[] = process.argv): Promise<void> {
  try {
    await buildProgram().parseAsync([...argv]);
  } catch (error) {
    if (error instanceof UnsafePathError) {
      console.error(`\n${red('✖ Unsafe path in component payload')}\n  ${error.message}\n`);
    } else if (error instanceof RegistryError) {
      console.error(`\n${red('✖')} ${error.message}\n`);
    } else {
      console.error(`\n${red('✖')} ${error instanceof Error ? error.message : String(error)}\n`);
    }
    process.exitCode = 1;
  }
}
