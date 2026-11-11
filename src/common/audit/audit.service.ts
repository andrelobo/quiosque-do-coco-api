import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit.schema';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>) {}

  async log(data: {
    action: string;
    entity: string;
    entityId?: Types.ObjectId;
    userId?: Types.ObjectId;
    userName?: string;
    justification?: string;
    meta?: Record<string, any>;
  }) {
    // Preenche o nome do usuário quando só o id foi informado, para o log ficar
    // legível sem depender dos .populate() de cada serviço.
    let userName = data.userName;
    if (!userName && data.userId) {
      const user = await this.auditLogModel.db
        .model('User')
        .findById(data.userId)
        .select('name')
        .lean();
      userName = (user as any)?.name;
    }
    return this.auditLogModel.create({ ...data, userName });
  }

  async findByEntity(entity: string, entityId: Types.ObjectId) {
    return this.auditLogModel
      .find({ entity, entityId })
      .sort({ at: -1 })
      .lean();
  }

  async findAll(filter: { action?: string; entity?: string; userId?: Types.ObjectId; start?: Date; end?: Date } = {}) {
    const query: any = {};
    if (filter.action) query.action = filter.action;
    if (filter.entity) query.entity = filter.entity;
    if (filter.userId) query.user = filter.userId;
    if (filter.start || filter.end) {
      query.at = {};
      if (filter.start) query.at.$gte = filter.start;
      if (filter.end) query.at.$lte = filter.end;
    }
    return this.auditLogModel.find(query).sort({ at: -1 }).limit(200).lean();
  }
}