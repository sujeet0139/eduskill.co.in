// Upload storage abstraction.
//
// On Vercel (and any serverless host) the filesystem is ephemeral, so uploaded
// files must go to object storage. If CLOUDINARY_URL is set we stream uploads to
// Cloudinary; otherwise we fall back to local disk for local development.
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const cloudEnabled = !!process.env.CLOUDINARY_URL;

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
    // Local dev (or any non-serverless host): write to disk. On Vercel the only
    // writable location is the OS temp dir, but uploads there will not persist —
    // configure CLOUDINARY_URL for production.
    const dir = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : 'uploads';
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* best effort */ }
    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
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

module.exports = { makeUpload, fileUrl, cloudEnabled };
