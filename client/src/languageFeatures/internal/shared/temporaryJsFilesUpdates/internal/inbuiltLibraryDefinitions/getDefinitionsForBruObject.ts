export function getDefinitionsForBruObject() {
    const envVariableDefinitions = getDefinitionsForEnvironmentVariables();
    const globalEnvVariableDefinitions =
        getDefinitionsForGlobalEnvironmentVariables();
    const runtimeVariableDefinitions = getDefinitionsForRuntimeVariables();
    const collectionVarDefinitions = getDefinitionsForCollectionVars();
    const otherVariableTypesDefinitions = getDefinionsForOtherVariableTypes();
    const utilityDefinitions = getDefinitionsForUtilities();
    const runnerSubObjectDefinition = getDefinitionsForRunnerSubobject();
    const cookieSubobjectDefinition = getDefinitionsForCookiesSubobject();
    const grpcSubobjectDefinition = getDefinitionsForGrpcSubobject();

    return `${getCommonTypeDefinitions()}
/**
 * Object with common utility function for Bruno.
 * @see {@link https://docs.usebruno.com/scripting/javascript-reference} Documentation
 */
const bru = {
	${insertDefinitions(envVariableDefinitions)}
	${insertDefinitions(globalEnvVariableDefinitions)}
	${insertDefinitions(runtimeVariableDefinitions)}
	${insertDefinitions(collectionVarDefinitions)}
	${insertDefinitions(otherVariableTypesDefinitions)}
	${insertDefinitions(utilityDefinitions)}
	runner: ${insertDefinitions(runnerSubObjectDefinition)}
	cookies: ${insertDefinitions(cookieSubobjectDefinition)}
	grpc: ${insertDefinitions(grpcSubobjectDefinition)}
};`;

    function insertDefinitions(definitions: string) {
        return definitions.concat(definitions.endsWith(",") ? "" : ",");
    }
}

function getCommonTypeDefinitions() {
    return `/**
 * @typedef {object} PropertyHeader
 * @property {string} key
 * @property {string} value
 * @property {boolean} [disabled]
 */
/**
 * @typedef {object} PropertyList
 * @property {(name: string) => string | undefined} get
 * @property {(name: string) => PropertyHeader | undefined} one
 * @property {() => PropertyHeader[]} all
 * @property {() => number} count
 * @property {((name: string, value?: string) => boolean) | ((header: {key: string}) => boolean)} has
 * @property {(predicate: (header: PropertyHeader) => any, context?: any) => PropertyHeader | undefined} find
 * @property {(predicate: (header: PropertyHeader) => any, context?: any) => PropertyHeader[]} filter
 * @property {(item: string | {key: string, value: string}) => number} indexOf
 * @property {(callback: (header: PropertyHeader, index: number) => void, context?: any) => void} each
 * @property {<T>(callback: (header: PropertyHeader, index: number) => T, context?: any) => T[]} map
 * @property {<T>(callback: (result: T, header: PropertyHeader, index: number) => T, initial?: T, context?: any) => T} reduce
 * @property {(excludeDisabled?: boolean, caseSensitive?: boolean, multiValue?: boolean, sanitizeKeys?: boolean) => object} toObject
 * @property {() => string} toString
 * @property {() => PropertyHeader[]} toJSON
 * @property {(header: PropertyHeader | string, value?: string) => void} add
 * @property {(header: PropertyHeader | string, value?: string) => boolean | null} upsert
 * @property {(keyOrPredicate: string | {key: string} | ((header: PropertyHeader) => any), context?: any) => void} remove
 * @property {() => void} clear
 * @property {(items: PropertyHeader[] | string) => void} populate
 * @property {(items: PropertyHeader[] | string) => void} repopulate
 * @property {(source: PropertyList | PropertyHeader[], prune?: boolean) => void} assimilate
 */
/**
 * @typedef {object} ReadonlyPropertyList
 * @property {(name: string) => string | undefined} get
 * @property {(name: string) => PropertyHeader | undefined} one
 * @property {() => PropertyHeader[]} all
 * @property {() => number} count
 * @property {((name: string, value?: string) => boolean) | ((header: {key: string}) => boolean)} has
 * @property {(predicate: (header: PropertyHeader) => any, context?: any) => PropertyHeader | undefined} find
 * @property {(predicate: (header: PropertyHeader) => any, context?: any) => PropertyHeader[]} filter
 * @property {(item: string | {key: string, value: string}) => number} indexOf
 * @property {(callback: (header: PropertyHeader, index: number) => void, context?: any) => void} each
 * @property {<T>(callback: (header: PropertyHeader, index: number) => T, context?: any) => T[]} map
 * @property {<T>(callback: (result: T, header: PropertyHeader, index: number) => T, initial?: T, context?: any) => T} reduce
 * @property {(excludeDisabled?: boolean, caseSensitive?: boolean, multiValue?: boolean, sanitizeKeys?: boolean) => object} toObject
 * @property {() => string} toString
 * @property {() => PropertyHeader[]} toJSON
 */
/**
 * @typedef {object} GrpcMessage
 * @property {any} data The protobuf payload of the message.
 * @property {number} timestamp Epoch milliseconds.
 */
/**
 * @typedef {object} GrpcMessageCollection Read-only collection of gRPC messages.
 * @property {(index: number) => GrpcMessage | undefined} get
 * @property {() => GrpcMessage[]} all
 * @property {() => number} count
 * @property {(predicate: (message: GrpcMessage) => any) => GrpcMessage[]} filter
 * @property {<T>(callback: (message: GrpcMessage) => T) => T[]} map
 */
/**
 * @typedef {object} ReadonlyGrpcMetadata
 * @property {(key: string) => string | undefined} get
 * @property {(key: string) => PropertyHeader | undefined} one
 * @property {() => Record<string, string>} toObject
 * @property {(key: string) => boolean} has
 * @property {() => number} count
 */
/**
 * @typedef {object} GrpcRequestMetadata Client metadata. Only writable in "Before Call Start" scripts.
 * @property {(key: string) => string | undefined} get
 * @property {(key: string) => PropertyHeader | undefined} one
 * @property {() => Record<string, string>} toObject
 * @property {(key: string) => boolean} has
 * @property {() => number} count
 * @property {(metadata: PropertyHeader) => void} add
 * @property {(key: string, value: string) => void} upsert
 * @property {(key: string) => void} remove
 */
/**
 * @typedef {object} RequestOptions
 * @property {string} method HTTP method (GET, POST, PUT, etc.)
 * @property {string} url The URL to send the request to.
 * @property {Record<string, string>} [headers] (Optional) Request headers.
 * @property {string | object} [data] (Optional) Request data. Can be a string or object.
 * @property {number} [timeout] (Optional) Request timeout in milliseconds.
 * @property {import("node:https").Agent} [httpsAgent] (Optional) Custom HTTPS agent for TLS/SSL configuration (e.g. \`new (require("node:https")).Agent()\`)
 */
/**
 * @typedef {object} CookieObject
 * @property {string} key
 * @property {string} value
 * @property {string} [domain]
 * @property {string} [path]
 * @property {boolean} [secure]
 * @property {boolean} [httpOnly]
 * @property {number} [maxAge]
 * @property {string} [expires]
 * @property {string} [sameSite]
 */
/**
 * @typedef {object} BrunoCookieJar
 * @property {((url: string, name: string, value: string) => void) | ((url: string, cookieObject: CookieObject) => void)} setCookie Set a single cookie with specified attributes.
 * @property {(url: string, cookieObjects: CookieObject[]) => void} setCookies Set multiple cookies at once using an array of cookie objects.
 * @property {(url: string, name: string) => Promise<CookieObject | null>} getCookie Get a specific cookie by name.
 * @property {((url: string, name: string) => Promise<boolean>) | ((url: string, name: string, callback: (err: Error, exists: boolean) => void) => void)} hasCookie Check whether a cookie with the given name exists for a specific URL. Optionally accepts a callback as the third argument; if omitted, returns a Promise.
 * @property {(url: string) => Promise<CookieObject[]>} getCookies Get all cookies for a specific URL.
 * @property {(url: string, name: string) => void} deleteCookie Delete a specific cookie by name.
 * @property {(url: string) => void} deleteCookies Delete all cookies for a specific URL.
 * @property {() => void} clear Clear all cookies from the cookie jar.
 */`;
}

function getDefinitionsForEnvironmentVariables() {
    return `/**
 * Returns the name of the currently selected environment. Null if no environment is selected.
 * @returns {string | null}
 */
getEnvName: () => {},
/** 
 * Checks if an environment variable exists in the currently selected environment.
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
 * Get all environment variables in the current environment as an object.
 * @returns {Record<string, any>}
 */
getAllEnvVars:() => {},
/**
 * Sets an environment variable in the currently active environment and persists the change to disk.
 * @param {string} key
 * @param {unknown} value
 * @returns {void}
 */
setEnvVar: (key, value) => {},
/**
 * Delete a specific environment variable.
 *
 * @param {string} key
 * @returns {void}
 */
deleteEnvVar: (key) => {},
/**
 * Delete all environment variables in the current environment.
 *
 * @returns {void}
 */
deleteAllEnvVars: () => {},`;
}

function getDefinitionsForGlobalEnvironmentVariables() {
    return `/**
 * Returns the value of a global variable by name.
 * @param {string} key
 * @returns {any}
 */
getGlobalEnvVar: (key) => {},
/**
 * Set the Bruno global environment variable.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {void}
 */
setGlobalEnvVar: (key, value) => {},
/**
 * Get all global environment variables as an object.
 * @returns {Record<string, any>}
 */
getAllGlobalEnvVars: () => {},
/**
 * Removes a specific global environment variable and persists the change to disk.
 * @param {string} key
 * @returns {void}
 */
deleteGlobalEnvVar: (key) => {},
/**
 * Removes all global environment variables and persists the change to disk.
 * @returns {void}
 */
deleteAllGlobalEnvVars: () => {},
/**
 * Checks if a global environment variable exists.
 * @param {string} key
 * @returns {boolean}
 */
hasGlobalEnvVar: (key) => {},`;
}

function getDefinitionsForRuntimeVariables() {
    return `/**
 * Checks if a runtime variable exists.
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
 * Deletes all runtime variables.
 *
 * @returns {void}
 */
deleteAllVars: () => {},
/**
 * Returns the value of an runtime variable by name.
 * @param {string} key
 * @returns {any}
 */
getVar: (key) => {},
/**
 * Returns an object containing all current runtime variables as key-value pairs.
 * @returns {Record<string, any>}
 */
getAllVars: () => {},`;
}

function getDefinitionsForCollectionVars() {
    return `/**
 * Returns the value of an collection variable by name.
 * @param {string} key
 * @returns {unknown}
 */
getCollectionVar: (key) => {},
/**
 * Checks if a collection-level variable with the given key exists.
 * @param {string} key
 * @returns {boolean}
 */
hasCollectionVar: (key) => {},
/**
 * Sets a collection-level variable and persists the change to disk.
 * @param {string} key
 * @param {unknown} value
 * @returns {void}
 */
setCollectionVar: (key, value) => {},
/**
 * Removes a specific collection-level variable and persists the change to disk.
 * @param {string} key
 * @returns {void}
 */
deleteCollectionVar: (key) => {},
/**
 * Removes all collection-level variables and persists the change to disk.
 * @returns {void}
 */
deleteAllCollectionVars: () => {},`;
}

function getDefinionsForOtherVariableTypes() {
    return `/**
 * Returns the value of an request variable by name.
 * @param {string} key
 * @returns {unknown}
 */
getRequestVar: (key) => {},
/**
 * Returns the value of an folder variable by name.
 * @param {string} key
 * @returns {unknown}
 */
getFolderVar: (key) => {},
/**
 * Retrieve an OAuth2 credential variable value.
 * @param {string} key
 * @returns {string}
 */
getOauth2CredentialVar: (key) => {},
/**
 * Reset (clear) an OAuth2 credential so it can be re-authorized.
 * Use this when you need to force a new token fetch or clear stored credentials.
 * @param {string} credentialId
 * @returns {void}
 */
resetOauth2Credential: (credentialId) => {},
/**
 * Retrieve a secret from a configured secret manager (e.g., HashiCorp Vault, AWS Secrets Manager, Azure Key Vault).
 * The key follows the pattern \`<secret-name>\`.\`<key-name>\`.
 * @param {string} key
 * @returns {string}
 */
getSecretVar: (key) => {},`;
}

function getDefinitionsForUtilities() {
    return `/**
 * Returns a process environment variable by name. Returns undefined if the variable is not set.
 * @param {string} key
 * @returns {string | undefined}
 */
getProcessEnv: (key) => {},
/**
 * Retrieve the name of the current collection.
 * @returns {string}
 */
getCollectionName: () => {},
/**
 * Returns a Promise that will resolve after the given time is over.
 * The promise must be awaited, for the sleep to take effect.
 * @param {number} ms
 * @returns {Promise<void>}
 */
sleep: (ms) => {},
/**
 * Evaluates dynamic variables and environment variables within a string. 
 * This function allows you to use Bruno’s dynamic variables (like \`{{$randomFirstName}}\`) directly in your scripts.
 * @param {string} input
 * @returns {string}
 */
interpolate: (input) => {},
/**
 * Returns the absolute path of the collection's root directory on disk.
 * @returns {string}
 */
cwd: () => {},
/**
 * Returns \`true\` when running in Safe Mode (the default sandbox), or \`false\` when running in Developer Mode.
 * @returns {boolean}
 */
isSafeMode: () => {},
/**
 * Determines the next request to execute withing the request runner.
 * @param {string | null} nextRequest
 * @returns {void}
 */
setNextRequest: (nextRequest) => {},
/**
 * Executes a request from the current collection. Path must be relative from to collection root.
 * Throws an error if the request does not exist.
 * @param {string} requestPath
 * @returns {Promise<{data: any, headers: Record<string, string>, duration: number, size: number, status: number, statusText: string}>}
 */
runRequest: (requestPath) => {},
/**
 * Send a programmatic HTTP request within your script.
 * @param {RequestOptions} options Object containing the request parameters.
 * @param {(err: Error, response: object) => void} [callback] Function to handle the response.
 * @returns {Promise<object>}
 */
sendRequest: (options, callback = undefined) => {},
/**
 * Obtain the test results of a request. Use this within test scripts.
 * @returns {Promise<{name: string, status: string}[]>}
 */
getTestResults: () => {},
/**
 * Obtain the assertion results of a request. Use this within test scripts.
 * @returns {Promise<{lhs: string, operator: string, rhs: string, status: string}[]>}
 */
getAssertionResults: () => {},`;
}

function getDefinitionsForRunnerSubobject() {
    return `{
	/**
	 * Alter the order of requests by specifying the next request to execute. Use the request's display name.
     * @param {string | null} nextRequestName Request name or null to stop the run.
     * @returns {void}
	 */
	setNextRequest: (nextRequestName) => {},
	/**
	 * Skips the current request entirely during a collection run. Call this in a pre-request script.
     * @returns {void}
	 */
	skipRequest: () => {},
	/**
	 * Immediately stops the entire collection run. No further requests are executed after this call.
     * @returns {void}
	 */
	stopExecution: () => {},
	/**
	 * Zero-based index of the current iteration in a data-driven run.
	 * @type {number}
	 */
	iterationIndex: 0,
	/**
	 * Total number of iterations in the current data-driven run.
	 * @type {number}
	 */
	totalIterations: 0,
	/**
	 * Object for accessing and manipulating the current row from an attached CSV or JSON data file.
	 * @type {object}
	 * @property {(key?: string) => any} get Get a field value or all fields for the current row.
	 * @property {(key: string) => boolean} has Check if a field exists in the current iteration.
	 * @property {(key: string) => void} unset Remove a field from the current iteration.
	 * @property {() => string} stringify Return the current iteration row as a JSON string.
	 */
	iterationData: {}
}`;
}

function getDefinitionsForCookiesSubobject() {
    return `{
	/** Get a cookie value for the current request URL. @param {string} name @returns {string | undefined} */
	get: (name) => {},
	/** Check whether a cookie exists, optionally matching its value. @param {string} name @param {string} [value] @returns {boolean} */
	has: (name, value = undefined) => {},
	/** Find one cookie entry by id. @param {string} id @returns {CookieObject | undefined} */
	one: (id) => {},
	/** Get all cookies for the current request URL. @returns {CookieObject[]} */
	all: () => {},
	/** Count cookies for the current request URL. @returns {number} */
	count: () => {},
	/** Get a cookie by numeric index. @param {number} index @returns {CookieObject | undefined} */
	idx: (index) => {},
	/** Find the index of a cookie entry. @param {CookieObject} item @returns {number} */
	indexOf: (item) => {},
	/** Iterate synchronously over cookies. @param {(cookie: CookieObject) => void} callback */
	each: (callback) => {},
	/** Find the first matching cookie. @param {(cookie: CookieObject) => any} callback @returns {CookieObject | undefined} */
	find: (callback) => {},
	/** Return all matching cookies. @param {(cookie: CookieObject) => any} callback @returns {CookieObject[]} */
	filter: (callback) => {},
	/** Map cookies to another value. @param {(cookie: CookieObject) => any} callback @returns {any[]} */
	map: (callback) => {},
	/** Reduce cookies to a value. @param {Function} callback @param {any} initial @returns {any} */
	reduce: (callback, initial) => {},
	/** Convert cookies to a name/value object. @returns {Record<string, string>} */
	toObject: () => {},
	/** Convert cookies to a string. @returns {string} */
	toString: () => {},
	/** Add and persist a request-scoped cookie. @param {CookieObject} cookie @returns {Promise<void>} */
	add: (cookie) => {},
	/** Add or replace and persist a request-scoped cookie. @param {CookieObject} cookie @returns {Promise<void>} */
	upsert: (cookie) => {},
	/** Remove and persist a request-scoped cookie. @param {string} name @returns {Promise<void>} */
	remove: (name) => {},
	/** Delete and persist a request-scoped cookie. @param {string} name @returns {Promise<void>} */
	delete: (name) => {},
	/** Clear and persist all request-scoped cookies. @returns {Promise<void>} */
	clear: () => {},
    /**
     * Create a cookie jar instance for managing cookies.
     * @returns {BrunoCookieJar}
    */
	jar: () => {},
},`;
}

function getDefinitionsForGrpcSubobject() {
    return `{
	/**
	 * Information about the outgoing gRPC request.
	 */
	request: {
		/**
		 * Address and port of the gRPC server.
		 * @type {string}
		 */
		url: "",
		/**
		 * Service and RPC method name.
		 * @type {string}
		 */
		method: "",
		/**
		 * The call variant.
		 * @type {"unary" | "client-streaming" | "server-streaming" | "bidi-streaming"}
		 */
		methodType: "unary",
		/**
		 * Current authentication mode, e.g. "bearer" or "none".
		 * @type {string}
		 */
		authMode: "",
		/**
		 * Path to the proto file.
		 * @type {string}
		 */
		protoPath: "",
		/**
		 * Display name of the gRPC request.
		 * @type {string}
		 */
		name: "",
		/**
		 * The messages that were transmitted so far (not the list authored in the UI).
		 * Empty in "Before Call Start" scripts. Read-only.
		 * @type {GrpcMessageCollection}
		 */
		messages: {},
		/**
		 * The current outbound message. Only available in "Before Message Send" scripts. Read-only.
		 * @type {GrpcMessage}
		 */
		message: {},
		/**
		 * Client metadata (the HTTP/2 headers sent to the server). Only writable in "Before Call Start" scripts.
		 * @type {GrpcRequestMetadata}
		 */
		metadata: {},
	},
	/**
	 * Information about the gRPC response.
	 */
	response: {
		/**
		 * All received messages. Only available in "After Call End" scripts. Read-only.
		 * @type {GrpcMessageCollection}
		 */
		messages: {},
		/**
		 * The current inbound message. Only available in "After Message Receive" scripts. Read-only.
		 * @type {GrpcMessage}
		 */
		message: {},
		/**
		 * Server initial metadata. Available in "After Message Receive" and "After Call End" scripts. Read-only.
		 * @type {ReadonlyGrpcMetadata}
		 */
		metadata: {},
		/**
		 * Trailing metadata from the server, including \`grpc-status\` and \`grpc-message\`.
		 * Only available in "After Call End" scripts. Read-only.
		 * @type {ReadonlyGrpcMetadata}
		 */
		trailers: {},
		/**
		 * Numeric gRPC status code. Only available in "After Call End" scripts.
		 * @type {number}
		 */
		statusCode: 0,
		/**
		 * gRPC status message, e.g. "OK". Only available in "After Call End" scripts.
		 * @type {string}
		 */
		statusText: "",
		/**
		 * Call duration in milliseconds. Only available in "After Call End" scripts.
		 * @type {number}
		 */
		duration: 0,
	},
}`;
}
