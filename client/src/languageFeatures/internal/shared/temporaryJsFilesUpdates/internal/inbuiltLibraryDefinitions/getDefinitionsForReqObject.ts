export function getDefinitionsForReqObject() {
    return `/**
 * Object representing a request made by Bruno.
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference#request} Documentation
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
	 * Get the hostname from the request URL.
	 * @returns {string}
	 */
	getHost: () => {},
	/**
	 * Get the path from the request URL.
	 * @returns {string}
	 */
	getPath: () => {},
	/**
	 * Get the raw query string from the request URL.
	 * @returns {string}
	 */
	getQueryString: () => {},
	/**
	 * Extract path parameters using the path template defined in the request.
	 * @returns {{name: string, value: string, type: string}[]}
	 */
	getPathParams: () => {},
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
	 * Get the current request name.
	 * @returns {string}
	 */
	getName: () => {},
	/**
	 * Returns the current request tags as an array of strings.
	 * @returns {string[]}
	 */
	getTags: () => {},
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
	 * Remove a request header by name.
	 * @param {string} name
	 */
	deleteHeader: (name) => {},
	/**
	 * Remove multiple request headers by name.
	 * @param {string[]} names
	 */
	deleteHeaders: (names) => {},
	/**
	 * Returns the current body value. The type depends on the currently selected body.
	 * 
	 * String for "text", "sparql" and "xml" bodies.
	 * 
	 * Records for "Multipart Form" and "Form URL encoded".
	 * 
	 * For "JSON" the type fully depends on the input body.
	 * 
	 * @param {{raw: boolean}?} options Defaults to \`raw\` = \`false\`.
	 * @returns {any}
	 */
	getBody: (options = undefined) => {},
	/**
	 * Updates the request body. The type of the body must not change, this could cause internal errors otherwise.
	 * @param {any} data
	 * @param {{raw: boolean}?} options Defaults to \`raw\` = \`false\`.
	 * @returns {void}
	 */
	setBody: (data, options = undefined) => {},
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
	 * Returns the timeout for a request in milliseconds (1 second is 1000 milliseconds).
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
	getExecutionMode: () => {},
	/**
	 * Get the platform on which the request is being executed.
	 * "app" When running in the Bruno desktop application.
	 * "cli" When running through the Bruno CLI.
	 * @returns {"app" | "cli"}
	 */
	getExecutionPlatform: () => {},
	/**
 	 * Handle request errors with a custom callback function.
 	 * @param {(err: Error) => void} callback
 	 * @returns {void}
 	 */
	onFail: (callback) => {},
};`;
}
