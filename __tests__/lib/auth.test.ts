describe('auth config', () => {
  it('exports auth, handlers, signIn, signOut', async () => {
    const mod = await import('@/lib/auth')
    expect(mod.auth).toBeDefined()
    expect(mod.handlers).toBeDefined()
    expect(mod.signIn).toBeDefined()
    expect(mod.signOut).toBeDefined()
  })
})
