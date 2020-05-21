"use strict";

const app = require("./app");


app.setup(process.env);


const server = app.start(process.env);

module.exports = {server: server};