import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  projectId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  record(input: AuditInput) {
    return this.auditLogModel.create({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      projectId: input.projectId ?? null,
      targetUserId: input.targetUserId ?? null,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
    });
  }

  async list(limit = 100, projectId?: string) {
    const filter = projectId ? { projectId } : {};
    return this.auditLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .lean();
  }
}
