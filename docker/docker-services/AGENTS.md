# Docker Services AGENTS.md

## OVERVIEW

Manages 5 media services via docker-compose in `docker/docker-services/`. Each service is standalone with its own compose file.

## STRUCTURE

```
docker/docker-services/
  jellyfin/         # Media server (TV, movies, music)
  audiobookshelf/   # Audiobooks and podcasts
  nginx-proxy-manager/  # Reverse proxy with GUI
  transmission/     # BitTorrent with VPN (haugene/transmission-openvpn)
  wolf/             # Game streaming (Moonlight/Sunshine)
```

## SERVICES TABLE

| Service | Compose | Image | Ports | Network |
|---------|---------|-------|-------|---------|
| jellyfin | `.yml` | jellyfin/jellyfin | 8096, 8920, 1900/udp, 7359/udp, 18800 | nginx |
| audiobookshelf | `.yaml` | ghcr.io/advplyr/audiobookshelf:latest | 13378 | nginx |
| nginx-proxy-manager | `.yaml` | jc21/nginx-proxy-manager:latest | 8000, 4430, 8100 | nginx |
| transmission | `.yml` | haugene/transmission-openvpn | 9091, 8118 | bridge |
| wolf | `.yaml` | ghcr.io/games-on-whales/wolf:stable | 47984, 47989, 47999/udp, 48010, 48100/udp, 48200/udp | bridge |

## VOLUME PATTERNS

| Pattern | Usage | Example |
|---------|-------|---------|
| `:U,z` | Privileged config volumes (jellyfin, nginx-proxy-manager) | `/var/stash2/config:/config:U,z` |
| `:ro,z` | Read-only media mounts | `/var/stash2/media:/media:ro,z` |
| `:ro` | Read-only without selinux label (audiobookshelf) | `/var/stash2/media/Audiobooks:/audiobooks:ro` |
| `./vpn/` | Local VPN config for transmission | `./vpn/:/etc/openvpn/custom` |
| `:rw` | Wolf device volumes | `/dev/:/dev/:rw` |

**Media mounts**: `/var/stash2/media` and `/var/stash/media` (both read-only where applicable)

## NETWORK PATTERNS

**nginx network** (external): jellyfin, audiobookshelf, nginx-proxy-manager
```yaml
networks:
  default:
    external: true
    name: nginx
```

**Default bridge** (no network section): transmission, wolf

## VPN SETUP (transmission only)

Transmission uses `haugene/transmission-openvpn` for VPN-protected torrenting.

**Required env vars** (set in shell or `.env`):
- `OPENVPN_PROVIDER`, `OPENVPN_USERNAME`, `OPENVPN_PASSWORD`, `OPENVPN_CONFIG`
- `LOCAL_NETWORK` (e.g., `192.168.1.0/24` for LAN access)
- `TRANSMISSION_PEER_PORT`

**VPN config location**: `./vpn/` mounted to `/etc/openvpn/custom`

**Privileged mode**: `cap_add: NET_ADMIN`, devices: `/dev/net/tun`

## COMMANDS

```bash
# Start a service
cd docker/docker-services/<service> && docker-compose up -d

# Stop a service
cd docker/docker-services/<service> && docker-compose down

# View logs
docker logs <container-name>

# Update image
docker-compose pull && docker-compose up -d
```

## ANTI-PATTERNS

- **Extension inconsistency**: jellyfin and transmission use `.yml`, others use `.yaml`. Accept this.
- **Missing `:z` suffix**: audiobookshelf volumes lack `:z` label (may fail on SELinux systems)
- **Hardcoded UID**: transmission sets `PUID=1000 PGID=1000` explicitly
- **No Tailscale integration**: Services not exposed via tailnet
- **wolf host mounts**: Requires `/dev/`, `/run/udev`, and docker.sock access from host
