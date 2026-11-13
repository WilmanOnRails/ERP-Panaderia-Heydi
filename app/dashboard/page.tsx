import { ErpDashboard } from '@/components/erp-dashboard'
import { LogoutButton } from '@/components/logout-button'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  return (
    <>
      <div className="session-controls">
        <span>{user.fullName}</span>
        <LogoutButton />
      </div>
      <ErpDashboard isAdmin={user.role === 'administrador'} />
    </>
  )
}
