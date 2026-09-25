import { afterEach, describe, expect, it } from 'vitest';
import {
  createLambdaScoreRepository,
  createLocalScoreRepository,
  createScoreRepository,
} from '../../src/application/create-score-repository.js';
import { InMemoryScoreRepository } from '../../src/adapters/in-memory-score-repository.js';
import { DynamoDbScoreRepository } from '../../src/adapters/dynamodb-score-repository.js';

describe('createScoreRepository', () => {
  it('returns an in-memory repository in local mode without a table name', () => {
    const repo = createScoreRepository({ source: 'local' });
    expect(repo).toBeInstanceOf(InMemoryScoreRepository);
  });

  it('returns a DynamoDB repository in local mode when a table name is provided', () => {
    const repo = createScoreRepository({ source: 'local', tableName: 'local-scores' });
    expect(repo).toBeInstanceOf(DynamoDbScoreRepository);
  });

  it('uses the provided endpoint for the DynamoDB client', () => {
    const repo = createScoreRepository({
      source: 'local',
      tableName: 'local-scores',
      endpoint: 'http://localhost:8000',
    });
    expect(repo).toBeInstanceOf(DynamoDbScoreRepository);
  });

  it('throws when lambda mode is requested without a table name', () => {
    expect(() => createScoreRepository({ source: 'lambda' })).toThrow(
      'Missing required configuration: tableName is required for source=lambda',
    );
  });
});

describe('createLambdaScoreRepository', () => {
  const originalTableName = process.env.SCORES_TABLE_NAME;

  afterEach(() => {
    if (originalTableName === undefined) {
      delete process.env.SCORES_TABLE_NAME;
    } else {
      process.env.SCORES_TABLE_NAME = originalTableName;
    }
  });

  it('returns a DynamoDB repository when SCORES_TABLE_NAME is set', () => {
    process.env.SCORES_TABLE_NAME = 'prod-scores';
    const repo = createLambdaScoreRepository();
    expect(repo).toBeInstanceOf(DynamoDbScoreRepository);
  });

  it('throws when SCORES_TABLE_NAME is missing', () => {
    delete process.env.SCORES_TABLE_NAME;
    expect(() => createLambdaScoreRepository()).toThrow(
      'Missing required environment variable: SCORES_TABLE_NAME',
    );
  });

  it('throws when SCORES_TABLE_NAME is empty', () => {
    process.env.SCORES_TABLE_NAME = '';
    expect(() => createLambdaScoreRepository()).toThrow(
      'Missing required environment variable: SCORES_TABLE_NAME',
    );
  });
});

describe('createLocalScoreRepository', () => {
  const originalTableName = process.env.SCORES_TABLE_NAME;
  const originalEndpoint = process.env.DYNAMODB_ENDPOINT;

  afterEach(() => {
    if (originalTableName === undefined) {
      delete process.env.SCORES_TABLE_NAME;
    } else {
      process.env.SCORES_TABLE_NAME = originalTableName;
    }

    if (originalEndpoint === undefined) {
      delete process.env.DYNAMODB_ENDPOINT;
    } else {
      process.env.DYNAMODB_ENDPOINT = originalEndpoint;
    }
  });

  it('defaults to the in-memory repository', () => {
    delete process.env.SCORES_TABLE_NAME;
    const repo = createLocalScoreRepository();
    expect(repo).toBeInstanceOf(InMemoryScoreRepository);
  });

  it('uses DynamoDB when SCORES_TABLE_NAME is set', () => {
    process.env.SCORES_TABLE_NAME = 'local-scores';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    const repo = createLocalScoreRepository();
    expect(repo).toBeInstanceOf(DynamoDbScoreRepository);
  });
});
