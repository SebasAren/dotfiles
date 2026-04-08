---
description: Docker/Podman conventions for docker-services
---

- **Use podman, not docker** — all containers run via rootless podman (`podman compose`)
- **Do NOT set `user:` in docker-compose.yml** — rootless podman maps host UID 1000 → container UID 0. Setting `user: "1000:1000"` makes the process run as an unprivileged sub-UID that can't write to mounted volumes. Rootless podman already provides the security boundary.
- **`version:` key is obsolete** in docker-compose.yml and should be removed
