import core from '@actions/core';
import github from '@actions/github';
import { getChangedFiles } from './diff.js';
import { mapToSurface } from './surface.js';
import { generateWorkflowDescriptions } from './generate.js';
import {
  createWorkflow,
  invokeWorkflowsAndWait,
  getExecution,
  triggerRepairAndWait,
  archiveWorkflow,
} from './lark.js';
import { upsertComment, renderComment } from './comment.js';
import { fileLinearIssue } from './linear.js';

async function run() {
  const githubToken = core.getInput('github-token', { required: true });
  const larkApiKey = core.getInput('lark-api-key', { required: true });
  const openaiApiKey = core.getInput('openai-api-key', { required: true });
  const previewUrl = core.getInput('preview-url', { required: true });
  const linearApiKey = core.getInput('linear-api-key');
  const linearTeamId = core.getInput('linear-team-id');
  const secretContext = core.getInput('secret-context');
  const maxWorkflows = parseInt(core.getInput('max-workflows') || '4', 10);
  const repairOnFlake = (core.getInput('repair-on-flake') || 'true') === 'true';

  process.env.GETLARK_API_KEY = larkApiKey;
  process.env.OPENAI_API_KEY = openaiApiKey;

  const octokit = github.getOctokit(githubToken);
  const ctx = github.context;
  if (!ctx.payload.pull_request) {
    core.info('Not a pull request event; exiting.');
    return;
  }
  const pr = ctx.payload.pull_request;
  const repo = ctx.repo;

  core.startGroup('1/6 Reading PR diff');
  const files = await getChangedFiles(octokit, repo, pr.number);
  core.info(`Changed files: ${files.length}`);
  files.forEach((f) => core.info(`  ${f.status}  ${f.filename}`));
  core.endGroup();

  core.startGroup('2/6 Mapping diff to user-facing surface area');
  const surface = mapToSurface(files);
  core.info(`Surface items: ${surface.length}`);
  surface.forEach((s) => core.info(`  [${s.kind}] ${s.label}  (from ${s.source})`));
  core.endGroup();

  if (surface.length === 0) {
    await upsertComment(
      octokit,
      repo,
      pr.number,
      renderComment({
        status: 'skipped',
        reason: 'No user-facing surface was touched by this diff (no routes, API endpoints, or shared components).',
        previewUrl,
      })
    );
    core.info('Nothing to test; commented and exiting.');
    return;
  }

  await upsertComment(
    octokit,
    repo,
    pr.number,
    renderComment({ status: 'generating', surface, previewUrl, maxWorkflows })
  );

  core.startGroup('3/6 Generating Lark workflow descriptions');
  const descriptions = await generateWorkflowDescriptions({
    surface,
    files,
    previewUrl,
    maxWorkflows,
    prTitle: pr.title,
    prBody: pr.body || '',
  });
  descriptions.forEach((d, i) =>
    core.info(`  ${i + 1}. [${d.name}] ${d.description.slice(0, 120)}`)
  );
  core.endGroup();

  core.startGroup('4/6 Creating workflows in Lark');
  const workflows = [];
  for (const desc of descriptions) {
    try {
      const wf = await createWorkflow({
        name: `sentinel-pr${pr.number}-${desc.name}`.slice(0, 80),
        description: `${desc.description}\n\nTarget URL: ${previewUrl}`,
        mode: 'ai_driven',
        secretContext,
      });
      core.info(`  created ${wf.id}  (${wf.name})`);
      workflows.push({ ...wf, intent: desc });
    } catch (err) {
      core.warning(`  failed to create workflow "${desc.name}": ${err.message}`);
    }
  }
  if (workflows.length === 0) {
    core.setFailed('Could not create any workflows in Lark.');
    return;
  }
  core.endGroup();

  await upsertComment(
    octokit,
    repo,
    pr.number,
    renderComment({ status: 'running', workflows, previewUrl })
  );

  core.startGroup('5/6 Invoking workflows in parallel');
  const invocations = await invokeWorkflowsAndWait(workflows.map((w) => w.id));
  core.endGroup();

  core.startGroup('6/6 Collecting results');
  const results = [];
  for (const inv of invocations) {
    let execution = await getExecution(inv.workflowId, inv.executionId);
    const workflow = workflows.find((w) => w.id === inv.workflowId);
    let repaired = false;
    if (execution.status === 'failure' && repairOnFlake) {
      core.info(`  ${inv.workflowId} failed; trying repair...`);
      try {
        const repairResult = await triggerRepairAndWait(inv.workflowId);
        if (repairResult && repairResult.skipped) {
          core.info(`  ${inv.workflowId} repair skipped: ${repairResult.reason}`);
        } else {
          const reInv = await invokeWorkflowsAndWait([inv.workflowId]);
          execution = await getExecution(reInv[0].workflowId, reInv[0].executionId);
          repaired = true;
          core.info(`  ${inv.workflowId} re-ran after repair: ${execution.status}`);
        }
      } catch (err) {
        core.warning(`  repair failed for ${inv.workflowId}: ${err.message}`);
      }
    }
    results.push({ workflow, execution, repaired });
  }
  core.endGroup();

  const failures = results.filter((r) => r.execution.status === 'failure');
  const linearLinks = [];
  if (failures.length > 0 && linearApiKey && linearTeamId) {
    core.startGroup('Filing Linear issues for failures');
    for (const f of failures) {
      try {
        const link = await fileLinearIssue({
          apiKey: linearApiKey,
          teamId: linearTeamId,
          workflow: f.workflow,
          execution: f.execution,
          prNumber: pr.number,
          prUrl: pr.html_url,
          repoFullName: `${repo.owner}/${repo.repo}`,
        });
        linearLinks.push({ workflowId: f.workflow.id, url: link });
        core.info(`  filed ${link} for ${f.workflow.id}`);
      } catch (err) {
        core.warning(`  Linear filing failed for ${f.workflow.id}: ${err.message}`);
      }
    }
    core.endGroup();
  }

  await upsertComment(
    octokit,
    repo,
    pr.number,
    renderComment({ status: 'done', results, previewUrl, linearLinks })
  );

  for (const w of workflows) {
    try {
      await archiveWorkflow(w.id);
    } catch {
      // best effort — ephemeral workflows shouldn't pile up but it's not fatal
    }
  }

  if (failures.length > 0) {
    core.setFailed(`${failures.length} of ${results.length} workflow(s) failed`);
  } else {
    core.info(`All ${results.length} workflow(s) passed.`);
  }
}

run().catch((err) => {
  core.setFailed(err.message || String(err));
  console.error(err);
});
