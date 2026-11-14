# Weekly Lidarr release sync

The job uses Encore's new-release feed, which combines Last.fm listening history with MusicBrainz releases. It checks albums, EPs, and singles within 90 days either side of the run date for artists already in Lidarr. It adds missing releases by MusicBrainz release-group ID and searches for released, monitored items that lack tracks. Upcoming additions are monitored and eligible for a search once released. Existing unmonitored entries retain their setting.

On Endor, install these files from this directory as the user with Docker access.

```sh
install -d ~/.local/share/encore-lidarr-releases ~/.config/systemd/user
install -m 644 sync.cjs ~/.local/share/encore-lidarr-releases/
install -m 644 encore-lidarr-releases.{service,timer} ~/.config/systemd/user/
docker exec -i encore node - --dry-run < ~/.local/share/encore-lidarr-releases/sync.cjs
systemctl --user daemon-reload
systemctl --user enable --now encore-lidarr-releases.timer
```

The timer runs Monday at 07:00 UTC. View results with `journalctl --user -u encore-lidarr-releases.service`.
