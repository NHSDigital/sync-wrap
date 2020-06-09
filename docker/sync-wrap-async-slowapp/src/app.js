"use strict";

const express = require("express");
const app = express();
const log = require("loglevel");


function setup(options) {
    options = options || {};
    app.locals.upstream = new URL(options.UPSTREAM || "http://localhost");
    app.locals.base_path = app.locals.upstream.pathname === "/" ? "" : app.locals.upstream.pathname;
    log.setLevel(options.LOG_LEVEL || "info");
    log.info("configured with: " + options.UPSTREAM);
    app.locals.allow_insecure = (options.ALLOW_INSECURE || "false") === "true";
    app.locals.unbotli = (options.UNBOTLI || "false") === "true";
    app.locals.max_sleep = parseFloat(options.MAX_SLEEP || 5);
    app.locals.default_syncwait = parseFloat(options.DEFAULT_SYNCWAIT || 5);
    let keepalive = (options.KEEPALIVE || "true") === "true";

    let https = app.locals.upstream.protocol === "https:";


    let default_options = {
        host: app.locals.upstream.hostname,
        port: app.locals.upstream.port
    };

    if (keepalive) {
        let Agent = https ? require("agentkeepalive").HttpsAgent : require("agentkeepalive");

        default_options.agent = new Agent({
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 900000, // active socket keepalive for 15 mins ?
            freeSocketTimeout: 30000 // free socket keepalive for 30 seconds
        });
    }

    if (app.locals.allow_insecure) {
        default_options.rejectUnauthorized = false;
    }

    app.locals.default_options = default_options;
    app.locals.conn = https ? require("https") : require("http");
}

function start(options) {
    options = options || {};
    let server = app.listen(options.PORT || 9000, () => {
        log.info("server listening on port %d", server.address().port);
    });
    return server;
}

const handlers = require("./handlers");
app.get("/_status", handlers.ping);
app.get("/health", handlers.ping);
app.all("*", handlers.proxy);


module.exports = {start: start, setup: setup};