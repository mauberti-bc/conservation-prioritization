import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { PublishAnalyticalSource } from '../../../models/analytical-source';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { AnalyticalSourceRepository } from '../../../repositories/analytical-source-repository';
import { requireServiceKey } from '../../../request-handlers/security/service-key';

export const POST: Operation = [requireServiceKey(), publishAnalyticalSource()];
POST.apiDoc = {
  description: 'Register a validated immutable analytical source after its manifest is committed.',
  tags: ['analytical-sources', 'internal'],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name', 'version', 'uri', 'checksum', 'format', 'schema_metadata', 'is_default'],
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            uri: { type: 'string' },
            checksum: { type: 'string' },
            format: { type: 'string', enum: ['zarr'] },
            schema_metadata: { type: 'object', additionalProperties: true },
            is_default: { type: 'boolean' }
          }
        }
      }
    }
  },
  responses: {
    201: { description: 'Published analytical source.' },
    ...defaultErrorResponses
  }
};

/** Registers only complete source manifests with explicit layer contracts. */
export function publishAnalyticalSource(): RequestHandler {
  return async (req, res) => {
    const request = req.body as PublishAnalyticalSource;
    const contracts = request.schema_metadata?.layer_contracts;
    const descriptors = request.schema_metadata?.layer_descriptors;
    const storageModel = request.schema_metadata?.storage_model;
    if (!contracts || typeof contracts !== 'object' || Array.isArray(contracts)) {
      return res.status(400).json({ message: 'Published sources require layer_contracts metadata.' });
    }
    if (!descriptors || typeof descriptors !== 'object' || Array.isArray(descriptors)) {
      return res.status(400).json({ message: 'Published sources require native layer_descriptors metadata.' });
    }
    if (storageModel !== 'authoritative_native_resolution_v1') {
      return res.status(400).json({ message: 'Published sources must use authoritative native-resolution storage.' });
    }
    const contractIds = Object.keys(contracts as Record<string, unknown>).sort();
    const descriptorRecord = descriptors as Record<string, unknown>;
    const descriptorIds = Object.keys(descriptorRecord).sort();
    if (JSON.stringify(contractIds) !== JSON.stringify(descriptorIds)) {
      return res.status(400).json({ message: 'Every layer contract requires exactly one native descriptor.' });
    }
    const invalidDescriptor = descriptorIds.find((layerId) => !isCompleteNativeDescriptor(descriptorRecord[layerId]));
    if (invalidDescriptor) {
      return res.status(400).json({ message: `Layer ${invalidDescriptor} has incomplete native grid metadata.` });
    }
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();
      const source = await new AnalyticalSourceRepository(connection).publishSource(request);
      await connection.commit();
      return res.status(201).json(source);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/** Validates the spatial fields required to map one authoritative native array. */
function isCompleteNativeDescriptor(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }
  const descriptor = candidate as Record<string, unknown>;
  return (
    typeof descriptor.array_path === 'string' &&
    typeof descriptor.crs === 'string' &&
    Array.isArray(descriptor.transform) &&
    descriptor.transform.length === 6 &&
    Number.isInteger(descriptor.width) &&
    Number(descriptor.width) > 0 &&
    Number.isInteger(descriptor.height) &&
    Number(descriptor.height) > 0 &&
    Number.isFinite(Number(descriptor.native_resolution)) &&
    Number(descriptor.native_resolution) > 0 &&
    Array.isArray(descriptor.chunks) &&
    descriptor.chunks.length === 2 &&
    typeof descriptor.dtype === 'string'
  );
}
