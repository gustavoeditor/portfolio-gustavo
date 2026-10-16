// The SDK also reads request-scoped OIDC headers on Vercel; an env token is not required.
function storageMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'token';
  if (process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY) return 'oidc';
  return null;
}
const hasStore = () => Boolean(storageMode());
module.exports = {storageMode, hasStore};
