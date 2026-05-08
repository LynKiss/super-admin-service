import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import type { CookieOptions, Response } from 'express';
import ms = require('ms');
import type { StringValue } from 'ms';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { SuperAdmin, SuperAdminDocument } from '../schemas/super-admin.schema';
import { LoginDto } from './dto/login.dto';

type TokenPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(SuperAdmin.name)
    private readonly superAdminModel: Model<SuperAdminDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    const email = this.configService.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');

    if (!email || !password) return;

    const exists = await this.superAdminModel.exists({ email: email.toLowerCase() });
    if (exists) return;

    await this.superAdminModel.create({
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      fullName: 'Root Super Admin',
      isActive: true,
      mfaEnabled: false,
    });
  }

  async login(dto: LoginDto, response: Response, ip?: string | null) {
    const admin = await this.superAdminModel.findOne({ email: dto.email.toLowerCase() });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid super admin credentials');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid super admin credentials');
    }

    const payload: TokenPayload = { sub: admin._id.toString(), email: admin.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpires(),
    });

    admin.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await admin.save();
    this.setRefreshCookie(response, refreshToken);

    await this.auditService.record({
      actorId: admin._id.toString(),
      actorEmail: admin.email,
      action: 'super_admin.login',
      ip,
    });

    return {
      access_token: accessToken,
      access_token_expires_in: this.toSeconds(this.getAccessExpires()),
      refresh_token_expires_in: this.toSeconds(this.getRefreshExpires()),
      user: this.toPublicAdmin(admin),
    };
  }

  async refresh(refreshToken: string | undefined, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
      secret: this.getRefreshSecret(),
    });
    const admin = await this.superAdminModel.findById(payload.sub);
    if (!admin || !admin.isActive || !admin.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, admin.refreshTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextPayload: TokenPayload = { sub: admin._id.toString(), email: admin.email };
    const accessToken = this.jwtService.sign(nextPayload);
    const nextRefreshToken = this.jwtService.sign(nextPayload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpires(),
    });

    admin.refreshTokenHash = await bcrypt.hash(nextRefreshToken, 12);
    await admin.save();
    this.setRefreshCookie(response, nextRefreshToken);

    return {
      access_token: accessToken,
      access_token_expires_in: this.toSeconds(this.getAccessExpires()),
      user: this.toPublicAdmin(admin),
    };
  }

  async logout(userId: string, response: Response) {
    await this.superAdminModel.updateOne(
      { _id: userId },
      { $set: { refreshTokenHash: null } },
    );
    response.clearCookie('super_refresh_token', this.getRefreshCookieOptions());
    return { success: true };
  }

  private toPublicAdmin(admin: SuperAdminDocument) {
    return {
      _id: admin._id.toString(),
      email: admin.email,
      fullName: admin.fullName,
      isSuperAdmin: true,
      mfaEnabled: admin.mfaEnabled,
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie('super_refresh_token', refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: ms(this.getRefreshExpires()),
    });
  }

  private getRefreshCookieOptions(): CookieOptions {
    const sameSite = this.getCookieSameSite();
    const secureFromEnv = this.configService.get<string>('SUPER_ADMIN_COOKIE_SECURE');
    const secure =
      secureFromEnv === undefined
        ? process.env.NODE_ENV === 'production' || sameSite === 'none'
        : secureFromEnv === 'true';
    const domain = this.configService.get<string>('SUPER_ADMIN_COOKIE_DOMAIN');

    return {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private getCookieSameSite(): CookieOptions['sameSite'] {
    const configured = this.configService
      .get<string>('SUPER_ADMIN_COOKIE_SAME_SITE')
      ?.toLowerCase();

    if (configured === 'strict' || configured === 'lax' || configured === 'none') {
      return configured;
    }

    return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  }

  private getAccessExpires(): StringValue {
    return (this.configService.get<string>('SUPER_ADMIN_ACCESS_EXPIRES') as StringValue) ?? '900s';
  }

  private getRefreshExpires(): StringValue {
    return (this.configService.get<string>('SUPER_ADMIN_REFRESH_EXPIRES') as StringValue) ?? '7d';
  }

  private getRefreshSecret() {
    const secret = this.configService.get<string>('SUPER_ADMIN_REFRESH_SECRET');
    if (!secret) {
      throw new Error('SUPER_ADMIN_REFRESH_SECRET environment variable is required');
    }
    return secret;
  }

  private toSeconds(value: StringValue) {
    return Math.floor(ms(value) / 1000);
  }
}
