import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './app.css'

const racine = document.getElementById('racine')
if (!racine) throw new Error('Element #racine absent de index.html')

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>
)
