'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const result = await signIn('credentials', {
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      redirect: false,
    })
    if (result?.ok) router.push('/internal/projects')
    else setError('Invalid credentials')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111110]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1 className="text-white text-xl font-semibold">CPP Admin</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          name="username"
          type="text"
          placeholder="Username"
          className="bg-zinc-900 text-white border border-zinc-700 rounded px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="bg-zinc-900 text-white border border-zinc-700 rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-white text-black font-medium rounded px-3 py-2 hover:bg-zinc-200"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
