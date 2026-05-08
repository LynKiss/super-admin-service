import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

type ProjectApiEnvelope<T> = {
  data: T;
};

@Injectable()
export class ProjectSyncClient {
  constructor(private readonly configService: ConfigService) {}

  async get<T>(baseUrl: string, secret: string, path: string) {
    return this.request<T>(baseUrl, secret, path, 'GET');
  }

  async put<T>(baseUrl: string, secret: string, path: string, body: unknown) {
    return this.request<T>(baseUrl, secret, path, 'PUT', body);
  }

  private async request<T>(
    baseUrl: string,
    secret: string,
    path: string,
    method: 'GET' | 'PUT',
    body?: unknown,
  ): Promise<T> {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const timestamp = Date.now().toString();
    const bodyText = body === undefined ? '' : JSON.stringify(body);
    const hmacPayload = [timestamp, method, normalizedPath, bodyText].join('.');
    const signature = createHmac('sha256', secret).update(hmacPayload).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(this.configService.get<string>('PROJECT_SYNC_TIMEOUT_MS') ?? '10000'),
    );

    try {
      const response = await fetch(`${normalizedBaseUrl}${normalizedPath}`, {
        method,
        body: bodyText || undefined,
        headers: {
          'Content-Type': 'application/json',
          'x-sa-timestamp': timestamp,
          'x-sa-signature': signature,
        },
        signal: controller.signal,
      });

      const responsePayload = (await response.json()) as ProjectApiEnvelope<T> | T | { message?: string };
      if (!response.ok) {
        const message =
          typeof responsePayload === 'object' && responsePayload && 'message' in responsePayload
            ? responsePayload.message
            : `Project API failed with ${response.status}`;
        throw new BadGatewayException(
          `Khong the dong bo voi backend du an (${response.status}): ${message}`,
        );
      }

      return typeof responsePayload === 'object' && responsePayload && 'data' in responsePayload
        ? (responsePayload as ProjectApiEnvelope<T>).data
        : (responsePayload as T);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      throw new BadGatewayException(
        `Khong the ket noi backend du an ${normalizedBaseUrl}. Hay kiem tra Base URL da deploy online va SUPER_ADMIN_SYNC_SECRET. Chi tiet: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
