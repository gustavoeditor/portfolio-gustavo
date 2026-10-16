function storageMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'token';
  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_WEBHOOK_PUBLIC_KEY) return 'oidc';
  return null;
}
const hasStore = () => Boolean(storageMode());
module.exports = {storageMode, hasStore};
