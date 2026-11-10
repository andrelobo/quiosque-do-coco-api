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
    return this.auditLogModel.create(data);
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