// Upload storage abstraction.
//
// On Vercel (and any serverless host) the filesystem is ephemeral, so uploaded
// files must go to object storage. If CLOUDINARY_URL is set we stream uploads to
// Cloudinary; otherwise we fall back to local disk for local development.
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Storage mode is decided purely by whether CLOUDINARY_URL is set:
//   - set   -> uploads stream to Cloudinary (returns absolute https URLs)
//   - blank -> uploads are written to local server disk under LOCAL_UPLOAD_DIR
// This lets the operator switch modes with a single env var, no code change.
const cloudEnabled = !!process.env.CLOUDINARY_URL;

// The one true local uploads directory. Absolute so it does NOT depend on the
// process working directory (pm2, cron, etc. may start elsewhere). Both the
// upload writer (below) and the static file server (server.js) use this same
// path, so a file that is written is always served back from the same place.
// Override with UPLOAD_DIR to point at a mounted disk / larger hosting volume.
const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : (process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '..', 'uploads'));

let cloudinary, CloudinaryStorage;
if (cloudEnabled) {
  // cloudinary auto-configures from the CLOUDINARY_URL env var.
  cloudinary = require('cloudinary').v2;
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
}

/**
 * Build a configured multer instance.
 * @param {object} opts
 * @param {string} opts.folder   Cloudinary folder (ignored on disk).
 * @param {string} opts.prefix   Filename prefix, e.g. "payment-".
 * @param {number} opts.maxSize  Max bytes.
 * @param {RegExp} opts.allowedExt   Allowed extensions regex.
 * @param {string[]} opts.allowedMime Allowed mime types.
 */
function makeUpload({ folder = 'eduskill', prefix = 'file', maxSize = 5 * 1024 * 1024, allowedExt, allowedMime }) {
  let storage;

  if (cloudEnabled) {
    storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder,
        resource_type: 'auto',
        public_id: () => prefix + Date.now()
      }
    });
  } else {
    // Write to local server disk. Uses the shared absolute LOCAL_UPLOAD_DIR so
    // files land exactly where server.js serves them from. Persistent on a
    // normal VPS; on Vercel this is the ephemeral temp dir (use Cloudinary there).
    try { fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true }); } catch (e) { /* best effort */ }
    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, LOCAL_UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, prefix + Date.now() + path.extname(file.originalname))
    });
  }

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      const extOk = allowedExt.test(path.extname(file.originalname).toLowerCase());
      if (allowedMime.includes(file.mimetype) && extOk) return cb(null, true);
      cb(new Error('Invalid file type.'));
    }
  });
}

/**
 * Normalize the public path/URL to store in the DB from a multer file object.
 * Cloudinary puts the full https URL on file.path; disk storage uses file.filename.
 */
function fileUrl(file) {
  if (!file) return null;
  if (file.path && /^https?:\/\//.test(file.path)) return file.path;
  return '/uploads/' + file.filename;
}

module.exports = { makeUpload, fileUrl, cloudEnabled, LOCAL_UPLOAD_DIR };
