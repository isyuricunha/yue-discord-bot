module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
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
    [
      "@semantic-release/github",
      {
        successComment: false,
        failComment: false
      }
    ]
  ]
};
