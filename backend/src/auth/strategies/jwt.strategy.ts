import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  supportLevels?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'replace-with-a-secure-random-256-bit-key-in-production',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or malformed token claims.');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (user) {
        // Strip sensitive password field before returning
        const { password, ...safeUser } = user;
        return safeUser;
      }
    } catch {
      // If database is not reachable, fall back to token payload
    }

    // Return the authenticated claims payload
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      supportLevels: payload.supportLevels || ['L1'],
    };
  }
}
