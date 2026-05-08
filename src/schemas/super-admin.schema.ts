import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SuperAdminDocument = HydratedDocument<SuperAdmin>;

@Schema({ timestamps: true, collection: 'super_admins' })
export class SuperAdmin {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ default: null })
  fullName!: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  mfaEnabled!: boolean;

  @Prop({ default: null })
  refreshTokenHash!: string | null;
}

export const SuperAdminSchema = SchemaFactory.createForClass(SuperAdmin);
