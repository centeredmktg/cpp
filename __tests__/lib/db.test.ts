describe('db client', () => {
  it('instantiates without throwing', async () => {
    process.env.DATABASE_URL = 'file:prisma/dev.db'
    await expect(import('@/lib/db')).resolves.toBeDefined()
  })
})
