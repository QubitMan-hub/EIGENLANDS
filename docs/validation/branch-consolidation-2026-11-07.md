# Branch consolidation — 2026-11-07

Baseline main: `ddd04e3`. User requested all outstanding branch work integrated and every other local/remote branch removed.

## Findings

All 19 unique branch tips were already represented by main. Eight were ancestors of main; eleven were the exact heads of merged squash PRs. For each squash PR, every path changed from its merge base to the branch tip was byte-identical to that path in the original squash commit. Each squash commit was verified as an ancestor of main. No missing code or assets were found.

The consolidation merge records the eleven original branch histories as parents while preserving the current main tree. This avoids replaying older implementations over current art and gameplay. Only this audit document changes repository content; existing application/build validation remains applicable. Validation consists of Git ancestry, exact blob comparisons, runtime tree identity and reachability checks.

## Branch inventory

| Branch                                      | Location      | Tip                                        | Evidence                               |
| ------------------------------------------- | ------------- | ------------------------------------------ | -------------------------------------- |
| `ccr-3d7267f2-lb0y4u`                       | remote        | `161d7d270fc125d228a5e013554cfd2270b221aa` | Ancestor of main                       |
| `claude/eloquent-turing-rzp90g`             | remote        | `113b27d87e7bb1a88238485c6d5ed7f36a6ce2f4` | Ancestor of main                       |
| `codex/cave-art-identity`                   | local, remote | `f83444fafbfc44473b37ec3094146e447112502a` | Squash PR #27; 28 changed paths match  |
| `codex/connected-world-biodiversity`        | remote        | `afff99968cc52f286bf6666814119cbd45619849` | Ancestor of main                       |
| `codex/gathering-combat-interiors`          | local, remote | `b7d674731b28f93b1d801e26ebd2e124a583d03d` | Squash PR #25; 30 changed paths match  |
| `codex/isometric-world-overhaul`            | local, remote | `b5703e58f347a0aad5a7f42b642f138d282a65fd` | Ancestor of main                       |
| `codex/runtime-performance`                 | local, remote | `6df6fd4de6ab1c098213ab7bb641824c53b82c55` | Squash PR #24; 68 changed paths match  |
| `codex/sculpted-guardian-ecology`           | local, remote | `266ac7c075cd88dba8643ef2bf52bd54d6611096` | Ancestor of main                       |
| `codex/undercroft-overhaul`                 | local, remote | `80463576536decbd0b10c67aff43cb0f427d46c2` | Squash PR #26; 45 changed paths match  |
| `feat/castles-frontier-cities`              | local, remote | `98e1805b779904ef7a3a767e8be29761fbb80e0e` | Squash PR #40; 47 changed paths match  |
| `feat/cave-infrastructure-and-browser-coop` | local, remote | `9d1ab6c1e63cc29ec38feab0a07384e5f95036b0` | Squash PR #28; 47 changed paths match  |
| `feat/cohesive-creature-art`                | local, remote | `1a8dd9479c2456d18e4b678d86c044d5eb18e565` | Squash PR #30; 502 changed paths match |
| `feat/gameplay-qa-character-finish`         | local         | `ddd04e3cf4f1c4c6413c928db54ac28f3f22cf24` | Ancestor of main                       |
| `feat/guild-adventures-settlements`         | local, remote | `9a8fc6ee2d499ae8e2a3a05142a3a38eb207b9eb` | Squash PR #43; 84 changed paths match  |
| `feat/guild-halls-expedition-ledger`        | local, remote | `aa77598e50b08958abeae87a720beb23727b6f1e` | Ancestor of main                       |
| `feat/homesteads-adventurer-guild`          | local, remote | `03a619c0caea5dd587d8da4e67e9281b60caa0c7` | Squash PR #42; 57 changed paths match  |
| `feat/kingdom-art`                          | local, remote | `1395e4e82b578750f613091bd9309fab0783f3cf` | Squash PR #39; 32 changed paths match  |
| `feat/render-free-multiplayer`              | local, remote | `37a50027c7f7b914e8fd3f07bbc85c8d9815de77` | Squash PR #29; 63 changed paths match  |
| `work`                                      | local         | `e20a0683306d11ab6031b8f518dfa3b94cb74472` | Ancestor of main                       |

## Recovery and cleanup

A complete, verified Git bundle and the pre-cleanup inventory are retained outside the repository at `/workspace/branch-backups/eigenlands-before-branch-cleanup.bundle` and `/workspace/branch-backups/branch-inventory.json`. Original branch commits are also retained in main ancestry after consolidation.

Main is pushed before branch deletion. Remote deletions use explicit expected-tip leases and an atomic push so a branch changed by another writer is not silently deleted. Local branches are deleted only after their tips are ancestors of main. Final checks require only `main` in local and remote branch inventories, a clean worktree, and every pre-cleanup commit reachable from main.
