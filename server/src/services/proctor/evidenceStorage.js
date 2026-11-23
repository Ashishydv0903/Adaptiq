import mongoose from 'mongoose';
import { Readable } from 'stream';
import { Evidence } from '../../models/Evidence.js';
import { logProctorAction } from './auditService.js';
import { proctorConfigs } from '../../config/proctorConfig.js';
import { logger } from '../../config/logger.js';

// Local in-memory buffer cache for test environments or offline Mongo instances
const inMemoryEvidenceBlobs = new Map();

/**
 * Get or create GridFSBucket instance
 */
function getGridFSBucket() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'evidence'
    });
  }
  return null;
}

/**
 * Uploads a rolling video buffer and/or snapshot to GridFS / Cloudinary / S3 / Local
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} [params.candidateId]
 * @param {string} [params.alertId]
 * @param {string} params.eventType
 * @param {string} [params.severity='orange']
 * @param {Buffer|Uint8Array} [params.mediaBuffer] - 10-second rolling MediaRecorder WebM/MP4 buffer
 * @param {string} [params.mimeType='video/webm']
 * @param {string} [params.snapshotBase64] - Frame snapshot at time of alert
 * @param {number} [params.durationSeconds=10]
 * @param {number} [params.retentionDays=30]
 * @param {Object} [params.metadata={}]
 * @returns {Promise<Object>} Created evidence record
 */
export async function saveEvidence({
  sessionId,
  candidateId = null,
  alertId = null,
  eventType,
  severity = 'orange',
  mediaBuffer = null,
  mimeType = 'video/webm',
  snapshotBase64 = null,
  durationSeconds = 10,
  retentionDays = proctorConfigs.retentionDays || 30,
  metadata = {}
}) {
  const sizeBytes = mediaBuffer ? mediaBuffer.length : 0;
  const storageProvider = process.env.PROCTOR_STORAGE_PROVIDER || 'gridfs';
  let gridFsFileId = null;
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  // 1. Persist media buffer into GridFS if buffer is present
  if (mediaBuffer && mediaBuffer.length > 0) {
    const bucket = getGridFSBucket();
    if (bucket) {
      try {
        const filename = `session_${sessionId}_alert_${alertId || Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: mimeType,
          metadata: {
            sessionId: String(sessionId),
            alertId: String(alertId || ''),
            eventType,
            severity,
            capturedAt: new Date()
          }
        });

        await new Promise((resolve, reject) => {
          const readable = Readable.from(mediaBuffer);
          readable.pipe(uploadStream)
            .on('finish', () => {
              gridFsFileId = uploadStream.id;
              resolve();
            })
            .on('error', reject);
        });
      } catch (err) {
        logger.warn(`GridFS upload failed: ${err.message}. Using memory fallback.`);
      }
    }

    // Cache locally if GridFS was unavailable
    if (!gridFsFileId) {
      const fallbackKey = `evidence_${sessionId}_${Date.now()}`;
      inMemoryEvidenceBlobs.set(fallbackKey, {
        buffer: mediaBuffer,
        mimeType,
        sizeBytes
      });
    }
  }

  // 2. Persist Evidence document in MongoDB
  let evidenceRecord = {
    sessionId: mongoose.Types.ObjectId.isValid(sessionId) ? sessionId : new mongoose.Types.ObjectId(),
    candidateId: candidateId && mongoose.Types.ObjectId.isValid(candidateId) ? candidateId : null,
    alertId: alertId || `alert_${Date.now()}`,
    eventType,
    severity,
    mediaType: mediaBuffer ? 'video_buffer' : 'snapshot',
    storageProvider: gridFsFileId ? 'gridfs' : (storageProvider === 'cloudinary' ? 'cloudinary' : 'local'),
    gridFsFileId,
    mimeType,
    sizeBytes,
    durationSeconds,
    snapshotBase64,
    capturedAt: new Date(),
    expiresAt,
    retentionDays,
    isDeleted: false,
    metadata
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const created = await Evidence.create(evidenceRecord);
      evidenceRecord = created.toObject();
    } else {
      evidenceRecord._id = new mongoose.Types.ObjectId();
    }
  } catch (err) {
    logger.warn(`Failed to create Evidence document in DB: ${err.message}`);
    evidenceRecord._id = new mongoose.Types.ObjectId();
  }

  // Set download URL
  evidenceRecord.downloadUrl = `/api/proctor/evidence/${evidenceRecord._id}`;

  // 3. Write to AuditLog
  await logProctorAction({
    action: 'PROCTOR_ALERT',
    targetType: 'SESSION',
    targetId: String(sessionId),
    reason: `Evidence recorded for ${severity.toUpperCase()} alert: ${eventType} (10s buffer: ${sizeBytes} bytes)`,
    newState: {
      alertId,
      eventType,
      severity,
      evidenceId: evidenceRecord._id,
      expiresAt
    }
  });

  return evidenceRecord;
}

/**
 * Retrieve evidence stream or buffer for playback/download
 *
 * @param {string} evidenceId
 * @returns {Promise<{ stream: Readable|null, mimeType: string, sizeBytes: number, snapshotBase64?: string, record: Object }>}
 */
export async function getEvidenceStream(evidenceId) {
  let record = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(evidenceId)) {
    record = await Evidence.findById(evidenceId).lean();
  }

  if (!record) {
    throw new Error('Evidence not found or has expired.');
  }

  if (record.isDeleted) {
    throw new Error('Evidence has been purged per retention policy.');
  }

  // Retrieve from GridFS
  if (record.gridFsFileId) {
    const bucket = getGridFSBucket();
    if (bucket) {
      const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(record.gridFsFileId));
      return {
        stream: downloadStream,
        mimeType: record.mimeType || 'video/webm',
        sizeBytes: record.sizeBytes || 0,
        snapshotBase64: record.snapshotBase64,
        record
      };
    }
  }

  // Fallback memory stream
  const memEntry = inMemoryEvidenceBlobs.get(record.fileKey || `evidence_${record.sessionId}_${record.alertId}`);
  if (memEntry) {
    return {
      stream: Readable.from(memEntry.buffer),
      mimeType: memEntry.mimeType || 'video/webm',
      sizeBytes: memEntry.sizeBytes || 0,
      snapshotBase64: record.snapshotBase64,
      record
    };
  }

  return {
    stream: null,
    mimeType: record.mimeType || 'image/jpeg',
    sizeBytes: record.sizeBytes || 0,
    snapshotBase64: record.snapshotBase64,
    record
  };
}

/**
 * Retention Cleanup Job: purges evidence older than retentionDays
 *
 * @returns {Promise<{ purgedCount: number, deletedFileIds: Array }>}
 */
export async function cleanupExpiredEvidence() {
  const now = new Date();
  let purgedCount = 0;
  const deletedFileIds = [];

  try {
    if (mongoose.connection.readyState === 1) {
      const expiredDocs = await Evidence.find({
        expiresAt: { $lte: now },
        isDeleted: false
      }).limit(200);

      const bucket = getGridFSBucket();

      for (const doc of expiredDocs) {
        if (doc.gridFsFileId && bucket) {
          try {
            await bucket.delete(new mongoose.Types.ObjectId(doc.gridFsFileId));
            deletedFileIds.push(doc.gridFsFileId);
          } catch (delErr) {
            logger.warn(`Failed to delete GridFS file ${doc.gridFsFileId}: ${delErr.message}`);
          }
        }

        doc.isDeleted = true;
        doc.deletedAt = new Date();
        await doc.save();
        purgedCount++;

        // Log to AuditLog
        await logProctorAction({
          action: 'PROCTOR_EVIDENCE_DELETED',
          targetType: 'EVIDENCE',
          targetId: String(doc._id),
          reason: `Evidence automatically purged after retention period of ${doc.retentionDays || 30} days.`
        });
      }
    }
  } catch (err) {
    logger.error(`Evidence retention cleanup job failed: ${err.message}`);
  }

  return {
    purgedCount,
    deletedFileIds
  };
}

export default {
  saveEvidence,
  getEvidenceStream,
  cleanupExpiredEvidence
};
