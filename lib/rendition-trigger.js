// Starts the "Gerar qualidades otimizadas dos vídeos" workflow right after a video is
// published from the admin panel, so the 144p → 2160p ladder is built in minutes.
// Needs GITHUB_RENDITIONS_TOKEN on Vercel: a fine-grained token for this repository with
// "Contents: Read and write" (repository_dispatch). Without it, the workflow's own
// schedule (every 10 minutes) picks the upload up instead. Never throws.
const REPO = 'gustavoeditor/portfolio-gustavo';

async function requestRenditions(reason = 'new-upload') {
  const token = process.env.GITHUB_RENDITIONS_TOKEN;
  if (!token) return 'scheduled';
  try {
    const response = await fetch('https://api.github.com/repos/' + REPO + '/dispatches', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-renditions',
      },
      body: JSON.stringify({ event_type: 'new-upload', client_payload: { reason: String(reason).slice(0, 40) } }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 204) return 'started';
    console.warn('renditions dispatch rejected', response.status);
  } catch (error) {
    console.warn('renditions dispatch failed', error.message);
  }
  return 'scheduled';
}

module.exports = { requestRenditions };
