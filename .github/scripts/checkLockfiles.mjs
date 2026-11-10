// Validates all tracked lockfiles with lockfile-lint: all dependencies have to be downloaded via HTTPS from the npm
// registry, with a complete integrity hash, and the downloaded package has to match the package name in the lockfile.
// The lockfiles are determined via git, so that new ones are checked automatically.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { getTrackedFilesWithName } from "./trackedFiles.mjs";

// Npm aliases that are allowed in the lockfiles, in the format `<alias>:<package name>`.
const allowedPackageNameAliases = [
    "@jest/react-is-18:react-is",
    "@jest/react-is-19:react-is",
    "string-width-cjs:string-width",
    "strip-ansi-cjs:strip-ansi",
    "wrap-ansi-cjs:wrap-ansi",
];

const lockfileLintBin = createRequire(import.meta.url).resolve(
    "lockfile-lint/bin/lockfile-lint.js",
);
const lockfiles = getTrackedFilesWithName("package-lock.json");

if (lockfiles.length === 0) {
    console.error("No lockfiles found.");
    process.exit(1);
}

let failed = false;

for (const lockfile of lockfiles) {
    try {
        execFileSync(
            process.execPath,
            [
                lockfileLintBin,
                "--path",
                lockfile,
                "--type",
                "npm",
                "--allowed-hosts",
                "npm",
                "--validate-https",
                "--validate-integrity-strict",
                "--validate-package-names",
                "--empty-hostname",
                "false",
                "--allowed-package-name-aliases",
                ...allowedPackageNameAliases,
                "--format",
                "plain",
            ],
            { stdio: "inherit" },
        );
    } catch {
        failed = true;
    }
}

if (failed) {
    console.error(
        "\nLockfile check failed. See CONTRIBUTING.md for how to handle npm aliases.",
    );
    process.exit(1);
}
