import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentSuperAdmin, CurrentUser } from '../decorators/current-user.decorator';
import { ApplyPermissionsDto } from './dto/apply-permissions.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('projects')
  listProjects() {
    return this.projectsService.listProjects();
  }

  @Post('projects')
  createProject(
    @CurrentUser() actor: CurrentSuperAdmin,
    @Req() request: Request,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(dto, actor, request.ip);
  }

  @Patch('projects/:projectId')
  updateProject(
    @Param('projectId') projectId: string,
    @CurrentUser() actor: CurrentSuperAdmin,
    @Req() request: Request,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(projectId, dto, actor, request.ip);
  }

  @Delete('projects/:projectId')
  deleteProject(
    @Param('projectId') projectId: string,
    @CurrentUser() actor: CurrentSuperAdmin,
    @Req() request: Request,
  ) {
    return this.projectsService.deleteProject(projectId, actor, request.ip);
  }

  @Get('projects/:projectId/permissions')
  listProjectPermissions(@Param('projectId') projectId: string) {
    return this.projectsService.listProjectPermissions(projectId);
  }

  @Get('projects/:projectId/admins')
  listProjectAdmins(@Param('projectId') projectId: string) {
    return this.projectsService.listProjectAdmins(projectId);
  }

  @Get('projects/:projectId/permission-sets')
  listPermissionSets(@Param('projectId') projectId: string) {
    return this.projectsService.listPermissionSets(projectId);
  }

  @Put('projects/:projectId/admins/:userId/permissions')
  applyPermissions(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: CurrentSuperAdmin,
    @Req() request: Request,
    @Body() dto: ApplyPermissionsDto,
  ) {
    return this.projectsService.applyPermissions(projectId, userId, dto, actor, request.ip);
  }

  @Get('audit-logs')
  listAuditLogs(
    @Query('limit') limit = '100',
    @Query('projectId') projectId?: string,
  ) {
    return this.auditService.list(Number(limit) || 100, projectId);
  }
}
