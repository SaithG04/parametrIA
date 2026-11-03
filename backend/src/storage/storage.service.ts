import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { S3ServiceException } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

@Injectable()
export class FileStorageService {
  private readonly bucket = process.env.MINIO_BUCKET ?? "";
  private readonly client: S3Client;
  private bucketReady: Promise<void> | null = null;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new InternalServerErrorException({
        message: "Falta configurar el almacenamiento de archivos.",
        errors: ["OBJECT_STORAGE_CONFIG_MISSING"],
      });
    }
    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async saveDocument(input: {
    classroomId: string;
    studentId: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }) {
    await this.ensureBucket();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${input.classroomId}/${input.studentId}/${randomUUID()}-${safeName}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: input.buffer,
      ContentLength: input.buffer.byteLength,
      ContentType: input.contentType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    return key;
  }

  async getDocument(key: string) {
    await this.ensureBucket();
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new InternalServerErrorException("No se pudo recuperar el documento de evaluación.");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async deleteDocument(key: string) {
    await this.ensureBucket();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async saveProviderLogo(input: { fileName: string; contentType: string; buffer: Buffer }) {
    await this.ensureBucket();
    const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
    const key = `provider-logos/${randomUUID()}.${extension}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: input.buffer,
      ContentLength: input.buffer.byteLength,
      ContentType: input.contentType,
    }));
    return key;
  }

  async getProviderLogo(key: string) {
    await this.ensureBucket();
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async saveUniversityLogo(input: { fileName: string; contentType: string; buffer: Buffer }) {
    await this.ensureBucket();
    const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
    const key = `university-logos/${randomUUID()}.${extension}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: input.buffer,
      ContentLength: input.buffer.byteLength,
      ContentType: input.contentType,
    }));
    return key;
  }

  async getUniversityLogo(key: string) {
    await this.ensureBucket();
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async ensureBucket() {
    this.bucketReady ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404) {
          throw error;
        }
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      }
    })();
    await this.bucketReady;
  }
}
