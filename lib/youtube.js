// Teacher Portal material sharing (master-dev-prompt Section F#2): a
// teacher pastes a normal YouTube share/watch/short URL and we parse the
// video ID server-side so the student view can embed it directly --
// nobody should have to hand-extract an embed code.

// Matches youtu.be/<id>, youtube.com/watch?v=<id>, /embed/<id>, /shorts/<id>,
// with or without extra query params.
const YOUTUBE_ID_RE = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(YOUTUBE_ID_RE);
  return match ? match[1] : null;
}

function youTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}

module.exports = { extractYouTubeId, youTubeEmbedUrl };
