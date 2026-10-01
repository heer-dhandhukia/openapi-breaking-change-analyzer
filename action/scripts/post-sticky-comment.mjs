#!/usr/bin/env node
// Posts (or updates) the ONE sticky PR comment carrying the blast-radius report, using the
// `gh` CLI (preinstalled on GitHub-hosted runners) rather than a JS GitHub API client --
// see DECISIONS.md for why this action avoids adding @actions/github as a dependency.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { findStickyCommentId, withMarker } from "../src/stickyComment.mjs";

const BODY_TMP_PATH = "/tmp/blast-comment-body.md";

const mdPath = process.argv[2];
if (!mdPath) {
  console.error("Usage: post-sticky-comment.mjs <path-to-report.md>");
  process.exit(1);
}

const repo = process.env.GH_REPO;
const prNumber = process.env.PR_NUMBER;
if (!repo || !prNumber) {
  console.error("GH_REPO and PR_NUMBER environment variables are required");
  process.exit(1);
}

const body = withMarker(readFileSync(mdPath, "utf8"));
// Written to a file and referenced via `-F field=@file` rather than passed as a `-f`
// argument directly: an inline arg risks OS argv-length limits on a large report and needs
// no shell-escaping this way either.
writeFileSync(BODY_TMP_PATH, body);

const commentsJson = execFileSync("gh", ["api", `repos/${repo}/issues/${prNumber}/comments`, "--paginate"], { encoding: "utf8" });
const comments = JSON.parse(commentsJson);
const existingId = findStickyCommentId(comments);

if (existingId) {
  console.log(`Updating existing sticky comment #${existingId}`);
  execFileSync("gh", ["api", "-X", "PATCH", `repos/${repo}/issues/comments/${existingId}`, "-F", `body=@${BODY_TMP_PATH}`], { stdio: "inherit" });
} else {
  console.log("Creating the sticky comment");
  execFileSync("gh", ["api", "-X", "POST", `repos/${repo}/issues/${prNumber}/comments`, "-F", `body=@${BODY_TMP_PATH}`], { stdio: "inherit" });
}
