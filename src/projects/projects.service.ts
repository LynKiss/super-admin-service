import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { CurrentSuperAdmin } from '../decorators/current-user.decorator';
import { SecretVaultService } from '../crypto/secret-vault.service';
import {
  ProjectAdminPermission,
  ProjectAdminPermissionDocument,
} from '../schemas/project-admin-permission.schema';
import { Project, ProjectDocument } from '../schemas/project.schema';
import { ApplyPermissionsDto } from './dto/apply-permissions.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectSyncClient } from './project-sync.client';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectAdminPermission.name)
    private readonly projectAdminPermissionModel: Model<ProjectAdminPermissionDocument>,
    private readonly secretVault: SecretVaultService,
    private readonly projectSyncClient: ProjectSyncClient,
    private readonly auditService: AuditService,
  ) {}

  async createProject(dto: CreateProjectDto, actor: CurrentSuperAdmin, ip?: string | null) {
    const existing = await this.projectModel.exists({ projectId: dto.projectId });
    if (existing) {
      throw new ConflictException('Project ID already exists');
    }

    const project = await this.projectModel.create({
      projectId: dto.projectId,
      name: dto.name,
      baseUrl: dto.baseUrl.replace(/\/+$/, ''),
      syncSecretCiphertext: this.secretVault.encrypt(dto.syncSecret),
      syncSecretHash: this.secretVault.hash(dto.syncSecret),
      status: dto.status ?? 'active',
    });

    await this.auditService.record({
      actorId: actor._id,
      actorEmail: actor.email,
      action: 'project.create',
      projectId: project.projectId,
      ip,
    });

    return this.toPublicProject(project);
  }

  async updateProject(projectId: string, dto: UpdateProjectDto, actor: CurrentSuperAdmin, ip?: string | null) {
    const project = await this.requireProject(projectId);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.baseUrl !== undefined) project.baseUrl = dto.baseUrl.replace(/\/+$/, '');
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.syncSecret !== undefined) {
      project.syncSecretCiphertext = this.secretVault.encrypt(dto.syncSecret);
      project.syncSecretHash = this.secretVault.hash(dto.syncSecret);
    }

    await project.save();
    await this.auditService.record({
      actorId: actor._id,
      actorEmail: actor.email,
      action: 'project.update',
      projectId,
      ip,
    });

    return this.toPublicProject(project);
  }

  async listProjects() {
    const projects = await this.projectModel.find().sort({ createdAt: -1 });
    return projects.map((project) => this.toPublicProject(project));
  }

  async listProjectPermissions(projectId: string) {
    const project = await this.requireActiveProject(projectId);
    const secret = this.secretVault.decrypt(project.syncSecretCiphertext);
    return this.projectSyncClient.get(
      project.baseUrl,
      secret,
      '/api/v1/internal/super-admin/permissions',
    );
  }

  async listProjectAdmins(projectId: string) {
    const project = await this.requireActiveProject(projectId);
    const secret = this.secretVault.decrypt(project.syncSecretCiphertext);
    return this.projectSyncClient.get(
      project.baseUrl,
      secret,
      '/api/v1/internal/super-admin/admins',
    );
  }

  async applyPermissions(
    projectId: string,
    targetUserId: string,
    dto: ApplyPermissionsDto,
    actor: CurrentSuperAdmin,
    ip?: string | null,
  ) {
    const project = await this.requireActiveProject(projectId);
    const permissionKeys = [...new Set(dto.permissionKeys.map((key) => key.trim()).filter(Boolean))];

    // Save to MongoDB first so there's always a record, then sync to BE
    const record = await this.projectAdminPermissionModel.findOneAndUpdate(
      { projectId, targetUserId },
      {
        $set: {
          projectId,
          targetUserId,
          targetEmail: dto.targetEmail ?? null,
          permissionKeys,
          updatedBy: actor._id,
        },
      },
      { upsert: true, new: true },
    );

    const secret = this.secretVault.decrypt(project.syncSecretCiphertext);
    const syncResult = await this.projectSyncClient.put(
      project.baseUrl,
      secret,
      `/api/v1/internal/super-admin/admins/${encodeURIComponent(targetUserId)}/permissions?projectId=${encodeURIComponent(projectId)}`,
      {
        permissionKeys,
        syncedBy: actor.email,
      },
    );

    await this.auditService.record({
      actorId: actor._id,
      actorEmail: actor.email,
      action: 'admin_permissions.apply',
      projectId,
      targetUserId,
      metadata: { permissionKeys },
      ip,
    });

    return {
      permissionSet: record,
      syncResult,
    };
  }

  async deleteProject(projectId: string, actor: CurrentSuperAdmin, ip?: string | null) {
    const project = await this.requireProject(projectId);
    await this.projectAdminPermissionModel.deleteMany({ projectId });
    await this.projectModel.deleteOne({ projectId });
    await this.auditService.record({
      actorId: actor._id,
      actorEmail: actor.email,
      action: 'project.delete',
      projectId,
      ip,
    });
    return { deleted: true, projectId: project.projectId };
  }

  async listPermissionSets(projectId: string) {
    await this.requireProject(projectId);
    return this.projectAdminPermissionModel
      .find({ projectId })
      .sort({ updatedAt: -1 })
      .lean();
  }

  private async requireProject(projectId: string) {
    const project = await this.projectModel.findOne({ projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async requireActiveProject(projectId: string) {
    const project = await this.requireProject(projectId);
    if (project.status !== 'active') {
      throw new NotFoundException('Project is not active');
    }

    return project;
  }

  private toPublicProject(project: ProjectDocument) {
    const timestampedProject = project as ProjectDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };

    return {
      _id: project._id.toString(),
      projectId: project.projectId,
      name: project.name,
      baseUrl: project.baseUrl,
      status: project.status,
      createdAt: timestampedProject.createdAt,
      updatedAt: timestampedProject.updatedAt,
      syncSecretConfigured: Boolean(project.syncSecretHash),
    };
  }
}
