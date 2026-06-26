

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setupFetchInterceptor } from './utils/fetchInterceptor'

// Initialize the global fetch interceptor to handle silent token rotation
setupFetchInterceptor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
