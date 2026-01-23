import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// File type and size limits per media policy
const LIMITS = {
  'users/avatar': { types: ['image/webp'], maxSize: 50 * 1024 }, // 50KB
  'providers/logo': { types: ['image/webp'], maxSize: 50 * 1024 },
  'listings/cover': { types: ['image/webp'], maxSize: 100 * 1024 }, // 100KB
  'listings/gallery': { types: ['image/webp'], maxSize: 200 * 1024 }, // 200KB
  'listings/video': { types: ['video/mp4'], maxSize: 10 * 1024 * 1024 }, // 10MB
};

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, entity_type, entity_id, file_type } = req.body;

    // Validate required fields
    if (!file || !entity_type || !entity_id || !file_type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['file', 'entity_type', 'entity_id', 'file_type']
      });
    }

    // Validate entity_type
    const validTypes = ['users/avatar', 'providers/logo', 'listings/cover', 'listings/gallery', 'listings/video'];
    if (!validTypes.includes(entity_type)) {
      return res.status(400).json({
        error: 'Invalid entity_type',
        allowed: validTypes
      });
    }

    // Get limits for this entity type
    const limits = LIMITS[entity_type];

    // Decode base64 file
    let fileBuffer;
    try {
      const base64Data = file.split(',')[1] || file;
      fileBuffer = Buffer.from(base64Data, 'base64');
    } catch (err) {
      return res.status(400).json({ error: 'Invalid file format (must be base64)' });
    }

    // Check file size
    if (fileBuffer.length > limits.maxSize) {
      return res.status(400).json({
        error: 'File too large',
        max: `${limits.maxSize / 1024}KB`,
        actual: `${(fileBuffer.length / 1024).toFixed(2)}KB`
      });
    }

    // Validate content type
    if (!limits.types.includes(file_type)) {
      return res.status(400).json({
        error: 'Invalid file type',
        allowed: limits.types,
        received: file_type
      });
    }

    // Generate file path based on entity type
    let filePath;
    const timestamp = Date.now();
    const extension = file_type.split('/')[1]; // webp or mp4

    switch (entity_type) {
      case 'users/avatar':
        filePath = `users/${entity_id}/avatar.${extension}`;
        break;
      case 'providers/logo':
        filePath = `providers/${entity_id}/logo.${extension}`;
        break;
      case 'listings/cover':
        filePath = `listings/${entity_id}/cover.${extension}`;
        break;
      case 'listings/gallery':
        filePath = `listings/${entity_id}/gallery/${timestamp}.${extension}`;
        break;
      case 'listings/video':
        filePath = `listings/${entity_id}/videos/${timestamp}.${extension}`;
        break;
    }

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filePath,
      Body: fileBuffer,
      ContentType: file_type,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${filePath}`;

    // Log activity (optional - can be done from frontend after upload)
    // You can add activity logging here if needed

    return res.status(200).json({
      success: true,
      url: publicUrl,
      path: filePath,
      size: fileBuffer.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // Max request size (for 10MB video + overhead)
    },
  },
};
