# Security headers (policy §9).
#
# nginx's `add_header` does not merge: a location block that declares one drops
# every header inherited from the server block. This snippet is therefore included
# in each location that sets a header of its own, so none of them can be lost.

add_header X-Content-Type-Options "nosniff"     always;
add_header X-Frame-Options        "SAMEORIGIN"  always;
add_header Referrer-Policy        "no-referrer" always;
add_header Permissions-Policy     "geolocation=(), microphone=(), camera=()" always;
