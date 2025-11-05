import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WorkItems from './components/WorkItems';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/workitems" element={<WorkItems />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);