// Lark integration via the getlark CLI. CLI returns JSON by default, so we parse
// stdout directly. Auth: GETLARK_API_KEY env var (already in ~/.getlark/config.json
// for local CLI runs; set explicitly by the action at runtime).

import { spawn } from 'node:child_process';

function sh(cmd, args, { allowedExitCodes = [0] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (!allowedExitCodes.includes(code)) {
        reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\nstderr: ${stderr}\nstdout: ${stdout}`));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

function parseJson(stdout, what) {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    // Fallback: scan for known ID prefixes so we still get something useful.
    const m = trimmed.match(/\b(wflw_[A-Za-z0-9]+)\b/);
    if (m) return { id: m[1], _raw: trimmed };
    throw new Error(`Could not parse JSON for ${what}. Raw:\n${trimmed.slice(0, 500)}`);
  }
}

export async function createWorkflow({ name, description, mode = 'ai_driven', secretContext = '' }) {
  const args = [
    'workflows', 'create',
    '--name', name,
    '--description', description,
    '--mode', mode,
  ];
  if (secretContext) {
    args.push('--secret-contexts', secretContext);
  }
  const { stdout } = await sh('getlark', args);
  const json = parseJson(stdout, 'workflows create');
  return { id: json.id, name: json.name || name };
}

export async function getWorkflow(workflowId) {
  const { stdout } = await sh('getlark', ['workflows', 'get', workflowId]);
  return parseJson(stdout, 'workflows get');
}

export async function archiveWorkflow(workflowId) {
  await sh('getlark', ['workflows', 'archive', workflowId]);
}

// Invoke and block until all reach a terminal status. Returns [{workflowId, executionId, status}].
// NOTE: `getlark workflows invoke --wait` exits non-zero when any workflow fails, and prints
// human-readable progress to stderr (not JSON). We accept exit code 1 and parse stderr.
const INVOKE_LINE = /Workflow (wflw_\S+) executed with (\w+)\. Execution ID: (wflw_exec_\S+)/g;

export async function invokeWorkflowsAndWait(workflowIds, { timeoutSec = 600 } = {}) {
  const args = [
    'workflows', 'invoke',
    '--workflow-ids', ...workflowIds,
    '--wait',
    '--timeout', String(timeoutSec),
  ];
  const { stdout, stderr } = await sh('getlark', args, { allowedExitCodes: [0, 1] });
  const haystack = `${stderr}\n${stdout}`;

  // Try JSON shape first (in case the CLI gains JSON output later).
  const trimmed = stdout.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      const list = Array.isArray(json) ? json : json.executions || json.invocations || json.results || [];
      if (Array.isArray(list) && list.length > 0) {
        return list.map((e) => ({
          workflowId: e.workflow_id || e.workflowId || e.workflow?.id,
          executionId: e.id || e.execution_id || e.executionId,
          status: e.status || e.result_type,
        }));
      }
    } catch {}
  }

  // Parse human format on stderr.
  const results = [];
  let m;
  INVOKE_LINE.lastIndex = 0;
  while ((m = INVOKE_LINE.exec(haystack)) !== null) {
    results.push({ workflowId: m[1], status: m[2].toLowerCase(), executionId: m[3] });
  }
  if (results.length === 0) {
    throw new Error(
      `Could not extract executions from getlark output.\nstderr:\n${stderr.slice(0, 800)}\nstdout:\n${stdout.slice(0, 400)}`
    );
  }
  return results;
}

export async function getExecution(workflowId, executionId) {
  const { stdout } = await sh('getlark', [
    'workflows', 'executions', 'get', workflowId, executionId,
  ]);
  const exec = parseJson(stdout, 'executions get');
  const root = exec.execution || exec;
  return {
    id: root.id || executionId,
    workflowId: root.workflow_id || workflowId,
    status: root.status || root.result_type,
    summary: root.summary || root.result_summary || '',
    startedAt: root.started_at,
    completedAt: root.completed_at || root.stopped_at,
    artifacts: (root.artifacts || []).map((a) => ({
      type: a.artifact_type || a.type,
      filename: a.filename,
      url: a.presigned_url || a.url,
      expiresAt: a.presigned_url_expires_at,
    })),
  };
}

// Trigger a repair and poll the workflow record until `last_repair_stopped_at`
// transitions. Throws on timeout. Returns the final repair result_type.
export async function triggerRepairAndWait(workflowId, { timeoutSec = 600, pollMs = 5000 } = {}) {
  const before = await getWorkflow(workflowId);
  const baselineStoppedAt = before.last_repair_stopped_at || null;

  await sh('getlark', ['workflows', 'repairs', 'trigger', workflowId]);

  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const wf = await getWorkflow(workflowId);
    if (wf.last_repair_stopped_at && wf.last_repair_stopped_at !== baselineStoppedAt) {
      return wf.last_repair_result_type;
    }
  }
  throw new Error(`Repair did not complete within ${timeoutSec}s for ${workflowId}`);
}
