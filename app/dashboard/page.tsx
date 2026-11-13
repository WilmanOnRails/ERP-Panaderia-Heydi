import { ErpDashboard } from '@/components/erp-dashboard'
import { LogoutButton } from '@/components/logout-button'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  return (
    <ErpDashboard
      currentUser={{ id: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone, role: user.role }}
      isAdmin={user.role === 'administrador'}
      logoutButton={<LogoutButton />}
    />
  )
}
