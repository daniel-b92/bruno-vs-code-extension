import { exec } from "child_process";
import { Logger } from "@global_shared";

let loginShellPath: string | undefined;

export async function initializeBruCliPath(logger?: Logger): Promise<void> {
    loginShellPath = await resolveLoginShellPath(logger);
}

export function getSpawnEnv(): NodeJS.ProcessEnv {
    if (!loginShellPath) {
        return process.env;
    }
    return { ...process.env, PATH: loginShellPath };
}

function resolveLoginShellPath(logger?: Logger): Promise<string | undefined> {
    const isWindows = process.platform === "win32";

    if (isWindows) {
        // On Windows the PATH is inherited reliably; no resolution needed.
        return Promise.resolve(undefined);
    }

    // Use both -l (login) and -i (interactive) so the shell sources both
    // ~/.bash_profile / ~/.profile AND ~/.bashrc / ~/.zshrc, which is where
    // nvm/fnm inject their bin directories.
    const shell = process.env.SHELL ?? "/bin/bash";
    const command = `${shell} -l -i -c 'echo $PATH' 2>/dev/null`;

    logger?.debug(`Resolving login shell PATH with command: ${command}`);

    return new Promise((resolve) => {
        exec(command, (error, stdout) => {
            if (error || !stdout.trim()) {
                logger?.warn(
                    `Could not resolve login shell PATH (exit code ${error?.code ?? "none"}, stderr: ${error?.message ?? "none"}). Falling back to process PATH.`,
                );
                resolve(undefined);
                return;
            }
            const path = stdout.trim();
            logger?.info(`Resolved login shell PATH: ${path}`);
            resolve(path);
        });
    });
}
