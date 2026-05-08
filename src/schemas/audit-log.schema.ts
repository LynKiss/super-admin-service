import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ default: null })
  actorId!: string | null;

  @Prop({ default: null })
  actorEmail!: string | null;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop({ default: null, index: true })
  projectId!: string | null;

  @Prop({ default: null })
  targetUserId!: string | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ default: null })
  ip!: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
