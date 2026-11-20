import { NextRequest, NextResponse } from 'next/server';

// GET — test email endpoint
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ success: true, message: 'Email service OK' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST — send email
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, message } = body;

    if (!to || !subject || !message) {
      return NextResponse.json({ success: false, error: 'to, subject, message wajib' }, { status: 400 });
    }

    // TODO: Integrasi dengan email service (SendGrid, Nodemailer, dll)
    console.log(`📧 Email: to=${to}, subject=${subject}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent (mock)' 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}