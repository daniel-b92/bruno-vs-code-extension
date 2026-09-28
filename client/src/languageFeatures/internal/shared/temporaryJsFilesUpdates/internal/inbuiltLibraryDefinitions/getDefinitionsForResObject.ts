export function getDefinitionsForResObject() {
    return `/**
 * Object representing the response returned from a server.
 *
 * Can also be called as a function to query nested response data using dot notation
 * (like \`lodash.get()\` on steroids): \`res(query, filterOrMapper?)\`. Supports deep
 * navigation with \`..\`, array indexing, and array filtering/mapping with \`[?]\`.
 * @see {@link https://docs.usebruno.com/testing/script/javascript-reference#response} Documentation
 * @see {@link https://docs.usebruno.com/testing/script/response/response-query} Query documentation
 * @param {string} query Dot-notation path to the nested value, e.g. "customer.orders.items.amount".
 * @param {((item: any) => any) | object} [filterOrMapper] Optional predicate/mapper function or object, used together with "[?]" in the query to filter or transform matched array items.
 * @returns {any}
 */
const res = (query, filterOrMapper) => {};
/**
 * HTTP Status code number
 * @type {readonly number}
 */
res.status = {};
/**
 * HTTP Status as Text
 * @type {readonly string}
 */
res.statusText = {};
/**
 * HTTP headers returned from the server
 * @type {readonly any}
 */
res.headers = {};
/**
 * Response body. Either a string or any if the server returned something that is JSON parsable.
 * @type {readonly any}
 */
res.body = {};
/**
 * The total time the server needed to response in milliseconds.
 * @type {readonly number}
 */
res.responseTime = {};
/**
 * The final response URL (after following redirects).
 * @type {readonly string}
 */
res.url = {};
/**
 * Returns the HTTP status code number
 * @returns {number}
 */
res.getStatus = () => {};
/**
 * Returns the HTTP status code as text
 * @returns {string}
 */
res.getStatusText = () => {};
/**
 * Returns the value of a response header. Undefined if the header is not present in the response.
 * @param {string} name
 * @returns {string | undefined}
 */
res.getHeader = (name) => {};
/**
 * Returns all headers returned by the server.
 * @returns {Record<string, string>}
 */
res.getHeaders = () => {};
/**
 * Read-only PropertyList interface for response headers.
 * @type {ReadonlyPropertyList}
 */
res.headerList = {};
/**
 * Get the response URL.
 * In case of redirects, you will get the final URL which may be different from the original request URL if redirects were followed.
 * @warning This method is only available in post-response scripts and test scripts.
 * @returns {string}
 */
res.getUrl = () => {};
/**
 * Returns the response body. Either as string or any if the server returned something that is JSON parsable.
 * @returns {any}
 */
res.getBody = () => {};
/**
 * Overwrites the response body. Useful if you want to transform the server response to better view it.
 * @param {any} newBody
 * @returns {void}
 */
res.setBody = (newBody) => {};
/**
 * Returns the total time the server needed to response in milliseconds.
 * @returns {number}
 */
res.getResponseTime = () => {};
/**
 * Get the response size in bytes.
 * @returns {{body: number, headers: number, total: number}}
 */
res.getSize = () => {};`;
}
