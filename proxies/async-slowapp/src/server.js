"use strict";

const express = require("express");
const app = express();
const log = require("loglevel");

function setup(options) {
    log.setLevel(options.LOG_LEVEL || "info");
    app.locals.tracked = {};
    app.locals.secure = (options.SECURE || "false") === "true";
}

setup(process.env);

const handlers = require("./handlers");
app.get("/_ping", handlers.ping);
app.get("/slow", handlers.slow);
app.delete("/poll", handlers.delete_poll);
app.get("/poll", handlers.poll);


const server = app.listen(process.env.PORT || 9000, () => {
    log.info("server listening on port %d", server.address().port);
});

module.exports = {server: server, setup: setup};