import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const payload = { sub: user._id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        active: user.active,
      },
      token,
    };
  }

  async register(data: { name: string; username: string; password: string; role?: UserRole }) {
    return this.usersService.create(data);
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }
}