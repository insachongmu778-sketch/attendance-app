import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import CheckInPage from './pages/CheckInPage';
import CheckOutPage from './pages/CheckOutPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 기본 경로는 관리자 페이지로 리다이렉트 */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/check-out" element={<CheckOutPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
