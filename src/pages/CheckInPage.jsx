import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { CheckCircle, UserCheck } from 'lucide-react';
import './CheckInPage.css';

export default function CheckInPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const sessionName = searchParams.get('name');
  const sessionDate = searchParams.get('date');
  const sessionStartTime = searchParams.get('startTime');
  const sessionEndTime = searchParams.get('endTime');
  
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 1차 방어: 로컬 스토리지 확인 (새로고침 방지)
  useEffect(() => {
    if (sessionId) {
      const checkedInName = localStorage.getItem(`checkin_name_${sessionId}`);
      if (checkedInName) {
        setEmpName(checkedInName);
        setIsSubmitted(true);
      }
    }
  }, [sessionId]);
  
  // URL에 세션 정보가 없는 경우 예외 처리
  if (!sessionId) {
    return (
      <div className="checkin-container">
        <div className="card checkin-card">
          <h2>잘못된 접근입니다</h2>
          <p>유효한 QR 코드를 스캔해주세요.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empId.trim() || !empName.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const payload = {
        sessionId: sessionId || 'unknown',
        sessionName: sessionName || 'unknown',
        empId: empId,
        empName: empName,
        userAgent: navigator.userAgent
      };
      
      const response = await fetch('https://script.google.com/macros/s/AKfycbyBxRD36k07suV8TkTlTBQzEL8l0NyFASgy6WCVbim1kphE4PYmxmwhorDt-4HBSLc/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });
      
      const resultData = await response.json();
      
      // 2차 방어: 구글 시트에서 사번 중복 에러 반환 시
      if (resultData.result === "duplicate") {
        alert("이미 출석 처리된 사번입니다. (중복 출석 불가)");
        return;
      }
      
      // 성공 시 로컬 스토리지에 기록 후 화면 전환
      localStorage.setItem(`checkin_name_${sessionId}`, empName);
      setIsSubmitted(true);
      triggerConfetti();
    } catch (error) {
      console.error("Error submitting attendance:", error);
      alert("출석 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  return (
    <div className="checkin-container">
      <div className="card checkin-card animate-fade-in">
        
        {!isSubmitted ? (
          <>
            <div className="checkin-header">
              <span className="session-badge">출석 체크</span>
              <h1 className="session-title">{sessionName || "교육 세션"}</h1>
              {(sessionDate || sessionStartTime || sessionEndTime) && (
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1rem', fontWeight: '500' }}>
                  📅 {sessionDate} {sessionStartTime && `⏰ ${sessionStartTime}`} {sessionEndTime && `~ ${sessionEndTime}`}
                </p>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="checkin-form">
              <div className="form-group">
                <label htmlFor="empId">사번</label>
                <input
                  id="empId"
                  type="text"
                  placeholder="예: 2026001"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="empName">이름</label>
                <input
                  id="empName"
                  type="text"
                  placeholder="예: 홍길동"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              
              <button type="submit" className="btn-primary submit-btn" disabled={!empId.trim() || !empName.trim() || isSubmitting}>
                <UserCheck size={20} />
                {isSubmitting ? '처리 중...' : '출석 완료하기'}
              </button>
            </form>
          </>
        ) : (
          <div className="success-container animate-fade-in">
            <div className="success-icon-wrapper">
              <CheckCircle size={48} />
            </div>
            <h2 className="success-title">출석 완료!</h2>
            <p className="success-message">
              {empName ? <strong>{empName}님, </strong> : ''}출석이 정상적으로 처리되었습니다.
            </p>
            <p className="success-submessage">이제 스마트폰 화면을 닫으셔도 됩니다.</p>
          </div>
        )}
        
      </div>
    </div>
  );
}
