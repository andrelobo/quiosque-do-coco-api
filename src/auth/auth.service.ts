import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        active: user.active,
      },
      token,
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }
}