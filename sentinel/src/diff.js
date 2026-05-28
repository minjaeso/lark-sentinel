export async function getChangedFiles(octokit, repo, prNumber) {
  const files = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.pulls.listFiles({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber,
      per_page: 100,
      page,
    });
    files.push(
      ...data.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '',
      }))
    );
    if (data.length < 100) break;
    page += 1;
  }
  return files;
}
