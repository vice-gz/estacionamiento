import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Historial from './Historial.jsx';
import './styles.css';

// Enrutador mínimo: /historial muestra el historial, cualquier otra ruta el monitor
const ruta = window.location.pathname.replace(/\/+$/, '') || '/';
const Pagina = ruta === '/historial' ? Historial : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Pagina />
  </React.StrictMode>
);
