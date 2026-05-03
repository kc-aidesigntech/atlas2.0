import React from 'react'
import ReactDOM from 'react-dom/client'
import RootApp from './RootApp.jsx'
import './index.css'
import { ATLAS_APP_NAME } from '@atlas/shared'

// Keep title set before first render so browser history and auth redirects share the same app identity.
document.title = ATLAS_APP_NAME

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)

