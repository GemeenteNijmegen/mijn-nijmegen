exports.addMergeJob = function(project) {
  const mergeJob = {
    runsOn: 'ubuntu-latest',
    permissions: {
      pullRequests: 'write',
      contents: 'write',
    },
    if: "github.event.workflow_run.conclusion == 'success' && contains(github.event.pull_request.labels.*.name, 'auto-merge')",
    steps: [
      {
        run: 'gh pr merge --auto --merge "$PR_URL"',
        env: {
          PR_URL: '${{github.event.pull_request.html_url}}',
          GITHUB_TOKEN: '${{secrets.GITHUB_TOKEN}}',
        },
      },
    ],
  };

  const workflow = project.github.addWorkflow('auto-merge');
  workflow.on({
    workflowRun: {
      workflows: ['build'],
      types: ['completed'],
    }
  });

  workflow.addJobs({ automerge: mergeJob });
}
