"use strict";

const log = require("loglevel");
const { v4: uuidv4 } = require('uuid');
const util = require("util");
const stream = require("stream");
const pipeline = util.promisify(stream.pipeline);



Object.defineProperty(Object.prototype, "isEmpty", {
        enumerable: false,
        value: function() {
            for (const prop in this) if (this.hasOwnProperty(prop)) return false;
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

Object.defineProperty(Array.prototype, "printableHeaders", {
        enumerable: false,
        value: function() {
            let lines = [];
            this.forEach((val, index, arr) => {
                if (index % 2 === 0) return;
                let key = arr[index - 1];
                lines.push(`${key}: ${val}`);
            });
            return "\n" + lines.join("\n");
        }
    }
);

Object.defineProperty(Array.prototype, "parseCookies", {
        enumerable: false,
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

const sleep = (delay) => {
    return new Promise(resolve => {
        setTimeout(resolve, delay)
    });
};

function lazy_debug(...msg_or_func) {
    if (log.getLevel()>1) {
        return
    }
    let msgs = msg_or_func.map(x=> {return typeof x === "function"? x() : x });
    log.debug(...msgs, "\n");
}

async function ping(req, res) { res.json({ping: "pong"}); }

async function get_slow(req, res) {


    log.info("slow", req.url, "\n");
    lazy_debug("slow", req.method, req.url, ()=> req.rawHeaders.printableHeaders());

    let locals = req.app.locals;

    let delay = req.query.delay;

    if (delay !== undefined) {
        delay = parseFloat(delay);
        await sleep(delay*1000);
    }

    let poll_id = uuidv4();

    let complete_in = req.query.complete_in || 5;
    let final_status = req.query.final_status || 200;

    let finish_at = new Date(new Date().getTime() + parseFloat(complete_in) * 1000);

    locals.tracked[poll_id] = {finish_at: finish_at, final_status: parseInt(final_status)};

    let location = `${locals.secure?'https':'http'}://${req.headers.host}/poll?id=${poll_id}`;

    let headers = new MultiValueHeaders([
        "Content-Type", "application/json",
        "Content-Location", location
    ]);
    headers.withNewCookies({"poll-count": "poll-count=0"});

    res.status(200);
    res.set(headers);
    res.end()


}

async function delete_poll(req, res) {
    let poll_id = req.query.id;
    let locals = req.app.locals;

    if (!(poll_id in locals.tracked)) {
        res.status(404);
        res.end();
        return;
    }

    delete locals.tracked[poll_id];
    res.status(200);
    res.end()
}


async function poll(req, res) {

    let poll_id = req.query.id;
    let headers = req.rawHeaders.asMultiValue();
    let cookies = headers.cookies('cookie');
    let locals = req.app.locals;

    let poll_count = cookies['poll-count'];

    if (poll_count !== undefined) {
        poll_count = (parseInt(poll_count.split('=')[1]) + 1).toString();
    }

    if (!(poll_id in locals.tracked)) {
        res.status(404);
        res.end();
        return;
    }


    let tracking = locals.tracked[poll_id];

    if (new Date() < tracking.finish_at) {
        res.status(202);
        res.set({'Content-Location': `${locals.secure?'https':'http'}://${req.headers.host}/poll?id=${poll_id}`});
        res.end();
    }

    let resp_headers = new MultiValueHeaders();

    if (poll_count !== undefined) {
        resp_headers.withNewCookies({"poll-count": `poll-count=${poll_count}`}, 'set-cookie');
    }

    delete locals.tracked[poll_id];

    res.status(tracking.final_status);
    res.set(resp_headers);
    res.end();
}

module.exports = {
    ping: ping,
    slow: get_slow,
    delete_poll: delete_poll,
    poll: poll
};
