if (typeof XMLHttpRequest == "undefined") {
	XMLHttpRequest = function () {
		try {
			return new ActiveXObject("Msxml2.XMLHTTP.6.0");
		} catch (e) {
		}
		try {
			return new ActiveXObject("Msxml2.XMLHTTP.3.0");
		} catch (e) {
		}
		try {
			return new ActiveXObject("Microsoft.XMLHTTP");
		} catch (e) {
		}
		//Microsoft.XMLHTTP points to Msxml2.XMLHTTP and is redundanat
		throw new Error("This browser does not support XMLHttpRequest.");
	};
}

publicApi.ajaxFunction = function (params, callback) {
	var xhrUrl = params.url;
	var xhrData = params.data;
	var encType = params.encType;
    var method = params.method;


    var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4) {
			if (xhr.status >= 200 && xhr.status < 300) {
				var data = xhr.responseText || null;
				try {
					data = JSON.parse(data);
				} catch (e) {
					if (xhr.status !=204) {
						thisRequest.ajaxError(e, data);
						return;
					} else {
						data = null;
					}
				}
				var headers = xhr.getAllResponseHeaders();
				if (headers == "") {	// Firefox bug  >_>
					headers = [];
					var desiredHeaders = ["Cache-Control", "Content-Language", "Content-Type", "Expires", "Last-Modified", "Pragma"];
					for (var i = 0; i < desiredHeaders.length; i++) {
						var value = xhr.getResponseHeader(desiredHeaders[i]);
						if (value != "" && value != null) {
							headers.push(desiredHeaders[i] + ": " + value);
						}
					}
					headers = headers.join("\n");
				}
				callback(null, data, headers);
			} else {
				var data = xhr.responseText || null;
				try {
					data = JSON.parse(data);
				} catch (e) {
				}
				var headers = xhr.getAllResponseHeaders();
				if (headers == "") {	// Firefox bug  >_>
					headers = [];
					var desiredHeaders = ["Cache-Control", "Content-Language", "Content-Type", "Expires", "Last-Modified", "Pragma"];
					for (var i = 0; i < desiredHeaders.length; i++) {
						var value = xhr.getResponseHeader(desiredHeaders[i]);
						if (value != "" && value != null) {
							headers.push(desiredHeaders[i] + ": " + value);
						}
					}
					headers = headers.join("\n");
				}
				callback(new HttpError(xhr.status, xhr), data, headers);
			}
		}
	};
	xhr.open(method, xhrUrl, true);
	xhr.setRequestHeader("Content-Type", encType);
	xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
	xhr.send(xhrData);
};

// Default cache
(function () {
	var cacheData = {};
	var cacheTimes = {};
	var emptyTimeout = setInterval(function () {
		defaultCache.empty();
	}, 10*1000);

	var defaultCache = function (cacheKey, insertData) {
		if (insertData !== undefined) {
			cacheData[cacheKey] = insertData;
			cacheTimes[cacheKey] = (new Date()).getTime();
			return;
		}
		return cacheData[cacheKey];
	};
	defaultCache.cacheSeconds = 10;
	defaultCache.empty = function (timeLimit) {
		// TODO: figure out what to do here
		return;
		if (timeLimit == undefined) {
			timeLimit = (new Date()).getTime() - defaultCache.cacheSeconds * 1000;
		}
		for (var key in cacheTimes) {
			if (cacheTimes[key] <= timeLimit) {
				var request = cacheData[key];
				delete cacheData[key];
				delete cacheTimes[key];
			}
		}
	};
	defaultCache.invalidate = function (urlPattern) {
		if (typeof urlPattern == "string") {
			urlPattern = Utils.resolveRelativeUri(urlPattern);
		}
		for (var key in cacheData) {
			var request = cacheData[key];
			var url = request.url;
			if (typeof urlPattern == "string") {
				if (url.indexOf(urlPattern) != -1) {
					request.invalidate();
				}
			} else {
				if (urlPattern.test(url)) {
					request.invalidate();
				}
			}
		}
	};
	publicApi.defaultCache = defaultCache;
	publicApi.invalidate = defaultCache.invalidate;
})();

function FragmentRequest(request, fragment) {
	var thisFragmentRequest = this;
	
	this.baseUrl = request.url;
	this.fragment = fragment;
	if (fragment == null) {
		fragment = "";
	}
	this.url = this.baseUrl + "#" + encodeURI(fragment);

	this.getRoot = function (callback) {
		request.getRoot(function(data) {
			callback.call(data, data, thisFragmentRequest);
		});
	};
	this.getData = function (callback) {
		if (fragment == null || fragment == "") {
			request.document.getRoot(function(data) {
				callback.call(data, data, thisFragmentRequest);
			});
		} else {
			request.document.getFragment(fragment, function(data) {
				callback.call(data, data, thisFragmentRequest);
			});
		}
	};
	this.getRawResponse = function (callback) {
		request.getResponse(function(data) {
			callback.call(data, data, thisFragmentRequest);
		});
	};
}
FragmentRequest.prototype = {
}

function requestJson(url, method, data, encType, cacheFunction, hintSchema) {
	if (url == undefined) {
		throw new Error("URL cannot be undefined");
	}
	url = Utils.resolveRelativeUri(url);
	if (method == undefined) {
		method = "GET";
	}
	if (data === undefined) {
		data = {};
	}
	var fragment = null;
	var index = url.indexOf("#");
	if (index >= 0) {
		fragment = decodeURI(url.substring(index + 1));
		url = url.substring(0, index);
	}

	// TODO: think about implementing Rails-style _method=put/delete
	if (encType == undefined) {
		if (method == "GET") {
			encType = "application/x-www-form-urlencoded";
		} else if (method == "POST" || method == "PUT") {
			encType = "application/json";
		} else {
			encType = "application/x-www-form-urlencoded";
		}
	}
	if (cacheFunction == undefined) {
		cacheFunction = publicApi.defaultCache;
	}

	var cacheable = (cacheFunction && method == "GET" && encType == "application/x-www-form-urlencoded");
	if (cacheable) {
		var cacheKey = JSON.stringify(url) + ":" + JSON.stringify(data);
		var result = cacheFunction(cacheKey);
		if (result != undefined) {
			return {
				request: result,
				fragmentRequest: new FragmentRequest(result, fragment)
			};
		}
	}
	var request = new Request(url, method, data, encType, hintSchema, function (request) {
		if (cacheable) {
			cacheFunction(cacheKey, request);
		}
	});
	return {
		request: request,
		fragmentRequest: new FragmentRequest(request, fragment)
	};
}

function addToCache(url, rawData, schemaUrl, cacheFunction) {
	url = Utils.resolveRelativeUri(url);
	if (cacheFunction == undefined) {
		cacheFunction = publicApi.defaultCache;
	}
	var data = {};
	var cacheKey = JSON.stringify(url) + ":" + JSON.stringify(data);
	var request = new RequestFake(url, rawData, schemaUrl, cacheFunction, cacheKey);
}
publicApi.addToCache = addToCache;
publicApi.getData = function(params, callback, hintSchema) {
	if (typeof params == "string") {
		params = {url: params};
	}
	var request = requestJson(params.url, params.method, params.data, params.encType, null, hintSchema).fragmentRequest;
	if (callback != undefined) {
		request.getData(callback);
	}
	return request;
};
publicApi.isRequest = function (obj) {
	return (obj instanceof Request) || (obj instanceof FragmentRequest);
}

var PROFILE_SCHEMA_KEY = Utils.getUniqueKey();

function HttpError (code) {
	this.httpCode = code;
	this.message = "HTTP Status: " + code;
}
HttpError.prototype = new Error();
publicApi.HttpError = HttpError;

function Request(url, method, data, encType, hintSchema, executeImmediately) {
	executeImmediately(this);
	this.circular = true;
	url = Utils.resolveRelativeUri(url);

	data = Utils.encodeData(data, encType);
	if (method == "GET" && data != "") {
		if (url.indexOf("?") == -1) {
			url += "?";
		} else {
			url += "&";
		}
		url += data;
		data = "";
	}

	Utils.log(Utils.logLevel.STANDARD, "Sending request for: " + url);
	var thisRequest = this;
	this.successful = undefined;
	this.error = null;
	this.url = url;

	var isDefinitive = (data == undefined) || (data == "");
	this.responseListeners = new ListenerSet(this);
	this.document = new Document(url, isDefinitive, true);

	this.fetched = false;
	this.fetchData(url, method, data, encType, hintSchema);
	delete this.circular;
	this.invalidate = function() {
		if (method == "GET") {
			this.fetchData(url, method, data, encType, hintSchema);
		}
	};
}
Request.prototype = {
	beingUsed: function() {
		if (this.baseContext == undefined) {
			Utils.log(Utils.logLevel.DEBUG, "No base context: " + this.url);
			return true;
		}
		return this.baseContext.retainCount() > 0;
	},
	getResponse: function (listener) {
		this.responseListeners.add(listener);
		this.checkForFullResponse();
	},
	checkForFullResponse: function () {
		if (this.document.raw.defined()) {
			this.responseListeners.notify(this.document.raw, this);
		}
	},
	ajaxSuccess: function (data, headerText, hintSchema) {
		this.fetched = true;
		var thisRequest = this;
		thisRequest.successful = true;
		Utils.log(Utils.logLevel.STANDARD, "Request success: " + this.url);
		var lines = headerText.replace(/\r\n/g, "\n").split("\n");
		var headers = {};
		var contentType = null;
		var contentTypeParameters = {};
		for (var i = 0; i < lines.length; i++) {
			var keyName = lines[i].split(": ")[0];
			if (keyName == "") {
				continue;
			}
			var value = lines[i].substring(keyName.length + 2);
			if (value[value.length - 1] == "\r") {
				value = value.substring(0, value.length - 1);
			}
			// Some browsers have all parameters as lower-case, so we do this for compatability
			//       (discovered using Dolphin Browser on an Android phone)
			keyName = keyName.toLowerCase();
			if (headers[keyName] == undefined) {
				headers[keyName] = value;
			} else if (typeof headers[keyName] == "object") {
				headers[keyName].push(value);
			} else {
				headers[keyName] = [headers[keyName], value];
			}
		}
		Utils.log(Utils.logLevel.DEBUG, "headers: " + JSON.stringify(headers, null, 4));
		var contentType = headers["content-type"].split(";")[0];
		var profileParts = headers["content-type"].substring(contentType.length + 1).split(",");
		for (var i = 0; i < profileParts.length; i++) {
			var partName = profileParts[i].split("=")[0];
			var partValue = profileParts[i].substring(partName.length + 1);
			partName = partName.trim();
			if (partName == "") {
				continue;
			}
			contentTypeParameters[partName] = partValue;
		}

		thisRequest.headers = headers;
		thisRequest.contentType = contentType;
		thisRequest.contentTypeParameters = contentTypeParameters;

		thisRequest.document.setRaw(data);
		thisRequest.profileUrl = null;
		thisRequest.document.raw.removeSchema(PROFILE_SCHEMA_KEY);
		if (contentTypeParameters["profile"] != undefined) {
			var schemaUrl = contentTypeParameters["profile"];
			schemaUrl = Utils.resolveRelativeUri(thisRequest.url, schemaUrl);
			thisRequest.profileUrl = schemaUrl;
			thisRequest.document.raw.addSchema(schemaUrl, PROFILE_SCHEMA_KEY);
		} else if (hintSchema != undefined) {
			thisRequest.document.raw.addSchema(hintSchema, PROFILE_SCHEMA_KEY);
		}
		if (contentTypeParameters["root"] != undefined) {
			var link = {
				"href": contentTypeParameters["root"],
				"rel": "root"
			};
			thisRequest.document.raw.addLink(link);
		}
		
		// Links
		if (headers["link"]) {
			var links = (typeof headers["link"] == "object") ? headers['link'] : [headers['link']];
			for (var i = 0; i < links.length; i++) {
				var link = links[i];
				var parts = link.trim().split(";");
				var url = parts.shift().trim();
				url = url.substring(1, url.length - 1);
				var linkObj = {
					"href": url
				};
				for (var j = 0; j < parts.length; j++) {
					var part = parts[j];
					var key = part.substring(0, part.indexOf("="));
					var value = part.substring(key.length + 1);
					key = key.trim();
					if (value.charAt(0) == '"') {
						value = JSON.parse(value);
					}
					if (key == "type") {
						key = "mediaType";
					}
					linkObj[key] = value;
				}
				thisRequest.document.raw.addLink(linkObj);
			}
		}

		thisRequest.checkForFullResponse();
		if (!thisRequest.circular) {
			thisRequest.document.raw.whenSchemasStable(function () {
				var rootLink = thisRequest.document.raw.getLink("root");
				if (rootLink != undefined) {
					var fragment = decodeURI(rootLink.href.substring(rootLink.href.indexOf("#") + 1));
					thisRequest.document.setRoot(fragment);
				} else {
					thisRequest.document.setRoot("");
				}
			});
		} else {
			thisRequest.document.setRoot("");
		}
	},
	ajaxError: function (error, data) {
		this.fetched = true;
		var thisRequest = this;
		thisRequest.successful = false;
		thisRequest.error = error;
		Utils.log(Utils.logLevel.WARNING, "Error fetching: " + this.url + " (" + error.message + ")");
		thisRequest.document.error = error;
		thisRequest.document.setRaw(data);
		thisRequest.document.raw.whenSchemasStable(function () {
			thisRequest.checkForFullResponse();
			thisRequest.document.setRoot("");
		});
	},
	fetchData: function(url, method, data, encType, hintSchema) {
		var thisRequest = this;
		var xhrUrl = url;
		var xhrData = data;
		if ((method == "GET" || method == "DELETE") && (xhrData != undefined && xhrData != "")) {
			if (xhrUrl.indexOf("?") == -1) {
				xhrUrl += "?";
			} else {
				xhrUrl += "&";
			}
			xhrUrl += xhrData;
			xhrData = undefined;
		}
		if (publicApi.config.antiCacheUrls) {
			var extra = "_=" + Math.random();
			if (xhrUrl.indexOf("?") == -1) {
				xhrUrl += "?" + extra;
			} else {
				xhrUrl += "&" + extra;
			}
		}
		
		var params = {
			url: xhrUrl,
			data: xhrData,
			encType: encType,
            method: method

        };
		publicApi.ajaxFunction(params, function (error, data, headers) {
			if (!error) {
				thisRequest.ajaxSuccess(data, headers, hintSchema);
			} else {
				thisRequest.ajaxError(new HttpError(xhr.status, xhr), data);
			}
		});
	}
};

function RequestFake(url, rawData, schemaUrl, cacheFunction, cacheKey) {
	cacheFunction(cacheKey, this);

	var thisRequest = this;
	this.url = url;
	
	this.responseListeners = new ListenerSet(this);
	this.document = new Document(url, true, true);
	this.document.setRaw(rawData);
	this.profileUrl = schemaUrl;
	if (schemaUrl != undefined) {
		this.document.raw.addSchema(schemaUrl);
	}
	if (url == schemaUrl) {
		this.document.setRoot("");
	} else {
		this.document.raw.whenSchemasStable(function () {
			var rootLink = thisRequest.document.raw.getLink("root");
			if (rootLink != undefined) {
				var fragment = decodeURI(rootLink.href.substring(rootLink.href.indexOf("#") + 1));
				thisRequest.document.setRoot(fragment);
			} else {
				thisRequest.document.setRoot("");
			}
		});
	}
	this.successful = true;
	this.error = null;

	this.fetched = false;
	this.invalidate = function() {
		this.fetchData(url, "GET", undefined, "application/x-www-form-urlencoded", schemaUrl);
	};
}
RequestFake.prototype = Request.prototype;

