import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
//it loads the app into the browser using react DOM
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)