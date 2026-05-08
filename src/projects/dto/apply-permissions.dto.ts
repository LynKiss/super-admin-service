import { IsArray, IsOptional, IsString } from 'class-validator';

export class ApplyPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];

  @IsOptional()
  @IsString()
  targetEmail?: string;
}
