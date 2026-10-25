FROM postgres:16-alpine
RUN apk add --no-cache rclone curl
COPY backup-loop.sh /usr/local/bin/backup-loop.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/backup-loop.sh"]
