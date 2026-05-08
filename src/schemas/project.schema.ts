import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, unique: true, trim: true })
  projectId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  baseUrl!: string;

  @Prop({ required: true })
  syncSecretCiphertext!: string;

  @Prop({ required: true })
  syncSecretHash!: string;

  @Prop({ enum: ['active', 'disabled'], default: 'active' })
  status!: 'active' | 'disabled';
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
