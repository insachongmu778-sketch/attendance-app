import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { PlusCircle, ArrowLeft, Download, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';
import './AdminPage.css';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const authTime = sessionStorage.getItem('admin_auth_time');
    if (!authTime) return false;
    const isExpired = Date.now() - parseInt(authTime, 10) > 10 * 60 * 1000; // 10분 초과 시
    if (isExpired) {
      sessionStorage.removeItem('admin_auth_time');
      return false;
    }
    return true;
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState('');
  const [sessionEndTime, setSessionEndTime] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [qrMode, setQrMode] = useState('check-in'); // 'check-in' or 'check-out'
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 실제 출석 데이터 (Google Sheets 연동)
  const [attendees, setAttendees] = useState([]);
  
  const API_URL = 'https://script.google.com/macros/s/AKfycbxSrQEi1xlGab7i-4IfyuAKeaQlkt6KnL7O9CesVeX6VR4Oyuu6E8EORQBQKDQT9Uhh/exec';

  // 10분 타이머 체크 (자동 로그아웃) 및 활동 시 타이머 갱신
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // 5초마다 남은 시간 체크
    const checkAuthInterval = setInterval(() => {
      const authTime = sessionStorage.getItem('admin_auth_time');
      if (authTime && Date.now() - parseInt(authTime, 10) > 10 * 60 * 1000) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_auth_time');
        alert("마지막 사용 후 10분이 경과되어 자동으로 로그아웃 되었습니다.");
      }
    }, 5000);
    
    // 사용자 활동 감지 시 타이머 갱신 (스로틀링 적용)
    let throttleTimeout = null;
    const updateAuthTime = () => {
      if (!throttleTimeout) {
        sessionStorage.setItem('admin_auth_time', Date.now().toString());
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // 1초에 최대 1번만 갱신 (성능 최적화)
      }
    };

    window.addEventListener('mousemove', updateAuthTime);
    window.addEventListener('mousedown', updateAuthTime);
    window.addEventListener('keydown', updateAuthTime);
    window.addEventListener('touchstart', updateAuthTime);
    window.addEventListener('scroll', updateAuthTime);
    
    return () => {
      clearInterval(checkAuthInterval);
      window.removeEventListener('mousemove', updateAuthTime);
      window.removeEventListener('mousedown', updateAuthTime);
      window.removeEventListener('keydown', updateAuthTime);
      window.removeEventListener('touchstart', updateAuthTime);
      window.removeEventListener('scroll', updateAuthTime);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isAuthenticated]);

  // 초기 로드 시 서버에서 활성 세션 가져오기
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchActiveSession = async () => {
      try {
        const response = await fetch(`${API_URL}?action=get-active-session`);
        const data = await response.json();
        if (data && data.id) { // 세션 데이터가 있으면
          setActiveSession(data);
        }
      } catch (error) {
        console.error("Failed to fetch active session:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActiveSession();
  }, [isAuthenticated]);

  // 5초마다 구글 시트에서 출석자 목록 및 활성 세션 상태를 가져옵니다
  useEffect(() => {
    let intervalId;
    
    const fetchAttendeesAndStatus = async () => {
      if (!activeSession) return;
      
      try {
        // 활성 세션 상태 확인
        const sessionRes = await fetch(`${API_URL}?action=get-active-session`);
        const sessionData = await sessionRes.json();
        
        // 다른 기기에서 세션이 종료된 경우
        if (!sessionData || !sessionData.id) {
          setActiveSession(null);
          setAttendees([]);
          alert("세션이 종료되었습니다.");
          return;
        }

        // 출석자 목록 갱신
        const url = `${API_URL}?sessionName=${encodeURIComponent(activeSession.name)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        // data는 2차원 배열 형태 (시트 데이터)
        if (Array.isArray(data) && data.length > 1) {
          const rows = data.slice(1);
          setAttendees(rows.reverse());
        } else {
          setAttendees([]);
        }
      } catch (error) {
        console.error("Failed to fetch attendees or status:", error);
      }
    };

    if (activeSession) {
      fetchAttendeesAndStatus(); // 즉시 1회 호출
      intervalId = setInterval(fetchAttendeesAndStatus, 5000); // 5초마다 갱신
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSession]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'chaedu2026!') {
      sessionStorage.setItem('admin_auth_time', Date.now().toString());
      setIsAuthenticated(true);
      setLoginError(false);
      setPasswordInput(''); // 로그인 성공 시 비밀번호 입력창 초기화
    } else {
      setLoginError(true);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionName.trim()) return;
    
    setIsProcessing(true);
    
    try {
      // 타임스탬프와 랜덤 문자열을 조합하여 고유한 세션 ID 생성
      const randomString = Math.random().toString(36).substring(2, 8);
      const sessionId = `session_${Date.now()}_${randomString}`;
      
      // url 구성 (로컬 개발환경 기준)
      const params = `sessionId=${sessionId}&name=${encodeURIComponent(sessionName)}&date=${encodeURIComponent(sessionDate)}&startTime=${encodeURIComponent(sessionStartTime)}&endTime=${encodeURIComponent(sessionEndTime)}`;
      const checkInUrl = `${window.location.origin}/check-in?${params}`;
      const checkOutUrl = `${window.location.origin}/check-out?${params}`;
      
      const newSession = {
        id: sessionId,
        name: sessionName,
        date: sessionDate,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        checkInUrl,
        checkOutUrl
      };
      
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'create-session', ...newSession })
      });
      
      setActiveSession(newSession);
      setQrMode('check-in');
      setAttendees([]);
    } catch (error) {
      console.error("Failed to create session:", error);
      alert("세션 생성 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("정말로 세션을 종료하시겠습니까? (다른 기기에서도 즉시 종료됩니다)")) return;
    
    setIsProcessing(true);
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'end-session' })
      });
      
      setActiveSession(null);
      setSessionName('');
      setSessionDate('');
      setSessionStartTime('');
      setSessionEndTime('');
      setAttendees([]);
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("세션 종료 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadQR = async () => {
    const element = document.getElementById("qr-export-section");
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        backgroundColor: '#ffffff'
      });
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      const safeName = activeSession.name.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      downloadLink.download = `${safeName}_안내문.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error("이미지 캡처 오류:", error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="card admin-card animate-fade-in" style={{ maxWidth: '400px', padding: '3rem 2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <Lock size={32} color="#2563eb" />
            </div>
            <h2 style={{ margin: 0, color: '#0f172a' }}>관리자 로그인</h2>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>접근 권한이 필요합니다</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                placeholder="비밀번호를 입력하세요"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setLoginError(false);
                }}
                autoFocus
              />
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>비밀번호가 일치하지 않습니다.</p>}
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              접속하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="card admin-card animate-fade-in">
        <div className="admin-header">
          <h1 className="admin-title">출석 관리 시스템</h1>
          <p className="admin-subtitle">Employee Attendance Manager</p>
        </div>
        
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '1.1rem' }}>
            서버와 동기화 중입니다...
          </div>
        ) : !activeSession ? (
          <form onSubmit={handleCreateSession} className="create-session-form">
            <div className="form-group">
              <label className="form-label" htmlFor="sessionName">새로운 교육 세션 이름</label>
              <input
                id="sessionName"
                className="form-input"
                type="text"
                placeholder="예: 2026년 상반기 전체 회의"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                autoFocus
                disabled={isProcessing}
              />
            </div>

            <div className="date-time-group">
              <div>
                <label className="form-label" htmlFor="sessionDate">교육 일자</label>
                <input
                  id="sessionDate"
                  className="form-input"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="form-label">교육 시간 (시작 ~ 종료)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="time"
                    className="form-input"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    disabled={isProcessing}
                  />
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>~</span>
                  <input
                    type="time"
                    className="form-input"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={!sessionName.trim() || isProcessing}>
              <PlusCircle size={22} />
              {isProcessing ? '서버에 저장 중...' : '새로운 QR 코드 발급하기'}
            </button>
          </form>
        ) : (
          <div className="qr-section animate-fade-in">
            <div id="qr-export-section" style={{ padding: '2.5rem', backgroundColor: '#ffffff', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', width: 'fit-content', minWidth: '400px', maxWidth: '100%' }}>
              <div className="session-info" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', width: '100%', wordBreak: 'keep-all' }}>
                <span className="badge" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>진행중</span>
                <h2 style={{ fontSize: '1.75rem', margin: 0, textAlign: 'center', lineHeight: '1.3' }}>{activeSession.name}</h2>
              </div>
              
              {(activeSession.date || activeSession.startTime || activeSession.endTime) && (
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '500' }}>
                  📅 {activeSession.date} {activeSession.startTime && `⏰ ${activeSession.startTime}`} {activeSession.endTime && `~ ${activeSession.endTime}`}
                </p>
              )}
              
              <div className="qr-toggle-container">
                <button 
                  className={`qr-toggle-btn ${qrMode === 'check-in' ? 'active' : ''}`}
                  onClick={() => setQrMode('check-in')}
                  type="button"
                >
                  출석 체크 QR
                </button>
                <button 
                  className={`qr-toggle-btn checkout ${qrMode === 'check-out' ? 'active' : ''}`}
                  onClick={() => setQrMode('check-out')}
                  type="button"
                >
                  종료 체크 QR
                </button>
              </div>

              <p className="instruction-text" style={{ marginBottom: '2rem', fontSize: '1.1rem', wordBreak: 'keep-all', textAlign: 'center' }}>
                스마트폰 카메라로 아래 <strong>{qrMode === 'check-in' ? '출석 체크' : '종료 체크'} QR 코드</strong>를 스캔해주세요
              </p>
              
              <div className="qr-wrapper" style={{ margin: 0, padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #f1f5f9', borderRadius: '16px', backgroundColor: 'white' }}>
                <QRCode
                  id="session-qr-code"
                  value={qrMode === 'check-in' ? activeSession.checkInUrl : activeSession.checkOutUrl}
                  size={260}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox={`0 0 260 260`}
                  level="H"
                  fgColor={qrMode === 'check-in' ? "#0f172a" : "#c2410c"}
                />
              </div>
            </div>

            <button 
              onClick={handleDownloadQR} 
              className="btn-secondary" 
              style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc' }}
            >
              <Download size={18} />
              QR 코드 이미지 저장 (.png)
            </button>

            <div className="link-info">
              <p>접속 링크 (테스트용):</p>
              <a href={qrMode === 'check-in' ? activeSession.checkInUrl : activeSession.checkOutUrl} target="_blank" rel="noreferrer">
                {qrMode === 'check-in' ? activeSession.checkInUrl : activeSession.checkOutUrl}
              </a>
            </div>
            
            <div className="dashboard-preview">
              <h3>실시간 출석 현황 ({attendees.length}명)</h3>
              {attendees.length === 0 ? (
                <p className="empty-text">현재 대기 중입니다...</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', textAlign: 'left' }}>
                  {attendees.map((row, index) => {
                    // row = [Session Name, Session ID, Employee ID, Employee Name, Check-in Time, Check-out Time, User Agent]
                    const eId = row[2];
                    const eName = row[3];
                    const checkInRaw = row[4];
                    const checkOutRaw = row[5];
                    
                    const formatTime = (rawTime) => {
                      if (!rawTime) return null;
                      try {
                        const dateObj = new Date(rawTime);
                        if (isNaN(dateObj.getTime())) return null;
                        return dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      } catch(e) {
                        return null;
                      }
                    };

                    const checkInTimeStr = formatTime(checkInRaw);
                    const checkOutTimeStr = formatTime(checkOutRaw);
                    
                    return (
                      <li key={index} style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: '1' }}>
                          <strong style={{ display: 'block', color: 'var(--primary-color)', fontSize: '1.1rem', marginBottom: '4px' }}>{eName}</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>사번: {eId}</span>
                        </div>
                        
                        <div style={{ flex: '2', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span className="status-badge checkin">출석</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '6px', minWidth: '80px', textAlign: 'center' }}>
                              {checkInTimeStr || '-'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span className="status-badge checkout">퇴실</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '6px', minWidth: '80px', textAlign: 'center' }}>
                              {checkOutTimeStr || '-'}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            
            <button onClick={handleReset} className="btn-secondary" disabled={isProcessing}>
              <ArrowLeft size={18} />
              {isProcessing ? '세션 종료 중...' : '세션 종료 및 새 교육 만들기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
