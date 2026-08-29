export function getDefinitionsForResObject() {
    return `/**
 * Object representing the response returned from a server
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference#response} Documentation
 */
const res = {
	/**
	 * HTTP Status code number
	 * @type {readonly number}
	 */
	status: {},
	/**
	 * HTTP Status as Text
	 * @type {readonly string}
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
	 * The final response URL (after following redirects).
	 * @type {readonly string}
	 */
	url: {},
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
	 * Get the response URL.
	 * In case of redirects, you will get the final URL which may be different from the original request URL if redirects were followed.
	 * @warning This method is only available in post-response scripts and test scripts.
	 * @returns {string}
	 */
	getUrl: () => {},
	/**
	 * Returns the response body. Either as string or any if the server returned something that is JSON parsable.
	 * @returns {any}
	 */
	getBody: () => {},
	/**
	 * Overwrites the response body. Useful if you want to transform the server response to better view it.
	 * @param {any} newBody
	 * @returns {void}
	 */
	setBody: (newBody) => {},
	/**
	 * Returns the total time the server needed to response in milliseconds.
	 * @returns {number}
	 */
	getResponseTime: () => {},
	/**
	 * Get the response size in bytes.
	 * @returns {{body: number, headers: number, total: number}}
	 */
	getSize: () => {},
};`;
}
