import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'chat_uploads';
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
});

/**
 * Resolve a human-readable upload filename from multer file metadata and Cloudinary response.
 */
export function resolveUploadName(file, uploaded) {
  const explicit = String(file?.originalname || '').trim();
  if (explicit) return explicit;
  const fromCloudinary = String(uploaded?.original_filename || '').trim();
  if (fromCloudinary) {
    const fmt = String(uploaded?.format || '').trim();
    return fmt ? `${fromCloudinary}.${fmt}` : fromCloudinary;
  }
  const mime = String(file?.mimetype || '').trim();
  const ext = mime.includes('/') ? mime.split('/')[1] : 'file';
  return `upload.${ext || 'file'}`;
}

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - The file content as a Buffer.
 * @param {string} mimetype - The MIME type of the file.
 * @returns {Promise<object>} Cloudinary upload result.
 */
export async function uploadToCloudinary(buffer, mimetype) {
  const missingVars = [
    !cloudinaryCloudName ? 'CLOUDINARY_CLOUD_NAME' : '',
    !cloudinaryApiKey ? 'CLOUDINARY_API_KEY' : '',
    !cloudinaryApiSecret ? 'CLOUDINARY_API_SECRET' : '',
  ].filter(Boolean);

  if (missingVars.length > 0) {
    throw new Error(`Cloudinary config missing: ${missingVars.join(', ')}`);
  }

  if (!buffer || !buffer.length) {
    throw new Error('Uploaded file is empty or unreadable.');
  }

  const resourceType = String(mimetype || '').startsWith('video/') ? 'video' : 'auto';

  const uploadOptions = {
    folder: cloudinaryFolder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error('Cloudinary upload returned no result.'));
      resolve(uploaded);
    });
    uploadStream.end(buffer);
  });
}
