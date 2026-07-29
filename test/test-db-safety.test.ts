import { afterEach, describe, expect, it } from 'vitest'
import { connectionString } from './helpers/db'

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL
const originalAllowRemote = process.env.ALLOW_REMOTE_TEST_DATABASE
const originalDatabaseUrl = process.env.DATABASE_URL

afterEach(() => {
  if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL
  else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl

  if (originalAllowRemote === undefined) delete process.env.ALLOW_REMOTE_TEST_DATABASE
  else process.env.ALLOW_REMOTE_TEST_DATABASE = originalAllowRemote

  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe('destructive integration database guard', () => {
  it('uses the dedicated local test database by default', () => {
    delete process.env.TEST_DATABASE_URL

    expect(connectionString()).toContain('127.0.0.1:54330/endaxi_test')
  })

  it('rejects a database without the test suffix', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/endaxi'

    expect(() => connectionString()).toThrow('database name must end with "_test"')
  })

  it('rejects the application database even when it has a test-like name', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/endaxi_test'
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL

    expect(() => connectionString()).toThrow('TEST_DATABASE_URL matches DATABASE_URL')
  })

  it('requires an explicit opt-in for a remote test database', () => {
    process.env.TEST_DATABASE_URL = 'postgresql://user:pass@db.example.com/endaxi_test'
    delete process.env.ALLOW_REMOTE_TEST_DATABASE

    expect(() => connectionString()).toThrow('ALLOW_REMOTE_TEST_DATABASE=1')
  })
})
