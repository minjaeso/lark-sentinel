// Lark integration. CLI for write (create/invoke/repair/archive), REST for read.
//
// Auth: GETLARK_API_KEY env (set in index.js).
// REST base: https://api.getlark.ai
// REST header: X-API-Key

import { spawn } from 'node:child_process';

const API_BASE = process.env.GETLARK_API_BASE || 'https://api.getlark.ai';

function apiHeaders() {
  return {
    'X-API-Key': process.env.GETLARK_API_KEY,
    'Content-Type': 'application/json',
  };
}

function sh(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\nstderr: ${stderr}\nstdout: ${stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

// Pull a workflow ID out of either JSON stdout or human stdout.
function parseWorkflowId(stdout) {
  const trimmed = stdout.trim();
  try {
    const json = JSON.parse(trimmed);
    if (json.id) return { id: json.id, name: json.name || '' };
    if (json.workflow && json.workflow.id) return { id: json.workflow.id, name: json.workflow.name || '' };
  } catch {}
  const m = trimmed.match(/\b(wf_[A-Za-z0-9]+)\b/);
  if (m) return { id: m[1], name: '' };
  throw new Error(`Could not parse workflow id from CLI output:\n${stdout}`);
}

// Pull execution ids out of `workflows invoke --wait` output. Tolerates both JSON and human formats.
function parseInvocations(stdout, workflowIds) {
  const trimmed = stdout.trim();
  try {
    const json = JSON.parse(trimmed);
    const list = Array.isArray(json) ? json : json.executions || json.invocations || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((e) => ({
        workflowId: e.workflow_id || e.workflowId || e.workflow?.id,
        executionId: e.id || e.execution_id || e.executionId,
        status: e.status,
      }));
    }
  } catch {}
  // Human fallback: pair workflow IDs with execution IDs by appearance order.
  const execIds = [...trimmed.matchAll(/\b(exec_[A-Za-z0-9]+)\b/g)].map((m) => m[1]);
  const wfIds = workflowIds.length === execIds.length
    ? workflowIds
    : [...trimmed.matchAll(/\b(wf_[A-Za-z0-9]+)\b/g)].map((m) => m[1]);
  if (execIds.length === 0) {
    throw new Error(`Could not parse executions from CLI output:\n${stdout}`);
  }
  return execIds.map((executionId, i) => ({
    workflowId: wfIds[i] || workflowIds[i] || workflowIds[0],
    executionId,
    status: 'unknown',
  }));
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
  const { id, name: serverName } = parseWorkflowId(stdout);
  return { id, name: serverName || name };
}

export async function invokeWorkflowsAndWait(workflowIds, { timeoutSec = 600 } = {}) {
  const args = [
    'workflows', 'invoke',
    '--workflow-ids', ...workflowIds,
    '--wait',
    '--timeout', String(timeoutSec),
  ];
  const { stdout } = await sh('getlark', args);
  return parseInvocations(stdout, workflowIds);
}

export async function getExecution(workflowId, executionId) {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}/executions/${executionId}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GET execution ${executionId} failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  // Normalize: artifacts may live at body.artifacts or body.execution.artifacts.
  const exec = body.execution || body;
  return {
    id: exec.id || executionId,
    workflowId: exec.workflow_id || workflowId,
    status: exec.status,
    summary: exec.summary || exec.result_summary || '',
    startedAt: exec.started_at || exec.startedAt,
    completedAt: exec.completed_at || exec.completedAt,
    artifacts: (exec.artifacts || []).map((a) => ({
      type: a.artifact_type || a.type,
      filename: a.filename,
      url: a.presigned_url || a.url,
      expiresAt: a.presigned_url_expires_at,
    })),
  };
}

export async function triggerRepairAndWait(workflowId, { timeoutSec = 600 } = {}) {
  const args = [
    'workflows', 'repairs', 'trigger',
    workflowId,
    '--wait',
    '--timeout', String(timeoutSec),
  ];
  await sh('getlark', args);
}

export async function archiveWorkflow(workflowId) {
  await sh('getlark', ['workflows', 'archive', workflowId]);
}
