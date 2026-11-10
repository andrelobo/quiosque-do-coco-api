import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

export enum UserRole {
  ADMIN = 'admin',
  RESPONSAVEL = 'responsavel',
  ATENDENTE = 'atendente',
}

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ enum: UserRole, default: UserRole.ATENDENTE })
  role: UserRole;

  @Prop({ default: true })
  active: boolean;

  async setPassword(plain: string): Promise<void> {
    this.passwordHash = await bcrypt.hash(plain, 10);
  }

  async checkPassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.passwordHash);
  }

  toSafe() {
    return {
      id: this._id,
      name: this.name,
      username: this.username,
      role: this.role,
      active: this.active,
    };
  }
}

export const UserSchema = SchemaFactory.createForClass(User);