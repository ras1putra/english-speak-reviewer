
import * as Minio from 'minio';

import { logger } from '../utils/logger';

const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = Number.parseInt(process.env.MINIO_PORT || '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const bucketName = process.env.MINIO_BUCKET || 'audio';

export const MINIO_BUCKET = bucketName;

// Parse endpoint
const epUrl = new URL(endPoint.startsWith('http') ? endPoint : `http://${endPoint}`);
const hostname = epUrl.hostname;

/**
 * Configured MinIO client instance.
 * Connects to the S3-compatible object storage service using environment variables.
 */
export let minioClient = new Minio.Client({
    endPoint: hostname,
    port,
    useSSL,
    accessKey,
    secretKey,
});

export const setMinioClientForTesting = (client: Minio.Client): void => {
    minioClient = client;
};

/**
 * Ensures that the default audio storage bucket exists.
 * If it doesn't exist, it attempts to create it.
 */
export const initBucket = async (): Promise<void> => {
    try {
        const exists = await minioClient.bucketExists(bucketName);

        if (!exists) {
            await minioClient.makeBucket(bucketName);
            logger.info(`Bucket '${bucketName}' created successfully.`);
        }
    } catch (err) {
        logger.error('Error ensuring bucket exists', { error: err });
    }
};

/**
 * Uploads a file buffer to MinIO.
 *
 * @param filename - The unique name (key) for the file in the bucket.
 * @param buffer - The raw file content/buffer.
 * @param metaData - Optional key-value metadata to attach to the object.
 * @returns The filename of the uploaded object.
 * @throws If the upload fails.
 */
export const uploadFile = async (filename: string, buffer: Buffer, metaData: Minio.ItemBucketMetadata = {}): Promise<string> => {
    try {
        await minioClient.putObject(bucketName, filename, buffer, buffer.length, metaData);
        logger.info(`File uploaded successfully: ${filename}`, { size: buffer.length });

        return filename;

    } catch (err) {
        logger.error('Error uploading file to MinIO', { error: err });
        throw err;
    }
};

/**
 * Retrieves a file from MinIO as a buffer.
 *
 * @param filename - The name (key) of the file to retrieve.
 * @returns A Promise resolving to the file Buffer.
 * @throws If retrieval fails.
 */
export const getFile = async (filename: string): Promise<Buffer> => {
    try {
        const stream = await minioClient.getObject(bucketName, filename);

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        });
    } catch (err) {
        logger.error(`Error getting file ${filename} from MinIO`, { error: err });
        throw err;
    }
};
