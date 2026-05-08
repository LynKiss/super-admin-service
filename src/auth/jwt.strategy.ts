import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SuperAdmin, SuperAdminDocument } from '../schemas/super-admin.schema';

type JwtPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(SuperAdmin.name)
    private readonly superAdminModel: Model<SuperAdminDocument>,
  ) {
    const jwtSecret = configService.get<string>('SUPER_ADMIN_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('SUPER_ADMIN_JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const admin = await this.superAdminModel.findById(payload.sub).lean();
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Super admin account is not active');
    }

    return {
      _id: admin._id.toString(),
      email: admin.email,
      fullName: admin.fullName,
    };
  }
}
