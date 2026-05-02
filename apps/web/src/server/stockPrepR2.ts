import {
  DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  type PutObjectCommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2SendCapableClient = {
  send(command: unknown): Promise<unknown>;
};

export function createR2Client(): S3Client {
  const accountId = process.env.STOCK_PREP_R2_ACCOUNT_ID;
  const accessKeyId = process.env.STOCK_PREP_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 環境変数が不足しています。");
  }

  return new S3Client({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

export async function putJsonObject({
  body,
  key,
  r2,
}: {
  body: unknown;
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = getBucketName();

  await sendR2Command<PutObjectCommandOutput>(
    r2,
    new PutObjectCommand({
      Body: JSON.stringify(body),
      Bucket: bucket,
      ContentType: "application/json; charset=utf-8",
      Key: key,
    }),
  );
}

export async function putBinaryObject({
  body,
  contentType,
  key,
  r2,
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = getBucketName();

  await sendR2Command<PutObjectCommandOutput>(
    r2,
    new PutObjectCommand({
      Body: body,
      Bucket: bucket,
      ContentType: contentType,
      Key: key,
    }),
  );
}

export async function createPresignedUploadUrl({
  contentType,
  expiresInSeconds = 900,
  key,
  r2,
}: {
  contentType: string;
  expiresInSeconds?: number;
  key: string;
  r2: S3Client;
}): Promise<string> {
  const bucket = getBucketName();

  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: bucket,
      ContentType: contentType,
      Key: key,
    }),
    {
      expiresIn: expiresInSeconds,
    },
  );
}

export async function getJsonObject<T>({ key, r2 }: { key: string; r2: S3Client }): Promise<T> {
  const bucket = getBucketName();

  try {
    const response = await sendR2Command<GetObjectCommandOutput>(
      r2,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const text = await response.Body?.transformToString();

    if (!text) {
      throw new Error(`R2 object was empty: ${key}`);
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "$metadata" in error) &&
      ((error as { name?: string }).name === "NoSuchKey" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    ) {
      throw new Error(`R2 object was not found: ${key}`);
    }

    throw error;
  }
}

export async function getBinaryObject({
  key,
  r2,
}: {
  key: string;
  r2: S3Client;
}): Promise<Uint8Array> {
  const bucket = getBucketName();

  try {
    const response = await sendR2Command<GetObjectCommandOutput>(
      r2,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const bytes = await response.Body?.transformToByteArray();

    if (!bytes || bytes.length === 0) {
      throw new Error(`R2 object was empty: ${key}`);
    }

    return bytes;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "$metadata" in error) &&
      ((error as { name?: string }).name === "NoSuchKey" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    ) {
      throw new Error(`R2 object was not found: ${key}`);
    }

    throw error;
  }
}

export async function assertObjectExists({
  key,
  r2,
}: {
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = getBucketName();

  try {
    await sendR2Command<HeadObjectCommandOutput>(
      r2,
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "$metadata" in error) &&
      ((error as { name?: string }).name === "NoSuchKey" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    ) {
      throw new Error(`R2 object was not found: ${key}`);
    }

    throw error;
  }
}

export async function deleteObject({ key, r2 }: { key: string; r2: S3Client }): Promise<void> {
  const bucket = getBucketName();

  await sendR2Command<DeleteObjectCommandOutput>(
    r2,
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

async function sendR2Command<T>(r2: S3Client, command: unknown): Promise<T> {
  return (await (r2 as S3Client & R2SendCapableClient).send(command)) as T;
}

function getBucketName(): string {
  const bucket = process.env.STOCK_PREP_R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 bucket 名が設定されていません。");
  }

  return bucket;
}
