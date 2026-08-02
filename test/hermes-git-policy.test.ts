import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProtectedGitCommand } from '../src/hermes-effect-policy.ts';

test('classifies protected Git operations conservatively', () => {
  const cases: Array<[string, 'deployment' | null]> = [
    ['git commit -m "document scanner policy"', null],
    ['git branch feature/remediation', null],
    ['git tag v1.2.3', null],
    ['git push origin feature/remediation', null],
    ['git push -u origin feature/remediation', null],
    ['git -C /repo push origin feature/remediation', null],
    ['git push origin tag v1.2.3', null],
    ['git push', 'deployment'],
    ['git push --mirror origin', 'deployment'],
    ['git push --all origin', 'deployment'],
    ['git push --prune origin feature/remediation', 'deployment'],
    ['git push --delete origin main', 'deployment'],
    ['git push origin :main', 'deployment'],
    ['git push origin +feature:main', 'deployment'],
    ['git push origin feature:refs/heads/main', 'deployment'],
    ['git push --force-with-lease origin feature', 'deployment'],
    ['git -C /repo push --force origin feature', 'deployment'],
    ['git branch -D main', 'deployment'],
    ['git branch --delete master', 'deployment'],
    ['git update-ref -d refs/heads/main', 'deployment'],
  ];

  for (const [command, expected] of cases) {
    assert.equal(classifyProtectedGitCommand(command), expected, command);
  }
});

test('guards shell-indirected Git mutations while allowing segmented safe commands', () => {
  assert.equal(classifyProtectedGitCommand('git status && git push origin feature/remediation'), null);
  assert.equal(classifyProtectedGitCommand('git status && git push --mirror origin'), 'deployment');
  assert.equal(classifyProtectedGitCommand('git status; git push origin feature/remediation'), null);
  assert.equal(classifyProtectedGitCommand('cmd=git; "$cmd" push --mirror origin'), 'deployment');
  assert.equal(classifyProtectedGitCommand("sh -c 'git push origin feature/remediation'"), 'deployment');
  assert.equal(classifyProtectedGitCommand('git push origin HEAD'), 'deployment');
  assert.equal(classifyProtectedGitCommand('git push origin HEAD:feature/remediation'), null);
});
