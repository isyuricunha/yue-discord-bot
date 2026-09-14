module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { breaking: true, release: "major" },
          { type: "breaking", release: "major" },
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "security", release: "patch" },
          { type: "revert", release: "patch" },
          { type: "chore", scope: "deps", release: "patch" },
          { type: "chore", scope: "dependencies", release: "patch" }
        ],
        parserOpts: {
          noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"]
        }
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "breaking", section: "Breaking Changes" },
            { type: "fix", section: "Bug Fixes" },
            { type: "perf", section: "Performance Improvements" },
            { type: "security", section: "Security Fixes" },
            { type: "deps", section: "Dependencies" },
            { type: "docs", section: "Documentation" },
            { type: "refactor", section: "Refactoring" },
            { type: "test", section: "Tests" },
            { type: "build", section: "Build System" },
            { type: "ci", section: "Continuous Integration" },
            { type: "chore", section: "Other Changes" }
          ]
        },
        writerOpts: {
          transform: (commit, context) => {
            const nextCommit = { ...commit };

            if (typeof nextCommit.hash === "string" && nextCommit.hash.length > 0) {
              nextCommit.shortHash = nextCommit.shortHash ?? nextCommit.hash.slice(0, 7);

              const repoUrl =
                context.repositoryUrl ??
                context.repoUrl ??
                context.repository ??
                context.repo;

              if (typeof repoUrl === "string" && repoUrl.length > 0) {
                let normalizedRepoUrl = repoUrl.replace(/\.git$/, "");

                const sshMatch = normalizedRepoUrl.match(/^git@github\.com:(.+)$/);
                if (sshMatch?.[1]) {
                  normalizedRepoUrl = `https://github.com/${sshMatch[1]}`;
                }

                if (!normalizedRepoUrl.startsWith("http://") && !normalizedRepoUrl.startsWith("https://")) {
                  normalizedRepoUrl = `https://${normalizedRepoUrl.replace(/^git:\/\//, "")}`;
                }

                nextCommit.commitUrl = `${normalizedRepoUrl}/commit/${nextCommit.hash}`;
              }
            }

            if (nextCommit.type === "chore" && ["deps", "dependencies"].includes(nextCommit.scope)) {
              nextCommit.type = "deps";
              nextCommit.scope = null;
            }

            return nextCommit;
          }
        }
      }
    ],
    // GitLab is the primary release origin since the CI migration to
    // .gitlab-ci.yml. In GitLab CI, semantic-release core pushes the v-tag to
    // the remote using the CI_JOB_TOKEN embedded in CI_REPOSITORY_URL (the
    // project setting "Allow Git push requests to the repository" is enabled
    // for this), and @semantic-release/gitlab publishes the GitLab release
    // with the same job token. CI_JOB_TOKEN is the only supported credential
    // here: GitLab.com Free has no project access tokens and no PAT is used.
    // @semantic-release/exec exports the release metadata as a dotenv file for
    // the downstream docker jobs. The GitHub publisher is kept for runs
    // outside GitLab CI (local dry-runs or a re-enabled GitHub workflow).
    ...(process.env.GITLAB_CI
      ? [
          [
            "@semantic-release/gitlab",
            {
              useJobToken: true,
              successComment: false,
              failComment: false
            }
          ],
          [
            "@semantic-release/exec",
            {
              publishCmd:
                'printf "RELEASE_PUBLISHED=true\\nRELEASE_TAG=v%s\\n" "${nextRelease.version}" > .gitlab-release.env'
            }
          ]
        ]
      : [
          [
            "@semantic-release/github",
            {
              successComment: false,
              failComment: false
            }
          ]
        ])
  ]
};
