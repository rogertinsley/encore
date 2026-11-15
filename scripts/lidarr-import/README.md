# Lidarr import retries on Endor

The user timer runs daily at 06:30 in Endor's timezone. It reads failed imports from Lidarr through the running Encore container, using Encore's Lidarr configuration. Endor maps Lidarr's `/downloads` to `/mnt/hoth/downloads`.

The job checks Lidarr's known editions first. If none match, it searches MusicBrainz using the FLAC album and album-artist tags, barcode, or catalog number. It compares track count, titles, disc and track positions, and durations. A verified edition already available in Lidarr is tagged on a staging copy and submitted for Lidarr's normal import checks. The original files are preserved. When an assigned album is missing the verified edition, the job queues a metadata refresh and checks again on the next run.

## Install or update

On Endor, as the user with Docker access, run from this directory:

```sh
install -d ~/.local/share/lidarr-import-report ~/.config/systemd/user
install -m 644 report.py ~/.local/share/lidarr-import-report/report.py
python3 -m venv ~/.local/share/lidarr-import-report/venv
~/.local/share/lidarr-import-report/venv/bin/pip install -r requirements.txt
install -m 644 lidarr-import-report.service lidarr-import-report.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lidarr-import-report.timer
systemctl --user start lidarr-import-report.service
journalctl --user -u lidarr-import-report.service -n 20 --no-pager
```

## Run after a music download

On Endor, install `encore-music-complete.sh` as an executable in SABnzbd's
`/config/scripts` directory. Set SABnzbd's scripts folder to `/config/scripts`
and select the script for the `music` category. Install the
`lidarr-import-on-download.path` and `lidarr-import-on-download.service`
units in `~/.config/systemd/user/`, reload systemd, and enable the path unit.

The hook signals Endor after successful music post-processing. The service waits
two minutes for Lidarr's normal import and then invokes the same retry service
as the daily timer. Other SABnzbd categories do not trigger the hook.
