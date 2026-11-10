import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './user.schema';

// Formato público do usuário (sem hash de senha), usado nas respostas da API.
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(data: { name: string; username: string; password: string; role?: UserRole }) {
    const existing = await this.userModel.findOne({ username: data.username.toLowerCase() });
    if (existing) throw new ConflictException('Usuário já existe');
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = new this.userModel({ ...data, passwordHash, role: data.role || UserRole.ATENDENTE });
    return user.save();
  }

  async findAll() {
    return this.userModel.find({ active: true }).select('-passwordHash').lean();
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.userModel.findById(id).select('-passwordHash').lean();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    // Documentos .lean() não têm o virtual `id`, então montamos o objeto.
    return {
      id: String(user._id),
      name: user.name,
      username: user.username,
      role: user.role,
      active: user.active,
    };
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username: username.toLowerCase() });
  }

  async update(id: string, data: Partial<{ name: string; role: UserRole; active: boolean }>) {
    const user = await this.userModel.findByIdAndUpdate(id, data, { new: true }).select('-passwordHash');
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async changePassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await this.userModel.findByIdAndUpdate(id, { passwordHash }, { new: true });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async validateUser(username: string, password: string) {
    const user = await this.findByUsername(username);
    if (!user || !user.active) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }
}