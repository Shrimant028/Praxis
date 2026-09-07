const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let cached = null;

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) return null;
  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

function getR2Client() {
  if (cached) return cached;
  const cfg = getR2Config();
  if (!cfg) return null;
  cached = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cached;
}

async function createSignedUploadUrl({ bucket, objectKey, mimeType, expiresIn = 900 }) {
  const client = getR2Client();
  if (!client) return null;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

async function createSignedDownloadUrl({ bucket, objectKey, expiresIn = 900 }) {
  const client = getR2Client();
  if (!client) return null;
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

module.exports = {
  getR2Config,
  createSignedUploadUrl,
  createSignedDownloadUrl,
};
