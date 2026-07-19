#!/bin/sh
set -eu

node migrations/run.js
exec node src/hub/server.js
