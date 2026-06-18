import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { NotificationProvider } from '../context/NotificationContext'
import { ScrollPreserveOnSubmit } from '../components/ScrollPreserveOnSubmit'
import { AppRoutes } from './routes'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollPreserveOnSubmit />
      <NotificationProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  )
}
