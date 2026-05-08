import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  projectId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(16)
  syncSecret!: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
