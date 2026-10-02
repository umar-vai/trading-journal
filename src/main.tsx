import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Phase2Workspace from './Phase2Workspace'
import './styles.css'
import './info-tip-compact.css'
import './trade-tools-position.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Phase2Workspace />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('Service worker registration failed:', error)
    })
  })
}
