'use strict';

Object.defineProperty(Object.prototype, "isEmpty", {
        enumerable: false,
        value: function() {
            for (let prop in this) if (this.hasOwnProperty(prop)) return false;
            return true;
        }
    }
);

Object.defineProperty(Array.prototype, "isEmpty", {
        enumerable: false,
        value: function () {
            return this.length === 0;
        }
    }
);

Object.defineProperty(Object.prototype, "values", {
        enumerable: false,
        value: function() {
            let self = this;
            return Object.keys(self).map(key => {return self[key]});
        }
    }
);


Object.defineProperty(Array.prototype, "asMultiValue", {
        enumerable: false,
        value: function() {
            return new MultiValueHeaders(this)
        }
    }
);


Object.defineProperty(Array.prototype, "parseCookies", {
        enumerable: false,
        value: function() {
            let cookies = {};
            this.forEach((cookie, index, arr) => {
                let name_value = cookie.split(';')[0];
                let name = name_value.split('=')[0].trim();
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

    withNewCookies(new_cookies, property = 'set-cookie') {
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

    withPreviousCookies(prev_cookies, property = 'set-cookie') {
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

async function ping(req, res) { res.json({ping: "pong"}); }

const log = require('loglevel');


async function proxy(proxy_req, proxy_resp) {

    let querystring = require('querystring');
    let util = require('util');
    let stream = require('stream');
    const pipeline = util.promisify(stream.pipeline);

    let conn = proxy_req.app.locals.conn;

    let query =  Object.assign({}, proxy_req.query);

    let syncWait = 5;  // default

    if ('syncWait' in query) {
        if(isNaN(query.syncWait)){
            proxy_resp.status(400);
            proxy_resp.json({
                err: "syncWait should be a number between 0.25 and 900"
            });
            return
        }
        syncWait = parseFloat(query.syncWait);
        if (syncWait < 0.25 || syncWait > 900) {
            proxy_resp.status(400);
            proxy_resp.json({
                err: "syncWait should be a number between 0.25 and 900"
            });
            return
        }
        delete query.syncWait;
    }

    let path = query.isEmpty() ? proxy_req.params[0] : proxy_req.params[0] + '?' + querystring.stringify(query);

    let headers = proxy_req.rawHeaders.asMultiValue();

    delete headers.host;
    headers.set('X-Forwarded-For', proxy_req.connection.remoteAddress);

    let respond_async = headers.prefer === "respond-async";

    log.info(proxy_req.method + ' ' + path);

    let options = Object.assign(
        {
            path: path,
            method: proxy_req.method,
            headers: headers,
            timeout: Math.floor(syncWait*1000),
            respond_before: new Date(new Date().getTime() + Math.floor(syncWait*1000)),
            received_cookies: {}
        },
        proxy_req.app.locals.default_options
    );

    const sleep = (delay) => {
        return new Promise(resolve => {
            setTimeout(resolve, delay)
        });
    };

    async function make_request(opts, request_stream = undefined) {
        // Return new promise
        return new Promise(async (resolve, reject) => {

            let request = conn.request(opts);

            request.on('timeout', () => {
                let timeout = opts.timeout || 5000;
                log.warn("timeout! " + (timeout / 1000) + " seconds expired");
                // todo: should we abort the request ???
                reject({error: 'timeout'});
            });

            request.on('response', response => {
                resolve({
                    options: opts,
                    response: response,
                    headers: response.rawHeaders.asMultiValue()
                });
            });

            request.on('error', err => {
                reject({error: err})
            });

            if (request_stream !== undefined) {
                await pipeline(proxy_req, request);
            }
            else {
                request.end();
            }
        })
    }


    async function poll_async(options) {

        let timeout = options.respond_before.getTime() - (new Date()).getTime();

        if (timeout < 10) {
            let response = options.last_response;
            proxy_resp.status(response.statusCode);
            proxy_resp.set(options.last_headers);
            await pipeline(response, proxy_resp);
            return
        }

        await sleep(options.sleep);

        timeout = options.respond_before.getTime() - (new Date()).getTime();
        options.timeout = timeout;

        if (timeout < 10) {
            let response = options.last_response;
            proxy_resp.status(response.statusCode);
            proxy_resp.set(options.last_headers);
            await pipeline(response, proxy_resp);
            return
        }

        options.sleep = Math.min(2*options.sleep, 5000);

        // todo: should look at using a cookie jar to check expired etc ??
        options.headers.withNewCookies(options.received_cookies, 'cookie');


        await make_request(options)
            .then(async (outcome) => {
                let response = outcome.response;
                let headers = outcome.headers.withPreviousCookies(outcome.options.received_cookies);
                if (outcome.response.statusCode === 202 && headers.has('content-location')) {
                    outcome.options.last_response = response;
                    outcome.options.last_headers = headers;
                    outcome.options.received_cookies = headers.cookies('set-cookie');
                    await poll_async(outcome.options);
                    return
                }
                proxy_resp.status(response.statusCode);
                proxy_resp.set(headers);
                await pipeline(response, proxy_resp);
            })
            .catch(async (fin) => {
                log.error(fin.error);

                if (fin.error === "timeout") {
                    let response = options.last_response;
                    proxy_resp.status(response.statusCode);
                    proxy_resp.set(options.last_headers.withPreviousCookies(options.received_cookies));
                    await pipeline(response, proxy_resp);
                    return
                }
                proxy_resp.status(502);
                proxy_resp.end();
            });
    }

    await make_request(options, proxy_req)
        .then(async (outcome) => {
            let response = outcome.response;
            let headers = outcome.headers;
            if (!respond_async && outcome.response.statusCode === 202 && headers.has('content-location')) {
                let poll_options = Object.assign({}, outcome.options);
                let poll_location = new URL(headers.get('content-location'));
                poll_options.path = poll_location.pathname + poll_location.search;
                poll_options.headers = options.headers.clone();
                poll_options.method = 'GET';
                poll_options.headers.remove('content-length');
                poll_options.sleep = 250;
                poll_options.last_response = response;
                poll_options.last_headers = headers;
                poll_options.received_cookies = headers.cookies('set-cookie');
                await poll_async(poll_options);
                return
            }
            proxy_resp.status(response.statusCode);
            proxy_resp.set(headers);
            await pipeline(response, proxy_resp);
        })
        .catch(async (fin) => {
            log.error(fin.error);
            proxy_resp.status(fin.error === "timeout" ? 504 : 502);
            proxy_resp.end();
        });

}


module.exports = {
    ping: ping,
    proxy: proxy
};
