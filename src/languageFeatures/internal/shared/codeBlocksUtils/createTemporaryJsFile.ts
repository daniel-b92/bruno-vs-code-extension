import { writeFileSync } from "fs";
import {
    parseBruFile,
    TextDocumentHelper,
    RequestFileBlockName,
} from "../../../../shared";
import { getTemporaryJsFileName } from "./getTemporaryJsFileName";
import { mapBlockNameToJsFileLine } from "./mapBlockNameToJsFileFunctionName";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";

export function createTemporaryJsFile(
    collectionRootDirectory: string,
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    bruFileName: string,
    bruFileContent: string
) {
    const { blocks: parsedBlocks } = parseBruFile(
        new TextDocumentHelper(bruFileContent)
    );
    const blocksWithJsCode = parsedBlocks.filter(({ name }) =>
        (
            [
                RequestFileBlockName.PreRequestScript,
                RequestFileBlockName.PostResponseScript,
                RequestFileBlockName.Tests,
            ] as string[]
        ).includes(name)
    );
    const result: string[] = [];

    for (const { name, content } of blocksWithJsCode) {
        result.push(
            `${mapBlockNameToJsFileLine(name as RequestFileBlockName)}
${content}}`
        );
    }

    const fileName = getTemporaryJsFileName(
        collectionRootDirectory,
        bruFileName
    );

    writeFileSync(
        fileName,
        [getDefinitionsForInbuiltLibraries()].concat(result).join("\n\n")
    );
    tempJsFilesRegistry.registerJsFile(fileName);
}

/** The Bru class is globally available in Bruno but not exposed.
* There are also no types for it.
* This is a temporary workaround to get stop typescript from complaining and get intellisense.

* Official javascript API reference:
* https://docs.usebruno.com/testing/script/javascript-reference*/
function getDefinitionsForInbuiltLibraries() {
    return `/**
 * Object with common utility function for Bruno.
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference#bru} Documentation
 * @see {@link https://github.com/Its-treason/bruno/blob/lazer/packages/bruno-core/src/request/runtime/dataObject/Bru.ts} Source code
 */
const bru = {
	/**
	 * Returns the location of the current collection as an absolute path.
     * @returns {string}
	 */
	cwd: () => {},
	/**
	 * Returns the name of the currently selected environment. Null if no environment is selected.
     * @returns {string | null}
	 */
	getEnvName: () => {},
	/**
	 * Returns a process environment variable by name. Returns null if the variable is not set.
     * @param {string} key
     * @returns {string | null}
	 */
	getProcessEnv: (key) => {},
	/**
	 * Checks if an environment variable exists.
     * @param {string} key
     * @returns {boolean}
	 */
	hasEnvVar: (key) => {},
	/**
	 * Returns the value of a environment variable by name.
     * @param {string} key
     * @returns {any}
	 */
	getEnvVar:(key) => {},
	/**
	 * Returns the value of a global variable by name.
     * @param {string} key
     * @returns {any}
	 */
	getGlobalEnvVar: (key) => {},
	/**
	 * Updates an environment variable. Note that the value is not written to disk and only saved temporary.
	 *
     * @param {string} key
     * @param {unknown} value
     * @returns {void}
     * @throws If the "key" contains invalid characters.
	 */
	setGlobalEnvVar: (key, value) => {},
	/**
	 * Updates an environment variable. Note that the value is not written to disk and only saved temporary.
	 *
     * @param {string} key
     * @param {any} value
     * @returns {void}
     * @throws If the "key" contains invalid characters.
	 */
	setEnvVar: (key, value) => {},
	/**
	 * Checks if an runtime variable exists.
     * @param {string} key
     * @returns {boolean}
	 */
	hasVar: (key) => {},
	/**
	 * Updates a runtime variable.
     * @param {string} key
     * @param {any} value
     * @returns {void}
	 * @throws If the "key" contains invalid characters.
	 */
	setVar: (key, value) => {},
	/**
	 * Deletes a runtime variable.
	 *
     * @param {string} key
     * @returns {void}
	 * @throws If the "key" contains invalid characters.
	 */
	deleteVar: (key) => {},
	/**
	 * Returns the value of an runtime variable by name.
     * @param {string} key
     * @returns {any}
	 */
	getVar: (key) => {},
	/**
	 * Returns the value of an request variable by name.
     * @param {string} key
     * @returns {unknown}
	 */
	getRequestVar: (key) => {},
	/**
	 * Returns the value of an collection variable by name.
     * @param {string} key
     * @returns {unknown}
	 */
	getCollectionVar: (key) => {},
	/**
	 * Returns the value of an folder variable by name.
     * @param {string} key
     * @returns {unknown}
	 */
	getFolderVar: (key) => {},
	/**
	 * Determines the next request to execute withing the request runner.
     * @param {string} nextRequest
     * @returns {void}
	 */
	setNextRequest: (nextRequest) => {},
	/**
	 * Executes a request from the current collection. Path must be relative from to collection root.
	 * Throws an error if the request does not exist.
     * @param {string} requestPath
     * @returns {Promise<{data: any, headers: Record<string, string>, duration: number, size: number, status: number, statusText: string}>}
     * 
	 */
	runRequest: (requestPath) => {},
	/**
	 * Returns a Promise that will resolve after the given time is over.
	 * The promise must be awaited, for the sleep to take effect.
     * @param {number} ms
     * @returns {Promise<void>}
	 */
	sleep: (ms) => {},

	runner: {
		/**
		 * Sets the next request to execute withing the request runner.
         * @param {string} nextRequestName
         * @returns void
		 */
		setNextRequest: (nextRequestName) => {},
		/**
		 * Skips the current request in a test run. Only works in the pre-request script.
         * @returns void
		 */
		skipRequest: () => {},
		/**
		 * Stops the runner after the current request.
         * @returns void
		 */
		stopExecution: () => {}
	}
};`;
}
