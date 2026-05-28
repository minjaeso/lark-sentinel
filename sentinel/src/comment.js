const MARKER = '<!-- lark-sentinel:do-not-remove -->';

export async function upsertComment(octokit, repo, prNumber, body) {
  const fullBody = `${MARKER}\n${body}`;
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => (c.body || '').includes(MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: repo.owner,
      repo: repo.repo,
      comment_id: existing.id,
      body: fullBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: prNumber,
      body: fullBody,
    });
  }
}

const ICON = {
  success: '✅',
  failure: '❌',
  pending: '⏳',
  running: '⏳',
  cancelled: '⊘',
  unknown: '❓',
};

function smartTrim(text, max = 700) {
  if (!text || text.length <= max) return text || '';
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > max - 200) return cut.slice(0, lastStop + 1);
  return cut + '…';
}

function header(status) {
  switch (status) {
    case 'skipped':   return '## Lark Sentinel — skipped';
    case 'generating':return '## Lark Sentinel — generating workflows...';
    case 'running':   return '## Lark Sentinel — running workflows...';
    case 'done':      return '## Lark Sentinel';
    default:          return '## Lark Sentinel';
  }
}

function surfaceList(surface) {
  return surface
    .map((s) => `- \`${s.kind}\` **${s.label}** — touched by \`${s.source}\``)
    .join('\n');
}

function workflowList(workflows) {
  return workflows
    .map((w) => `- \`${w.id}\` — ${w.intent?.name || w.name}`)
    .join('\n');
}

function resultRow(r) {
  const status = r.execution.status || 'unknown';
  const icon = ICON[status] || ICON.unknown;
  const name = r.workflow.intent?.name || r.workflow.name;
  const repaired = r.repaired ? ' _(auto-repaired)_' : '';
  const video = (r.execution.artifacts || []).find((a) => a.type === 'video');
  const screenshot = (r.execution.artifacts || []).find((a) => a.type === 'screenshot');
  const script = (r.execution.artifacts || []).find((a) =>
    ['javascript', 'python', 'shellscript'].includes(a.type)
  );
  const links = [];
  if (video) links.push(`[▶ video](${video.url})`);
  if (screenshot) links.push(`[🖼 screenshot](${screenshot.url})`);
  if (script) links.push(`[🔁 repro](${script.url})`);
  const linkStr = links.length ? links.join(' · ') : '_(no artifacts)_';
  return `| ${icon} | **${name}**${repaired} | ${linkStr} |`;
}

function resultDetail(r) {
  const name = r.workflow.intent?.name || r.workflow.name;
  const icon = ICON[r.execution.status] || ICON.unknown;
  const summary = smartTrim(r.execution.summary);
  if (!summary) return '';
  const quoted = summary
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `**${icon} ${name}** — \`${r.workflow.id}\`\n${quoted}`;
}

export function renderComment(args) {
  const lines = [header(args.status)];
  lines.push('');

  if (args.status === 'skipped') {
    lines.push(args.reason || 'Nothing to test.');
    lines.push('');
    lines.push(`_Target: ${args.previewUrl}_`);
    return lines.join('\n');
  }

  if (args.status === 'generating') {
    lines.push(`Diff touches **${args.surface.length}** user-facing surface item(s). Generating up to ${args.maxWorkflows} workflows...`);
    lines.push('');
    lines.push('<details><summary>Surface area</summary>\n');
    lines.push(surfaceList(args.surface));
    lines.push('\n</details>');
    lines.push('');
    lines.push(`_Target: ${args.previewUrl}_`);
    return lines.join('\n');
  }

  if (args.status === 'running') {
    lines.push(`Running **${args.workflows.length}** generated workflows against the preview...`);
    lines.push('');
    lines.push(workflowList(args.workflows));
    lines.push('');
    lines.push(`_Target: ${args.previewUrl}_`);
    return lines.join('\n');
  }

  // done
  const total = args.results.length;
  const passed = args.results.filter((r) => r.execution.status === 'success').length;
  const failed = args.results.filter((r) => r.execution.status === 'failure').length;
  const badge = failed > 0 ? `**${failed} failing**, ${passed} passing` : `**all ${passed} passing**`;
  lines.push(`${badge} of ${total} generated workflow(s).`);
  lines.push('');
  lines.push('|   | Workflow | Artifacts |');
  lines.push('|:-:|---|---|');
  args.results.forEach((r) => lines.push(resultRow(r)));
  lines.push('');
  const details = args.results.map(resultDetail).filter(Boolean);
  if (details.length > 0) {
    lines.push('### Findings');
    lines.push('');
    lines.push(details.join('\n\n'));
    lines.push('');
  }
  if (args.linearLinks && args.linearLinks.length > 0) {
    lines.push('### Linear tickets filed');
    args.linearLinks.forEach((l) => lines.push(`- \`${l.workflowId}\` → ${l.url}`));
    lines.push('');
  }
  lines.push(`_Target: ${args.previewUrl} · generated by [Lark Sentinel](https://github.com/minjaeso/lark-sentinel)_`);
  return lines.join('\n');
}
