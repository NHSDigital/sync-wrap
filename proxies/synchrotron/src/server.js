
const express = require('express');
const app = express();
const log = require('loglevel');


function setup(options) {
    app.locals.upstream = new URL(options.UPSTREAM || "http://localhost");
    log.setLevel(options.LOG_LEVEL || "info");
    log.info('configured with: ' + options.UPSTREAM);
    app.locals.allow_insecure = (options.ALLOW_INSECURE || "false") === "true";

    let https = app.locals.upstream.protocol === "https:";

    let Agent = https ? require('agentkeepalive').HttpsAgent : require('agentkeepalive');
    let agent = new Agent({
        maxSockets: 100,
        maxFreeSockets: 10,
        timeout: 900000, // active socket keepalive for 15 mins ?
        freeSocketTimeout: 30000, // free socket keepalive for 30 seconds
    });

    let default_options = {
        host: app.locals.upstream.hostname,
        port: app.locals.upstream.port,
        agent: agent
    };

    if (app.locals.allow_insecure) {
        default_options['rejectUnauthorized'] = false;
    }

    app.locals.default_options = default_options;
    app.locals.conn = https ? require("https") : require("http");
}

setup(process.env);

const handlers = require("./handlers");
app.get('/ping', handlers.ping);
app.all('/sync*', handlers.proxy);


const server = app.listen(process.env.PORT || 9000, function() {
    log.setDefaultLevel("info");
    log.info('server listening on port %d', server.address().port);
});

module.exports = {server: server, setup: setup};