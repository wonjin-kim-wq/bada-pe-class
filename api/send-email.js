const nodemailer = require("nodemailer");

module.exports = async function handler(req, res) {
  // 1. CORS 기본 설정 및 프리플라이트 대응
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Only POST requests are allowed" });
  }

  try {
    const { email, xlsxBase64, filename, title, studentCount } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "이메일 수신 주소가 누락되었습니다." });
    }

    if (!xlsxBase64) {
      return res.status(400).json({ success: false, error: "첨부할 엑셀 파일 데이터가 누락되었습니다." });
    }

    // 2. Vercel 환경 변수값 수집
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "465");

    // 만약 환경 변수 암호가 설정되지 않았다면 에러 디버깅 정보 제공
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        success: false,
        error: "Vercel 서버의 환경 변수(SMTP_USER, SMTP_PASS) 설정이 정상적으로 완수되지 않았거나 아직 동기화되지 않았습니다. 대시보드를 확인하세요."
      });
    }

    // 3. Gmail 및 타 메일용 SMTP 전송 전용 수송 통로 가설
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // 465 포트는 true가 보안 권장사항
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 8000, // 연결 대기 제한 시간 8초 지정
      greetingTimeout: 8000,   // 그리팅 제한 시간 8초 지정
      socketTimeout: 15000,    // 전반 소켓 타입아웃 15초 지정
    });

    // 4. 발송 대상 메일 기본 속성 구성
    const mailOptions = {
      from: `"PAPS 셔틀런 기록장" <${smtpUser}>`,
      to: email,
      subject: title || "[PAPS 셔틀런] 왕복오래달리기 최종 측정 결과 데이터",
      html: `
        <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #1d4ed8, #3b82f6); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">🏃 PAPS 왕복오래달리기 결과지</h2>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            안녕하세요, 선생님! 이메일 발송 요청을 통해 성적이 자동 정리된 <strong>PAPS 셔틀런 분석 엑셀 보고서</strong>를 첨부 파일로 발송해 드립니다.
          </p>
          <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #edf1f7;">
            <table style="width: 100%; font-size: 14px; text-align: left; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 100px;">측정 대상</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">총 ${studentCount || 0}명의 학생 기록</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">측정 일시</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${new Date().toLocaleString("ko-KR")} (KST 기준)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">파일 안내</td>
                <td style="padding: 6px 0; color: #2563eb; font-weight: bold;">${filename || "PAPS_result.xlsx"}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 25px;">
            본 메일에 동봉된 엑셀 문서를 열어 체육 수행평가 및 학생 나이스(NEIS) 기초 체력 결과를 한눈에 확인하여 처리하실 수 있습니다.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; margin: 0;">
            본 전자우편은 바다쌤의 체육수업 Smart Hub 전용 간편 전송 게이트웨이를 통해 정식 발송되었습니다.<br/>
            수신처 및 환경설정 관련 기술 문의는 바다쌤 서비스 관리자 메일을 가동해 주시기 바랍니다.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: filename || "PAPS_result.xlsx",
          content: xlsxBase64,
          encoding: "base64",
        },
      ],
    };

    // 5. 비동기 전송 실행
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: "이메일이 안전하게 배송 완수되었습니다!" });

  } catch (err) {
    console.error("Internal Server SMTP Error:", err);
    return res.status(500).json({
      success: false,
      error: "SMTP(이메일 전용서버) 내부 통신에 실패했습니다.",
      detail: err.message || String(err),
    });
  }
};
