export type ProtectedGitEffect = 'deployment' | null;

type ShellWord = { value: string; dynamic: boolean };

const protectedBranches = new Set(['main', 'master', 'refs/heads/main', 'refs/heads/master']);
const dangerousPushOptions = new Set(['--force', '-f', '--force-with-lease', '--mirror', '--all', '--delete', '-d', '--prune']);
const safePushOptions = new Set(['-u', '--set-upstream', '--porcelain', '--dry-run', '--follow-tags', '--no-verify', '--quiet', '-q', '--verbose', '-v', '--progress', '--no-progress', '--atomic', '--signed', '--no-signed', '--recurse-submodules', '--no-recurse-submodules']);

function splitCommandSegments(command: string): string[] {
  const segments: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (quote) { if (character === quote) quote = null; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    const separatorLength = character === '\n' || character === '|' || character === ';' || character === '&'
      ? (command[index + 1] === character && (character === '|' || character === '&') ? 2 : 1)
      : 0;
    if (separatorLength) {
      segments.push(command.slice(start, index));
      start = index + separatorLength;
      index += separatorLength - 1;
    }
  }
  segments.push(command.slice(start));
  return segments;
}

function shellWords(segment: string): ShellWord[] {
  const words: ShellWord[] = [];
  let value = '';
  let dynamic = false;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  const finish = () => { if (value || dynamic) { words.push({ value, dynamic }); value = ''; dynamic = false; } };
  for (const character of segment) {
    if (escaped) { value += character; escaped = false; continue; }
    if (character === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (character === quote) { quote = null; continue; }
      if (quote === '"' && (character === '$' || character === '`')) dynamic = true;
      value += character;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (/\s/.test(character)) { finish(); continue; }
    if (character === '$' || character === '`') dynamic = true;
    value += character;
  }
  finish();
  return words;
}

function isGitExecutable(word: ShellWord) {
  return !word.dynamic && (word.value === 'git' || word.value.endsWith('/git'));
}

function skipGitGlobalOptions(words: ShellWord[], index: number): number | null {
  while (index < words.length) {
    const word = words[index];
    if (word.dynamic) return null;
    if (word.value === '-C' || word.value === '-c' || word.value === '--git-dir' || word.value === '--work-tree') {
      if (!words[index + 1] || words[index + 1].dynamic) return null;
      index += 2;
      continue;
    }
    if (word.value.startsWith('--git-dir=') || word.value.startsWith('--work-tree=') || /^-C.+/.test(word.value) || /^-c.+/.test(word.value)) {
      index += 1;
      continue;
    }
    if (word.value.startsWith('-')) return null;
    return index;
  }
  return null;
}

function isProtectedRef(ref: string) { return protectedBranches.has(ref.toLowerCase()); }

function pushIsProtected(arguments_: ShellWord[]): boolean {
  const operands: string[] = [];
  for (const argument of arguments_) {
    if (argument.dynamic) return true;
    const option = argument.value;
    if (dangerousPushOptions.has(option) || option.startsWith('--force-with-lease=') || option.startsWith('--force=')) return true;
    if (safePushOptions.has(option)) continue;
    if (option.startsWith('-')) return true;
    operands.push(option);
  }
  if (operands.length < 2) return true;
  const refspecs = operands.slice(1);
  if (refspecs[0] === 'tag') return refspecs.length !== 2;
  for (const refspec of refspecs) {
    if (refspec.startsWith('+') || refspec.startsWith(':')) return true;
    const colon = refspec.indexOf(':');
    const source = colon === -1 ? refspec : refspec.slice(0, colon);
    const destination = colon === -1 ? refspec : refspec.slice(colon + 1);
    if (!destination || isProtectedRef(destination)) return true;
    if (source === 'HEAD' && colon === -1) return true;
  }
  return false;
}

function branchIsProtected(arguments_: ShellWord[]): boolean {
  let deleting = false;
  for (const argument of arguments_) {
    if (argument.dynamic) return true;
    if (argument.value === '-d' || argument.value === '-D' || argument.value === '--delete') { deleting = true; continue; }
    if (argument.value.startsWith('--delete=')) return isProtectedRef(argument.value.slice('--delete='.length));
    if (deleting && isProtectedRef(argument.value)) return true;
  }
  return false;
}

function updateRefIsProtected(arguments_: ShellWord[]): boolean {
  if (arguments_.some((argument) => argument.dynamic)) return true;
  const deleteIndex = arguments_.findIndex((argument) => argument.value === '-d' || argument.value === '--delete');
  return deleteIndex !== -1 && isProtectedRef(arguments_[deleteIndex + 1]?.value ?? '');
}

function classifyGitSegment(segment: string): ProtectedGitEffect {
  const words = shellWords(segment);
  if (['sh', 'bash', 'dash', 'zsh', 'fish'].includes(words[0]?.value ?? '') && words.some((word) => word.value === '-c')) {
    return words.some((word) => /\bgit\s+(push|branch|update-ref)\b/i.test(word.value) || word.dynamic) ? 'deployment' : null;
  }
  const gitIndex = words.findIndex(isGitExecutable);
  if (gitIndex === -1) {
    const mutation = words[1]?.value;
    return words[0]?.dynamic && ['push', 'branch', 'update-ref'].includes(mutation) ? 'deployment' : null;
  }
  const subcommandIndex = skipGitGlobalOptions(words, gitIndex + 1);
  if (subcommandIndex === null) return 'deployment';
  const subcommand = words[subcommandIndex];
  if (!subcommand || subcommand.dynamic) return 'deployment';
  const arguments_ = words.slice(subcommandIndex + 1);
  if (subcommand.value === 'push') return pushIsProtected(arguments_) ? 'deployment' : null;
  if (subcommand.value === 'branch') return branchIsProtected(arguments_) ? 'deployment' : null;
  if (subcommand.value === 'update-ref') return updateRefIsProtected(arguments_) ? 'deployment' : null;
  return null;
}

/**
 * Classifies only Git forms that can be recognized by a small shell scanner.
 * It deliberately fails closed for dynamic Git mutations, but is not a shell sandbox.
 */
export function classifyProtectedGitCommand(command: string): ProtectedGitEffect {
  return splitCommandSegments(command).some((segment) => classifyGitSegment(segment) === 'deployment') ? 'deployment' : null;
}
