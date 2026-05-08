import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProjectAdminPermissionDocument = HydratedDocument<ProjectAdminPermission>;

@Schema({ timestamps: true, collection: 'project_admin_permissions' })
export class ProjectAdminPermission {
  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  targetUserId!: string;

  @Prop({ default: null, lowercase: true, trim: true })
  targetEmail!: string | null;

  @Prop({ type: [String], default: [] })
  permissionKeys!: string[];

  @Prop({ required: true })
  updatedBy!: string;
}

export const ProjectAdminPermissionSchema = SchemaFactory.createForClass(ProjectAdminPermission);
ProjectAdminPermissionSchema.index({ projectId: 1, targetUserId: 1 }, { unique: true });
