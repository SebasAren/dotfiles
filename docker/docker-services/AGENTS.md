# Docker Services

Manages 6 self-hosted services via docker-compose. Each service is standalone with its own compose file and directory.

## Services

| Service | Compose | Image | Port | Network |
|---------|---------|-------|------|---------|
| jellyfin | `.yml` | jellyfin/jellyfin | 8096 | nginx (external) |
| audiobookshelf | `.yaml` | ghcr.io/advplyr/audiobookshelf:latest | 13378 | nginx (external) |
| nginx-proxy-manager | `.yaml` | jc21/nginx-proxy-manager:latest | 8000, 8100 (admin) | nginx (external) |
| transmission | `.yml` | haugene/transmission-openvpn | 9091, 8118 (proxy) | bridge |
| wolf | `.yaml` | ghcr.io/games-on-whales/wolf:stable | 47984+ | bridge |
| komga | `.yml` | gotson/komga:latest | 25600 | nginx (external) |

## Volume Labels

| Label | Meaning | When to use |
|-------|---------|-------------|
| `:U,z` | Auto SELinux context, writable | Config/data volumes the container writes to |
| `:ro,z` | Read-only, SELinux context | Media mounts (preferred) |
| `:ro` | Read-only, no SELinux label | Non-SELinux systems or audiobookshelf (legacy) |

Media source paths: `/var/stash/media` and `/var/stash2/media`.

## Networks

**nginx** (external): Shared by jellyfin, audiobookshelf, nginx-proxy-manager so NPM can reverse-proxy to them. Create it once:
```bash
docker network create nginx
```

**bridge** (default): transmission, wolf — not proxied through NPM.

## VPN Setup (transmission)

Uses `haugene/transmission-openvpn`. Requires:
- `.env` file with: `OPENVPN_PROVIDER`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD`, `OPENVPN_CONFIG`, `LOCAL_NETWORK`, `TRANSMISSION_PEER_PORT`
- VPN config files in `transmission/vpn/` (mounted to `/etc/openvpn/custom`)
- Privileged: `cap_add: NET_ADMIN`, device `/dev/net/tun`

## Commands

```bash
cd docker/docker-services/<service>

docker compose up -d        # Start
docker compose down          # Stop
docker compose pull          # Update images
docker compose up -d         # Restart with new images
docker logs <container>      # View logs
```

## Notes

- Extension inconsistency: jellyfin and transmission use `.yml`, others `.yaml`. Don't normalize.
- audiobookshelf volumes lack `:z` label — may fail on strict SELinux systems.
- transmission hardcodes `PUID=1000 PGID=1000`.
- wolf requires host device access (`/dev/`, `/run/udev`, docker.sock) — essentially privileged.
- No Tailscale integration — services are not exposed via tailnet.
