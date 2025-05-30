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
        getDefinitionsForInbuiltLibraries().concat(result).join("\n\n")
    );
    tempJsFilesRegistry.registerJsFile(fileName);
}

/** The Bru class is globally available in Bruno but not exposed.
* There are also no types for it.
* This is a temporary workaround to get stop typescript from complaining and get intellisense.

* Official javascript API reference:
* https://docs.usebruno.com/testing/script/javascript-reference*/
function getDefinitionsForInbuiltLibraries() {
    const bruUtilities = `/**
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

    const requestUtilities = `/**
 * Object representing a request made by Bruno.
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference#request} Documentation
 * @see {@link https://github.com/Its-treason/bruno/blob/lazer/packages/bruno-core/src/request/runtime/dataObject/BrunoRequest.ts} Source code
 */
const req = {
	/**
	 * Url of the request. Before variable placeholder interpolation.
	 * @type {readonly string}
	 */
	url: {},
	/**
	 * HTTP request method, e.g. "GET" or "POST"
	 * @type {readonly string}
	 */
	method: {},
	/**
	 * Headers of the request. This includes headers inherited from collection and folder level.
	 * @type {readonly Record<string, string>}
	 */
	headers: {},
	/**
	 * The request body. The type depends on the currently selected body.
	 *
	 * String for "text", "sparql" and "xml" bodies.
	 *
	 * Records for "Multipart Form" and "Form URL encoded".
	 *
	 * For "JSON" the type fully depends on the input body.
	 *
	 * @type {readonly any}
	 * @throws If called after the request was sent
	 */
	body: {},
	/**
	 * Timeout for a request in milliseconds
	 * @type {readonly number}
	 */
	timeout: {},
	/**
	 * Returns the url of the request.
	 * @returns {string}
	 */
	getUrl: () => {},
	/**
	 * Updates the request url.
	 * @param {string} url
	 * @returns {void}
	 * @throws If called after the request was sent
	 */
	setUrl: (url) => {},
	/**
	 * Returns the HTTP request method, e.g. "GET" or "POST".
	 * @returns {string}
	 */
	getMethod: () => {},
	/**
	 * Updates the HTTP request method.
	 * @param {string} method
	 * @returns {void}
	 * @throws If called after the request was sent
	 */
	setMethod: (method) => {},
	/**
	 * Returns the value of an header. Will return "null" if the header does not exist.
	 * @param {string} name
	 * @returns {string | null}
	 */
	getHeader: (name) => {},
	/**
	 * Returns all active headers. This includes headers from collection and folder level.
	 * The header name is case insensitive.
	 * @returns {Record<string, string>}
	 */
	getHeaders: () => {},
	/**
	 * Updates the value of one header. Will create a new header, if no header with the name exists.
	 * The header name is case insensitive.
	 * @param {string} name
	 * @param {string} value
	 * @returns {void}
	 * @throws If called after the request was sent
	 */
	setHeader: (name, value) => {},
	/**
	 * Overwrites all request headers. This will also overwrite headers from collection and folder level.
	 * @param {Record<string, string>} data
	 * @returns {void}
	 */
	setHeaders: (data) => {},
	/**
	 * Returns the current body value. The type depends on the currently selected body.
	 *
	 * String for "text", "sparql" and "xml" bodies.
	 *
	 * Records for "Multipart Form" and "Form URL encoded".
	 *
	 * For "JSON" the type fully depends on the input body.
	 * 
	 * @returns {any}
	 */
	getBody: () => {},
	/**
	 * Updates the request body. The type of the body must not change, this could cause internal errors otherwise.
	 * @param {any} data
	 * @returns {void}
	 */
	setBody: (data) => {},
	/**
	 * Current authentication mode. If request auth mode is set to inherit, this will be the mode from collection
	 * @type {readonly string}
	 * @throws If called after the request was sent
	 */
	authMode: {},
	/**
	 * Returns the current authentication mode. If request auth mode is set to inherit, this will be the mode from collection
	 * @returns {string}
	 */
	getAuthMode: () => {},
	/**
	 * Updates the number of redirects Bruno will do. The default value is 25 redirects.
	 * If set to 0, Bruno will not to any redirects and end with the first response received.
	 * @param {number} maxRedirects
	 * @returns {void}
	 * @throws If called after the request was sent
	 */
	setMaxRedirects: (maxRedirects) => {},
	/**
	 * Returns the timeout for a request in milliseconds (1 seconds is 1000 milliseconds).
	 * @returns {number}
	 */
	getTimeout: () => {},
	/**
	 * Updates the request timeout. New timeout must be a number in milliseconds.
	 * @param {number} timeout
	 * @returns {void}
	 * @throws If called after the request was sent
	 */
	setTimeout: (timeout) => {},
	/**
	 * Disables parsing of the response, if its a JSON response. The \`res.body\` will then be a string.
	 *
	 * This was implemented into Bruno to prevent issues with JSON parsing, e.g. with BigInts and other edge cases.
	 * All of those problem are fixed within Bruno Lazer, so this function is not needed in lazer.
	 * 
	 * @returns {void}
	 */
	disableParsingResponseJson: () => {},
	/**
	 * Returns info about how the request is executed.
	 * "standalone" if the Request was called from the normal request tab.
	 * "runner" if the request was called within a runner execution.
	 * @returns {"standalone" | "runner"}
	 */
	getExecutionMode: () => {}
};`;

    const responseUtilities = `/**
 * Object representing the response returned from a server
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference#response} Documentation
 * @see {@link https://github.com/Its-treason/bruno/blob/lazer/packages/bruno-core/src/request/runtime/dataObject/BrunoResponse.ts} Source code
 */
const res = {
	/**
	 * HTTP Status code number
	 * @type {readonly number}
	 */
	status: {},
	/**
	 * HTTP Status as Text
	 * @type {readonly number}
	 */
	statusText: {},
	/**
	 * HTTP headers returned from the server
	 * @type {readonly any}
	 */
	headers: {},
	/**
	 * Response body. Either a string or any if the server returned something that is JSON parsable.
	 * @type {readonly any}
	 */
	body: {},
	/**
	 * The total time the server needed to response in milliseconds.
	 * @type {readonly number}
	 */
	responseTime: {},
	/**
	 * Returns the HTTP status code number
	 * @returns {number}
	 */
	getStatus:() => {},
	/**
	 * Returns the HTTP status code as text
	 * @returns {string}
	 */
	getStatusText:() => {},
	/**
	 * Returns the value of a response header. Null if the header is not present in the response.
	 * @param {string} name
	 * @returns {string | null}
	 */
	getHeader: (name) => {},
	/**
	 * Returns all headers returned by the server.
	 * @returns {Record<string, string>}
	 */
	getHeaders:() => {},
	/**
	 * Returns the response body. Either as string or any if the server returned something that is JSON parsable.
	 * @returns {any}
	 */
	getBody: () => {},
	/**
	 * Returns the total time the server needed to response in milliseconds.
	 * @returns {number}
	 */
	getResponseTime: () => {},
	/**
	 * Overwrites the response body. Useful if you want to transform the server response to better view it.
	 * @param newBody
	 * @returns {void}
	 */
	setBody: (newBody) => {}
}`;

    return [bruUtilities, requestUtilities, responseUtilities];
}
