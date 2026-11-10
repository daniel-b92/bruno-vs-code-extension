// Fails if a dependency with an install script is added to one of the lockfiles, or if one of the own
// `package.json` files defines a script that npm runs automatically on `npm install` / `npm ci`.
// Install scripts run arbitrary code on every machine that installs the dependencies, so each one has to be
// allowed explicitly below after reviewing it.

import { readFileSync } from "node:fs";

const lockfiles = [
    "package-lock.json",
    "client/package-lock.json",
    "server/package-lock.json",
];
const packageJsonFiles = [
    "package.json",
    "client/package.json",
    "server/package.json",
    "tsPlugin/package.json",
];

const allowedPackagesWithInstallScripts = new Set([
    "@parcel/watcher",
    "unrs-resolver",
]);

const lifecycleScriptsRunOnInstall = [
    "preinstall",
    "install",
    "postinstall",
    "prepublish",
    "preprepare",
    "prepare",
    "postprepare",
];

const errors = [];

for (const lockfile of lockfiles) {
    const { packages } = JSON.parse(readFileSync(lockfile, "utf8"));

    for (const [path, entry] of Object.entries(packages ?? {})) {
        if (!entry.hasInstallScript) {
            continue;
        }

        const packageName =
            entry.name ?? path.slice(path.lastIndexOf("node_modules/") + 13);

        if (
            path === "" ||
            !allowedPackagesWithInstallScripts.has(packageName)
        ) {
            errors.push(
                `${lockfile}: '${path || "<root>"}' has an install script that is not allowed.`,
            );
        }
    }
}

for (const packageJsonFile of packageJsonFiles) {
    const { scripts } = JSON.parse(readFileSync(packageJsonFile, "utf8"));

    for (const script of lifecycleScriptsRunOnInstall) {
        if (scripts && script in scripts) {
            errors.push(
                `${packageJsonFile}: script '${script}' would be run automatically on install.`,
            );
        }
    }
}

if (errors.length > 0) {
    console.error(errors.join("\n"));
    console.error(
        "\nReview the install scripts. If they are fine, add the packages to the allowlist in .github/scripts/checkInstallScripts.mjs (see CONTRIBUTING.md).",
    );
    process.exit(1);
}

console.log("No unexpected install scripts found.");
