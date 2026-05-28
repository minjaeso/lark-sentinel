// File a Linear issue for a real (post-repair) Lark failure.
// Uses Linear's GraphQL API. Auth header: just the API key, no "Bearer".

const LINEAR_URL = 'https://api.linear.app/graphql';

const MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url title }
  }
}`;

export async function fileLinearIssue({
  apiKey,
  teamId,
  workflow,
  execution,
  prNumber,
  prUrl,
  repoFullName,
}) {
  const video = (execution.artifacts || []).find((a) => a.type === 'video');
  const screenshot = (execution.artifacts || []).find((a) => a.type === 'screenshot');
  const script = (execution.artifacts || []).find((a) =>
    ['javascript', 'python', 'shellscript'].includes(a.type)
  );

  const title = `[Lark Sentinel] ${workflow.intent?.name || workflow.name} failed on PR #${prNumber}`;
  const description = [
    `**Repository:** ${repoFullName}`,
    `**PR:** ${prUrl}`,
    `**Lark workflow:** \`${workflow.id}\``,
    `**Lark execution:** \`${execution.id}\``,
    '',
    '### Intent',
    workflow.intent?.description || '(no description)',
    '',
    '### Summary from Lark',
    execution.summary || '(no summary)',
    '',
    '### Artifacts',
    video ? `- [Video](${video.url})` : null,
    screenshot ? `- [Screenshot](${screenshot.url})` : null,
    script ? `- [Reproduction script](${script.url})` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(LINEAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: MUTATION,
      variables: { input: { teamId, title, description } },
    }),
  });
  if (!res.ok) {
    throw new Error(`Linear HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Linear GraphQL: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data?.issueCreate?.success) {
    throw new Error(`Linear issue creation failed: ${JSON.stringify(json)}`);
  }
  return json.data.issueCreate.issue.url;
}
