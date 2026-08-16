#!/bin/sh
set -eu

cd /workspace/apps/api

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  prisma migrate deploy
fi

exec "$@"
