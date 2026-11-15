#!/bin/sh
# SABnzbd runs this after repair and unpack.
[ "${SAB_CAT:-${5:-}}" = music ] || exit 0
if [ -n "${SAB_STATUS:-}" ]; then
    [ "$SAB_STATUS" = completed ] || exit 0
else
    [ "${7:-1}" = 0 ] || exit 0
fi
touch /config/scripts/encore-music.pending
