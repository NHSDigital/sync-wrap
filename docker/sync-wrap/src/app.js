"use strict";

const express = require("express");
const app = express();
const log = require("loglevel");
const uuid = require('uuid');


function stripchars(str, chars) {
    var start = 0,  end = str.length;

    while(start < end && chars.indexOf(str[start]) >= 0)
        ++start;

    while(end > start && chars.indexOf(str[end - 1]) >= 0)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}


function setup(options) {
    options = options || {};
    app.locals.app_name = options.APP_NAME || 'sync-wrap';
    let upstream = stripchars(options.UPSTREAM || 'http://localhost:9003', ': /');
    upstream = upstream.startsWith('http') ? upstream : `https://${upstream}`
    app.locals.upstream = new URL(upstream);
    app.locals.version_info = JSON.parse(options.VERSION_INFO || '{}');
    app.locals.base_path = app.locals.upstream.pathname === "/" ? "" : app.locals.upstream.pathname;
    log.setLevel(options.LOG_LEVEL || "info");
    app.locals.allow_insecure = (options.ALLOW_INSECURE || "false") === "true";
    app.locals.unbotli = (options.UNBOTLI || "false") === "true";
    app.locals.max_sleep = parseFloat(options.MAX_SLEEP || 5);
    app.locals.default_syncwait = parseFloat(options.DEFAULT_SYNCWAIT || 5);

    let https = app.locals.upstream.protocol === "https:";

    app.locals.conn = https ? require("https") : require("http");

    let default_options = {
        host: app.locals.upstream.hostname,
        port: app.locals.upstream.port
    };

    if (app.locals.allow_insecure) {
        default_options.rejectUnauthorized = false;
    }

    app.locals.default_options = default_options;

    log.info(JSON.stringify({
        timestamp: Date.now(),
        level: "info",
        app: app.locals.app_name,
        msg: "setup",
        upstream: options.UPSTREAM,
        version:  app.locals.version_info
    }));
}

function start(options) {
    options = options || {};
    let server = app.listen(options.PORT || 9000, () => {
        log.info(JSON.stringify({
            timestamp: Date.now(),
            level: "info",
            app: app.locals.app_name,
            msg: "startup",
            server_port: server.address().port,
            version:  app.locals.version_info
        }))
    });
    return server;
}

function before_request(req, res, next) {
    res.locals.started_at = Date.now();
    res.locals.correlation_id = (
        req.header('X-Correlation-ID')
        || req.header('Correlation-ID')
        || req.header('CorrelationID')
        || uuid.v4()
    );
    next();
}

const _health_endpoints = ["/_ping", "/health"];

function after_request(req, res, next) {
    if (_health_endpoints.includes(req.path) && !('log' in Object.assign({}, req.query))) {
        // don't log ping / health by default
        return next();
    }
    let finished_at = Date.now();
    let log_entry = {
        timestamp: finished_at,
        level: "info",
        app: app.locals.app_name,
        msg: "request",
        correlation_id: res.locals.correlation_id,
        started: res.locals.started_at,
        finished: finished_at,
        duration: finished_at - res.locals.started_at,
        req: {
            url: req.url,
            method: req.method,
            query: req.query,
            path: req.path,
        },
        res: {
            status: res.statusCode,
            message: res.message
        },
        version: app.locals.version_info
    };

    if (log.getLevel()<2) {
        // debug
        log_entry.req.headers = (req.rawHeaders || []).asMultiValue();
        log_entry.res.headers = (res.rawHeaders || []).asMultiValue();
    }
    log.info(JSON.stringify(log_entry));

    next();

}

function on_error(err, req, res, next) {
    let log_err = err;
    if (log_err instanceof Error) {
        log_err = {
            name: err.name,
            message: err.message,
            stack: err.stack
        }
    }
    let finished_at = Date.now();
    log.error(JSON.stringify({
        timestamp: finished_at,
        level: "error",
        app: app.locals.app_name,
        msg: "error",
        correlation_id: res.locals.correlation_id,
        started: res.locals.started_at,
        finished: finished_at,
        duration: finished_at - res.locals.started_at,
        err: log_err,
        version:  app.locals.version_info
    }));
    if (res.headersSent) {
        next();
        return;
    }
    res.status(500);
    res.json({error: "something went wrong" });
    next();
}

const handlers = require("./handlers");
app.use(before_request);
app.get("/_ping", handlers.ping);
app.get("/_status", handlers.status);
app.get("/health", handlers.ping);
app.all("*", handlers.proxy);
app.use(on_error)
app.use(after_request);

module.exports = {start: start, setup: setup};