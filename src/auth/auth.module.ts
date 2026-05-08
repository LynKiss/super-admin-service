import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import ms = require('ms');
import type { StringValue } from 'ms';
import { AuditModule } from '../audit/audit.module';
import { SuperAdmin, SuperAdminSchema } from '../schemas/super-admin.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    MongooseModule.forFeature([{ name: SuperAdmin.name, schema: SuperAdminSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn =
          (configService.get<string>('SUPER_ADMIN_ACCESS_EXPIRES') as StringValue) ??
          '900s';
        return {
          secret: configService.get<string>('SUPER_ADMIN_JWT_SECRET') ?? 'change-me',
          signOptions: { expiresIn: Math.floor(ms(expiresIn) / 1000) },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
