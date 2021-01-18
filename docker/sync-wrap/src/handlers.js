"use strict";

const log = require("loglevel");
const querystring = require("querystring");
const util = require("util");
const stream = require("stream");
const pipeline = util.promisify(stream.pipeline);
const zlib = require("zlib");


Object.defineProperty(Object.prototype, "isEmpty", {
        enumerable: false,
        configurable: true,
        value: function() {
            for (const prop in this) if (this.hasOwnProperty(prop)) return false;
            return true;
        }
    }
);

Object.defineProperty(Array.prototype, "isEmpty", {
        enumerable: false,
        configurable: true,
        value: function () {
            return this.length === 0;
        }
    }
);

Object.defineProperty(Object.prototype, "values", {
        enumerable: false,
        configurable: true,
        value: function() {
            let self = this;
            return Object.keys(self).map(key => {return self[key]});
        }
    }
);


Object.defineProperty(Array.prototype, "asMultiValue", {
        enumerable: false,
        configurable: true,
        value: function() {
            return new MultiValueHeaders(this)
        }
    }
);

Object.defineProperty(Array.prototype, "logHeaders", {
        enumerable: false,
        configurable: true,
        value: function() {
            let lines = [];
            this.forEach((val, index, arr) => {
                if (index % 2 === 0) return;
                let key = arr[index - 1];
                lines.push(`${key}: ${val}`);
            });
            return lines
        }
    }
);

Object.defineProperty(Array.prototype, "parseCookies", {
        enumerable: false,
        configurable: true,
        value: function() {
            let cookies = {};
            this.forEach((cookie) => {
                let name_value = cookie.split(";")[0];
                let name = name_value.split("=")[0].trim();
                cookies[name] = cookie;
            });
            return cookies;
        }
    }
);

class MultiValueHeaders {
    constructor(rawHeaders = undefined) {
        if (rawHeaders !== undefined) {
            rawHeaders.forEach((val, index, arr) => {
                if (index % 2 === 0) return;
                let key = arr[index - 1];
                this.set(key, val);
            });
        }
    }

    set(key, val) {
        key = key.toLowerCase();
        if (!this.hasOwnProperty(key)) {
            this[key] = val;
            return this;
        }
        let current = this[key];
        if (Array.isArray(current)){
            current.push(val);
            return this;
        }
        this[key] = [current, val];
        return this;
    }

    overwrite(key, val) {
        this[key] = val;
        return this;
    }

    get(header) {
        header = header.toLowerCase();
        return this[header];
    }

    has(header) {
        header = header.toLowerCase();
        return header in this;
    }

    remove(header) {
        if (typeof header !== "string") {
            return
        }
        header = header.toLowerCase();
        if (header in this) {
            delete this[header]
        }
    }

    clone() {
        let clone = new MultiValueHeaders();

        for(const header in this) {
            if (!this.hasOwnProperty(header)) {
                continue
            }
            let val = this[header];
            if (Array.isArray(val)) {
                val = [...val]  // clone array
            }
            clone.set(header, val);
        }
        return clone;
    }

    printableHeaders() {
        let lines = [];
        for(const header in this) {
            if (!this.hasOwnProperty(header)) {
                continue
            }
            let val = this[header];
            if (Array.isArray(val)) {
                val.forEach(subval => {
                    lines.push(`${header} ${subval}`);
                });
            } else {
                lines.push(`${header}:${val}`);
            }
        }
        return "\n" + lines.join("\n");
    }

    withNewCookies(new_cookies, property = "set-cookie") {
        if (new_cookies === undefined || new_cookies.isEmpty()) {
            return this;
        }
        if (new_cookies instanceof MultiValueHeaders) {
            new_cookies = new_cookies.cookies(property);
        }
        if (Array.isArray(new_cookies)) {
            new_cookies = new_cookies.parseCookies()
        }
        let cookies = Object.assign(
            this.cookies(property), new_cookies
        );
        this[property] = cookies.values();
        return this
    }

    withPreviousCookies(prev_cookies, property = "set-cookie") {
        if (prev_cookies === undefined || prev_cookies.isEmpty()) {
            return this;
        }
        if (prev_cookies instanceof MultiValueHeaders) {
            prev_cookies = prev_cookies.cookies(property);
        }
        if (Array.isArray(prev_cookies)) {
            prev_cookies = prev_cookies.parseCookies()
        }
        let cookies = Object.assign({}, prev_cookies);
        cookies = Object.assign(cookies, this.cookies(property));
        this[property] = cookies.values();
        return this;
    }

    cookies (property) {
        return MultiValueHeaders._parseCookieOrArray(this[property])
    }

    static _parseCookieOrArray(obj_or_arr) {
        if(obj_or_arr === undefined || obj_or_arr.isEmpty()) {
            return {}
        }
        if (!Array.isArray(obj_or_arr)) {
            obj_or_arr = [obj_or_arr]
        }
        return obj_or_arr.parseCookies()
    }

}

const lazy_log = (res, log_level, options = {}) => {
    if (log.getLevel()>log.levels[log_level.toUpperCase()]) {
        return
    }
    if (typeof options === "function") {
        options = options()
    }
    let log_line = {
        timestamp: Date.now(),
        level: log_level,
        correlation_id: res.locals.correlation_id
    }
    if (typeof options === 'object') {
        options = Object.keys(options).reduce(function(obj, x) {
            let val = options[x]
            if (typeof val === "function") {
                val = val()
            }
            obj[x] = val;
            return obj;
        }, {});
        log_line = Object.assign(log_line, options)
    }
    if (Array.isArray(options)) {
        log_line["log"] = {log: options.map(x=> {return typeof x === "function"? x() : x })}
    }

    log[log_level](JSON.stringify(log_line))
};

const sleep = (delay) => {
    return new Promise(resolve => {
        setTimeout(resolve, delay)
    });
};

function ping_response(req) {
    return {
        status: "pass",
        ping: "pong",
        service: req.app.locals.app_name,
        _version: req.app.locals.version_info
    }
}

async function ping(req, res, next) {
    res.locals.handled = true;
    res.json(ping_response(req));
    res.end();
    next();
}

async function status(req, res, next) {
    res.locals.status = true;

    let response = ping_response(req);

    // response.upstream.name = "self";
    // to_do check upstream ?

    res.json(response);
    res.end();
    next();
}


async function proxy(req, res, next) {

    if (res.locals.handled) {
        // this request will have been handled, but has also match the 'catch all'
        next();
        return;
    }

    async function send_response(status, options = {}) {

        let debotli = false;

        let error = options.error;
        let headers = options.headers;
        let response_stream = options.response;

        res.status(status);
        if(headers !== undefined && !res.headersSent){
            // apigee doesn't support botli content encoding for some reason, it sets the encoding to gzip
            debotli = locals.unbotli && headers["content-encoding"] === "br";
            if (debotli) {
                headers["content-encoding"] = "gzip";
                headers.remove("content-length");
            }
            res.set(headers);
        }

        if (response_stream === undefined) {
            res.end();
            next(error);
            return
        }

        if (debotli) {
            await pipeline(response_stream, zlib.createBrotliDecompress(), zlib.createGzip(), res).then(next).catch(next);
        }
        else {
            await pipeline(response_stream, res).then(next).catch(next);
        }
    }
    
    let locals = req.app.locals;

    let conn = locals.conn;

    let query =  Object.assign({}, req.query);

    let syncWait = locals.default_syncwait;


    let path = query.isEmpty() ? `${locals.base_path}${req.params[0]}` : `${locals.base_path}${req.params[0]}?${querystring.stringify(query)}`;

    let headers = req.rawHeaders.asMultiValue();


    if (headers.has('X-Sync-Wait')) {
        syncWait = headers.get('X-Sync-Wait');
        if(isNaN(syncWait)){
            res.status(400);
            res.json({
                err: "x-sync-wait should be a number between 0.25 and 29"
            });
            next();
            return;
        }
        syncWait = parseFloat(syncWait);
        if (syncWait < 0.25 || syncWait > 29) {
            res.status(400);
            res.json({
                err: "x-sync-wait should be a number between 0.25 and 29"
            });
            next();
            return;
        }
        headers.remove('X-Sync-Wait');
    }

    delete headers.host;
    // should we hide this ?
    headers.set("X-Forwarded-For", req.connection.remoteAddress);
    headers.remove("x-sync-wrapped")
    headers.set("x-sync-wrapped", "true");

    let respond_async = headers.prefer === "respond-async";


    let options = Object.assign(
        {
            path: path,
            method: req.method,
            headers: headers,
            timeout: Math.floor(syncWait*1000),
            respond_before: new Date(new Date().getTime() + Math.floor(syncWait*1000)),
            received_cookies: {}
        },
        locals.default_options
    );

    async function make_request(opts, request_stream = undefined) {
        // Return new promise
        return new Promise(async (resolve, reject) => {

            let request = conn.request(opts);
            let started_at = Date.now();
            let url = new URL(`${req.app.locals.upstream}${opts.path}`);
            let base_log_entry = {
                upstream: req.app.locals.upstream,
                correlation_id: res.locals.correlation_id,
                started: res.locals.started_at,
                req: {
                    method: opts.method,
                    url: opts.path,
                    path: url.pathname,
                    query: url.search,
                    headers: opts.headers
                }
            };

            request.on("timeout", () => {
                let finished_at = Date.now();
                let timeout = opts.timeout || 5000;
                lazy_log(res,"warn", ()=> (Object.assign({
                    type: "upstream_timeout",
                    finished: finished_at,
                    duration: finished_at - started_at,
                    timeout: timeout / 1000
                }, base_log_entry)));
                // todo: should we abort the request ???
                reject({error: "timeout"});
            });

            request.on("response", response => {
                let finished_at = Date.now();
                lazy_log(res,"debug", ()=> (Object.assign({
                    type: "upstream_request",
                    finished: finished_at,
                    duration: finished_at - started_at,
                    res: {
                        status: response.statusCode,
                        message: response.statusMessage,
                        headers: response.rawHeaders.asMultiValue()
                    }
                }, base_log_entry)));
                resolve({
                    options: opts,
                    response: response,
                    headers: response.rawHeaders.asMultiValue()
                });
            });

            request.on("error", err => {
                let finished_at = Date.now();
                lazy_log(res,"error", ()=> (Object.assign({
                    type: "upstream_error",
                    finished: finished_at,
                    duration: finished_at - started_at,
                    err: err
                }, base_log_entry)));
                reject({error: err, opts: opts})
            });

            if (request_stream !== undefined) {
                await pipeline(req, request).catch(reject);
            }
            else {
                request.end();
            }
        })
    }

    async function poll_async(options) {

        let remaining_timeout = options.respond_before.getTime() - (new Date()).getTime();

        if (remaining_timeout < 10) {
            let prev_cookies = options.received_cookies.values();
            let timeout_headers = prev_cookies.length === 0 ? undefined : ["set-cookie", prev_cookies];
            await send_response(504, {headers: timeout_headers});
            return
        }

        await sleep(Math.min(options.sleep, remaining_timeout));

        remaining_timeout = options.respond_before.getTime() - (new Date()).getTime();
        options.timeout = Math.max(remaining_timeout, 50000);


        options.sleep = Math.min(2*options.sleep, 1000*locals.max_sleep);

        // todo: should look at using a cookie jar to check expired etc ??
        options.headers.withNewCookies(options.received_cookies, "cookie");


        await make_request(options)
            .then(async (outcome) => {
                let response = outcome.response;
                let headers = outcome.headers.withPreviousCookies(outcome.options.received_cookies);
                if (outcome.response.statusCode === 202 && headers.has("content-location")) {
                    outcome.options.last_response = response;
                    outcome.options.last_headers = headers;
                    outcome.options.received_cookies = headers.cookies("set-cookie");
                    await poll_async(outcome.options);
                    return
                }
                await send_response(response.statusCode, {headers: headers, response: response});
            })
            .catch(async (fin) => {
                if (fin.error === "timeout") {
                    let response = options.last_response;
                    let headers = options.last_headers.withPreviousCookies(options.received_cookies);
                    await send_response(response.statusCode, {headers: headers, response: response});
                    return
                }
                let prev_cookies = options.received_cookies.values();
                let headers = prev_cookies.length === 0 ? undefined : ["set-cookie", prev_cookies];
                await send_response(502, {headers: headers, error: fin.error});
            });
    }

    await make_request(options, req)
        .then(async (outcome) => {
            let response = outcome.response;
            let headers = outcome.headers;
            if (!respond_async && outcome.response.statusCode === 202 && headers.has("content-location")) {
                let poll_options = Object.assign({}, outcome.options);
                let poll_location = new URL(headers.get("content-location"));
                poll_options.path = poll_location.pathname + poll_location.search;
                poll_options.headers = options.headers.clone();
                poll_options.method = "GET";
                poll_options.headers.remove("content-length");
                poll_options.sleep = 250;
                poll_options.last_response = response;
                poll_options.last_headers = headers;
                poll_options.received_cookies = headers.cookies("set-cookie");
                await poll_async(poll_options);
                return
            }
            await send_response(response.statusCode, {headers: headers, response: response});
        })
        .catch(async (fin) => {
            await send_response(fin.error === "timeout" ? 504 : 502, {headers: headers, error: fin.error});
        });

}


module.exports = {
    status: status,
    ping: ping,
    proxy: proxy
};
