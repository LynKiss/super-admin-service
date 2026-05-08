import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { SecretVaultService } from '../crypto/secret-vault.service';
import {
  ProjectAdminPermission,
  ProjectAdminPermissionSchema,
} from '../schemas/project-admin-permission.schema';
import { Project, ProjectSchema } from '../schemas/project.schema';
import { ProjectSyncClient } from './project-sync.client';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      {
        name: ProjectAdminPermission.name,
        schema: ProjectAdminPermissionSchema,
      },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectSyncClient, SecretVaultService],
})
export class ProjectsModule {}
