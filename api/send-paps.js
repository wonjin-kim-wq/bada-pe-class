/**
 * Vercel Serverless Function: /api/send-paps
 * 
 * 프론트엔드로부터 교사 이메일과 전체 학생 PAPS 결과를 받아
 * 메모리 상에서 엑셀 파일(Buffer)을 생성한 후,
 * Resend 이메일 API 서비스를 통해 첨부파일로 발송합니다.
 */

const { Resend } = require('resend');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // preflight OPTIONS 요청 즉시 승인
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 처리 가능합니다.' });
  }

  try {
    const { teacherEmail, studentsData } = req.body;

    if (!teacherEmail || !studentsData || !Array.isArray(studentsData)) {
      return res.status(400).json({ error: '필수 데이터(teacherEmail, studentsData)가 없습니다.' });
    }

    // 1. xlsx를 사용해 메모리에서 엑셀 파일 버퍼(Buffer) 생성
    // 엑셀로 내보낼 로우 데이터 포맷 빌딩
    const worksheetData = studentsData.map(student => {
      const isActive = student.count === null; // 기록이 null이면 진행중
      return {
        '순번': `${student.id}번`,
        '학생 번호': student.id,
        '왕복오래달리기 기록 (회)': isActive ? '측정안됨 (진행중)' : `${student.count}회`,
        '탈락 상태': student.dropped ? '탈락' : '진행중'
      };
    });

    // 엑셀 시트 및 워크북 객체 빌드
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "셔틀런 측정결과");

    // 메모리 내 Buffer 데이터로 출력
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 2. Resend API 키 조회 및 무결성 검증
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '버셀 환경 변수에 RESEND_API_KEY가 미등록되어 있습니다.' });
    }

    // Resend 클라이언트 초기화 및 이메일 발송
    const resend = new Resend(apiKey);
    
    // 이메일 발송 처리
    const sendResult = await resend.emails.send({
      from: 'PAPS System <onboarding@resend.dev>', // 등록된 개별 도메인이 없을 때는 onboarding 도메인 이용 가능
      to: teacherEmail,
      subject: `[PAPS 측정보고서] 왕복오래달리기 기록 결과 서류`,
      html: `
        <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; background-color: #fafbfd;">
          <h2 style="color: #2563eb; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 12px;">PAPS 왕복오래달리기(셔틀런) 기록 보고서</h2>
          <p style="font-size: 15px; margin-bottom: 20px;">
            체육 선생님, 안녕하세요! 체육수업 스마트 허브 PAPS 기록 시스템입니다.<br/>
            수업 시간에 측정된 학생들의 왕복오래달리기 결과 데이터를 담은 엑셀 파일이 준비되었습니다.
          </p>
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #475569;">[기록 요약 리포트]</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 13.5px; color: #64748b;">
              <li><strong>참가 학생 총수:</strong> ${studentsData.length}명</li>
              <li><strong>체력 검사 종류:</strong> 왕복오래달리기 (Shuttle Run)</li>
              <li><strong>발송 일시:</strong> ${new Date().toLocaleString('ko-KR')}</li>
            </ul>
          </div>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            ※ 본 메일에 첨부된 엑셀 보고서파일을 다운로드 받아 교사 컴퓨터에 성적표로 보관해 주십시오.<br/>
            체육수업 스마트 허브 시스템 © 2026.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `PAPS_ShuttleRun_Result_${new Date().toISOString().slice(0, 10)}.xlsx`,
          content: excelBuffer,
        }
      ]
    });

    return res.status(200).json({ success: true, message: '이메일이 등록된 교사 주소로 완벽하게 발송되었습니다!', sendResult });

  } catch (error) {
    console.error('PAPS 메일링 백엔드 오류:', error);
    return res.status(500).json({ error: `서버 내부 에러로 발송 실패했습니다: ${error.message}` });
  }
};
