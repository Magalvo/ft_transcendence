import nodemailer from "nodemailer";
export async function sendMail(to, subject, html) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error("❌ Missing SMTP environment variables");
        throw new Error("SMTP environment variables not set");
    }
    console.log("📨 Preparing to send mail...");
    console.log({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        to,
    });
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: Number(process.env.SMTP_PORT) === 465, // true only for SSL
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: { rejectUnauthorized: false },
        });
        const info = await transporter.sendMail({
            from: `"FT Transcendence" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        console.log("✅ Email sent successfully:", info.messageId);
    }
    catch (err) {
        console.error("❌ Error sending reset email:", err);
        throw err;
    }
}
