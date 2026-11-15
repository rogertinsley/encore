import hashlib
import json
import shutil
import tempfile
from mutagen.flac import FLAC
import pathlib
import re
import subprocess
import time
import unicodedata
import urllib.request
import urllib.parse

QUEUE = r"""
(async () => {
  async function get(path) {
    const base = (process.env.LIDARR_URL || 'https://lidarr.rogertinsley.com').replace(/\/?$/, '/');
    const response = await fetch(new URL('api/v1/' + path, base), {
      headers: {'X-Api-Key': process.env.LIDARR_API_KEY},
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('Lidarr HTTP ' + response.status);
    return response.json();
  }
  const input = process.argv[2];
  if (process.argv[3]) { console.log(JSON.stringify(await get(process.argv[3]))); return; }
  if (input) {
    const base = (process.env.LIDARR_URL || 'https://lidarr.rogertinsley.com').replace(/\/?$/, '/');
    const response = await fetch(new URL('api/v1/command', base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {'X-Api-Key': process.env.LIDARR_API_KEY, 'Content-Type': 'application/json'},
      body: input
    });
    if (!response.ok) throw Error('Import command HTTP ' + response.status);
    console.log(JSON.stringify(await response.json()));
    return;
  }
  const items = [];
  for (let page = 1; ; page++) {
    const queue = await get('queue?page=' + page + '&pageSize=100&includeUnknownArtistItems=true');
    for (const item of queue.records) {
      if (item.trackedDownloadState !== 'importFailed') continue;
      const album = item.albumId ? await get('album/' + item.albumId) : null;
      items.push({title:item.title, path:item.outputPath, artistId:album?.artistId, releases:album?.releases ?? []});
    }
    if (page * 100 >= queue.totalRecords) break;
  }
  console.log(JSON.stringify(items));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
"""

def read_flac(path):
    with path.open('rb') as stream:
        if stream.read(4) != b'fLaC':
            raise ValueError('invalid FLAC header')
        tags = {}
        duration = None
        while len(header := stream.read(4)) == 4:
            block = stream.read(int.from_bytes(header[1:], 'big'))
            kind = header[0] & 127
            if kind == 0:
                info = int.from_bytes(block[10:18], 'big')
                duration = 1000 * (info & ((1 << 36) - 1)) / (info >> 44)
            if kind == 4:
                start = 4 + int.from_bytes(block[:4], 'little')
                count = int.from_bytes(block[start:start+4], 'little')
                start += 4
                for _ in range(count):
                    size = int.from_bytes(block[start:start+4], 'little')
                    start += 4
                    key, _, value = block[start:start+size].decode().partition('=')
                    tags[key.upper()] = value
                    start += size
            if header[0] & 128:
                break
        return tags, duration

def normalize(title):
    return ''.join(c for c in unicodedata.normalize('NFKC', title).casefold() if c.isalnum())

def match_title(title, album, year=''):
    if re.fullmatch(r'[0-9]{4}', year):
        title = re.sub(rf'\s+\({year} Remaster\)$', '', title, flags=re.IGNORECASE)
    # A venue repeated in the track title is redundant for this live edition.
    suffix = re.search(r'\s+\((live (?:at|in) .+)\)$', title, re.IGNORECASE)
    if suffix and normalize(album).endswith(normalize(suffix[1])):
        title = title[:suffix.start()]
    return normalize(title)

def musicbrainz(path, **params):
    url = 'https://musicbrainz.org/ws/2/' + path + '?' + urllib.parse.urlencode({**params, 'fmt': 'json'})
    request = urllib.request.Request(url, headers={
        'User-Agent': 'EncoreLidarrImport/1.0 (https://github.com/rogertinsley/encore)',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    finally:
        time.sleep(1.1)

def discover_editions(metadata, track_count):
    queries = set()
    for field, tag in [('barcode', 'BARCODE'), ('catno', 'CATALOGNUMBER')]:
        values = {tags[tag] for tags in metadata if tags.get(tag)}
        if len(values) == 1:
            queries.add(f'{field}:{json.dumps(next(iter(values)), ensure_ascii=False)}')
    albums = {tags['ALBUM'] for tags in metadata if tags.get('ALBUM')}
    if len(albums) == 1:
        query = 'release:' + json.dumps(next(iter(albums)), ensure_ascii=False)
        artists = {tags.get('ALBUMARTIST') for tags in metadata} - {None, ''}
        if artists:
            query += ' AND (' + ' OR '.join('artist:' + json.dumps(artist, ensure_ascii=False) for artist in sorted(artists)) + ')'
        queries.add(query)
    releases = set()
    for query in sorted(queries):
        result = musicbrainz('release', query=f'({query}) AND tracks:{track_count}', limit=25)
        if result.get('count', 0) > 25:
            raise ValueError('MusicBrainz search returned too many editions')
        releases.update(r['id'] for r in result['releases'] if r.get('track-count') == track_count)
    return releases

def refresh_metadata(item, edition):
    artist_id = item.get('artistId')
    if not artist_id:
        group_id = edition['release-group']['id']
        album = next((album for album in lidarr(query='album')
                      if album.get('foreignAlbumId') == group_id), None)
        if album and any(release.get('foreignReleaseId') == edition['id']
                         for release in album.get('releases', [])):
            return None
        artist_id = album.get('artistId') if album else None
    if not artist_id:
        return 'no matching album assigned or present in Lidarr'
    marker = pathlib.Path(__file__).parent / f"refresh-{artist_id}-{edition['id']}"
    if marker.exists() and time.time() - marker.stat().st_mtime < 7 * 86400:
        return 'waiting for Lidarr metadata refresh'
    lidarr(json.dumps({'name': 'RefreshArtist', 'artistIds': [artist_id]}))
    marker.touch()
    return 'queued Lidarr metadata refresh'

def check(item):
    relative = pathlib.PurePosixPath(item['path'] or '/').relative_to('/downloads')
    root = pathlib.Path('/mnt/hoth/downloads').resolve()
    folder = (root / relative).resolve()
    if folder == root or not folder.is_relative_to(root) or not folder.is_dir():
        return 'download folder unavailable'
    files = sorted(p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in {'.flac','.mp3','.m4a','.wav','.ogg','.opus','.aac','.aiff','.ape','.wv','.dsf','.wma'})
    if not files or any(p.suffix.lower() != '.flac' or not p.resolve().is_relative_to(folder) for p in files):
        return 'no audio files or unsupported audio format/path'
    candidates = {r['foreignReleaseId'] for r in item['releases'] if r.get('trackCount') == len(files) and re.fullmatch(r'[0-9a-f-]{36}', r.get('foreignReleaseId', ''))}
    observed = {}
    tracks = {}
    metadata = []
    track_tags = {}
    for path in files:
        tags, duration = read_flac(path)
        metadata.append(tags)
        position = (int(tags.get('DISCNUMBER','1').split('/')[0]), int(tags['TRACKNUMBER'].split('/')[0]))
        if position in observed or not tags.get('TITLE') or not duration:
            return 'missing or duplicate track metadata'
        observed[position] = (match_title(tags['TITLE'], tags.get('ALBUM', '')), duration)
        tracks[position] = path
        track_tags[position] = tags
    known = candidates.copy()
    matches = []
    differences = []
    pending = sorted(candidates)
    searched = False
    while pending or not searched:
        if not pending:
            if matches:
                break
            searched = True
            pending = sorted(discover_editions(metadata, len(files)) - candidates)
            candidates.update(pending)
            if not pending:
                break
        if len(candidates) > 15:
            return 'too many editions with the same track count'
        release = pending.pop(0)
        edition = musicbrainz('release/' + release, inc='recordings+artist-credits+release-groups')
        edition_year = (edition.get('date') or '')[:4]
        actual = {
            position: (
                match_title(tags['TITLE'], tags.get('ALBUM', ''),
                            edition_year if tags.get('DATE', '')[:4] == edition_year else ''),
                observed[position][1],
            )
            for position, tags in track_tags.items()
        }
        expected = {(disc['position'], track['position']): (match_title(track['title'], edition['title'], edition_year), track.get('length')) for disc in edition['media'] for track in disc['tracks']}
        if expected.keys() == actual.keys() and all(length and title == actual[pos][0] and abs(length - actual[pos][1]) <= 3000 for pos, (title, length) in expected.items()):
            matches.append(edition)
        else:
            common = expected.keys() & actual.keys()
            title_count = sum(expected[pos][0] != actual[pos][0] for pos in common)
            length_count = sum(not expected[pos][1] or abs(expected[pos][1] - actual[pos][1]) > 3000 for pos in common)
            differences.append(f'{release}: {len(expected.keys() ^ actual.keys())} different positions, {title_count} different titles, {length_count} duration mismatches')
    if len(matches) == 1:
        edition = matches[0]
        if edition['id'] in known:
            return stage_and_import(item, edition, tracks, root)
        status = refresh_metadata(item, edition)
        if status is None:
            return stage_and_import(item, edition, tracks, root)
        return f"MusicBrainz edition {edition['id']} verified; {status}"
    return f'{len(files)} FLACs, {len(candidates)} candidate editions, {len(matches)} exact matches; ' + '; '.join(differences)

def lidarr(command='', query=''):
    return json.loads(subprocess.check_output(
        ['docker','exec','-i','encore','node','-',command,query],
        input=QUEUE, text=True, timeout=90))

def credit(artists):
    return ''.join(artist['name'] + artist.get('joinphrase', '') for artist in artists)

def stage_and_import(item, edition, tracks, root):
    base = root / '.lidarr-import-staging'
    base.mkdir(mode=0o755, exist_ok=True)
    if base.is_symlink():
        raise ValueError('staging folder is a symlink')
    state = pathlib.Path(__file__).parent / 'submitted'
    state.mkdir(exist_ok=True)
    key = hashlib.sha256((item['path'] + edition['id']).encode()).hexdigest()
    marker = state / key
    if marker.exists():
        return f'already submitted; see {marker}'
    folder = pathlib.Path(tempfile.mkdtemp(prefix='release-', dir=base))
    folder.chmod(0o755)
    try:
        for disc in edition['media']:
            for track in disc['tracks']:
                position = (disc['position'], track['position'])
                target = folder / f'{position[0]:02d}-{position[1]:03d}.flac'
                shutil.copyfile(tracks[position], target)
                target.chmod(0o644)
                audio = FLAC(target)
                tags = {
                    'ALBUM': edition['title'], 'TITLE': track['title'],
                    'ALBUMARTIST': credit(edition['artist-credit']),
                    'ARTIST': credit(track.get('artist-credit') or track['recording']['artist-credit']),
                    'DISCNUMBER': str(position[0]), 'TRACKNUMBER': str(position[1]),
                    'MUSICBRAINZ_ALBUMID': edition['id'],
                    'MUSICBRAINZ_TRACKID': track['recording']['id'],
                    'MUSICBRAINZ_RELEASETRACKID': track['id'],
                    'MUSICBRAINZ_RELEASEGROUPID': edition['release-group']['id'],
                }
                if edition.get('date'):
                    tags['DATE'] = edition['date']
                if edition.get('country'):
                    tags['RELEASECOUNTRY'] = edition['country']
                audio.update(tags)
                audio.save()
    except Exception:
        shutil.rmtree(folder)
        raise
    container_path = '/downloads/' + folder.relative_to(root).as_posix()
    preview = lidarr(query='manualimport?' + urllib.parse.urlencode({
        'folder': container_path, 'filterExistingFiles': 'false',
        'replaceExistingFiles': 'false',
    }))
    files = []
    track_ids = set()
    albums = {}
    for row in preview:
        album = row.get('album') or {}
        release = next((r for r in album.get('releases', [])
                        if r.get('id') == row.get('albumReleaseId')), None)
        if not release and album.get('foreignAlbumId') == edition['release-group']['id']:
            if album['id'] not in albums:
                albums[album['id']] = lidarr(query=f"album/{album['id']}")
            full_album = albums[album['id']]
            release = next((r for r in full_album['releases']
                            if r['id'] == row.get('albumReleaseId')), None)
        matched = row.get('tracks') or []
        path = pathlib.PurePosixPath(row['path'])
        if (not release or release['foreignReleaseId'] != edition['id']
                or path.parent.as_posix() != container_path
                or row.get('rejections') or len(matched) != 1):
            marker.write_text(f'Import preview rejected: {folder}\n')
            return marker.read_text().strip()
        track_id = matched[0]['id']
        track_ids.add(track_id)
        files.append({
            'path': row['path'], 'artistId': row['artist']['id'],
            'albumId': album['id'], 'albumReleaseId': row['albumReleaseId'],
            'trackIds': [track_id], 'quality': row['quality'],
        })
    if len(files) != len(tracks) or len(track_ids) != len(tracks):
        marker.write_text(f'Import preview incomplete: {folder}\n')
        return marker.read_text().strip()

    # Record intent before sending, since a timed-out POST may still queue an import.
    marker.write_text(f'Pending submission: {folder}\n')
    result = lidarr(json.dumps({
        'name': 'ManualImport', 'files': files,
        'importMode': 'Move', 'replaceExistingFiles': False,
    }))
    command_id = result['id']
    marker.write_text(f'Command {command_id}: {folder}\n')
    for _ in range(12):
        status = lidarr(query=f'command/{command_id}').get('status')
        if status in ('completed', 'failed', 'aborted', 'cancelled'):
            remaining = len(list(folder.glob('*.flac')))
            if not remaining and folder.is_dir():
                folder.rmdir()
            marker.write_text(f'Command {command_id}: {status}, {remaining} files left in {folder}\n')
            return marker.read_text().strip()
        time.sleep(5)
    return f'queued Lidarr import command {command_id}'

items = lidarr()
print(f'{len(items)} failed Lidarr imports')
for item in items:
    try:
        result = check(item)
    except (OSError, ValueError, KeyError, ZeroDivisionError, subprocess.SubprocessError) as error:
        result = f'review required ({error})'
    print(f'{item["title"]}: {result}', flush=True)
