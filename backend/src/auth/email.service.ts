import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createTransport } from "nodemailer";

function positiveIntegerEnv(name: string, value: string | undefined, fallback: number) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ServiceUnavailableException({
      message: `La configuración ${name} debe ser un entero positivo.`,
      errors: ["EMAIL_CONFIGURATION_INVALID"],
    });
  }
  return parsed;
}

@Injectable()
export class EmailService {
  private configuration() {
    const host = process.env["SMTP_HOST"]?.trim();
    const portValue = process.env["SMTP_PORT"]?.trim();
    const from = process.env["SMTP_FROM"]?.trim();
    const username = process.env["SMTP_USER"]?.trim();
    const password = process.env["SMTP_PASSWORD"];
    const secureValue = process.env["SMTP_SECURE"]?.trim().toLowerCase() ?? "false";
    const frontendUrl = process.env["FRONTEND_URL"]?.trim();
    const port = Number(portValue);
    if (!host || !portValue || !from || !/^\d+$/.test(portValue) ||
        !Number.isSafeInteger(port) || port < 1 || port > 65535 ||
        !["true", "false"].includes(secureValue) ||
        Boolean(username) !== Boolean(password) || !frontendUrl) {
      throw new ServiceUnavailableException({
        message: "El correo no está configurado. Define FRONTEND_URL y los parámetros SMTP en el entorno.",
        errors: ["EMAIL_NOT_CONFIGURED"],
      });
    }
    let parsedFrontendUrl: URL;
    try {
      parsedFrontendUrl = new URL(frontendUrl);
    } catch {
      throw new ServiceUnavailableException({
        message: "FRONTEND_URL debe ser una URL absoluta válida.",
        errors: ["EMAIL_CONFIGURATION_INVALID"],
      });
    }
    if (
      !["http:", "https:"].includes(parsedFrontendUrl.protocol) ||
      parsedFrontendUrl.username ||
      parsedFrontendUrl.password ||
      parsedFrontendUrl.search ||
      parsedFrontendUrl.hash ||
      (process.env["NODE_ENV"] === "production" && parsedFrontendUrl.protocol !== "https:")
    ) {
      throw new ServiceUnavailableException({
        message: "FRONTEND_URL debe usar HTTP(S) y HTTPS en producción.",
        errors: ["EMAIL_CONFIGURATION_INVALID"],
      });
    }
    return {
      host,
      port,
      secure: secureValue === "true",
      from,
      ...(username && password ? { auth: { user: username, pass: password } } : {}),
      frontendUrl: frontendUrl.replace(/\/+$/, ""),
      connectionTimeout: positiveIntegerEnv(
        "SMTP_CONNECTION_TIMEOUT_MS",
        process.env["SMTP_CONNECTION_TIMEOUT_MS"],
        10000,
      ),
      greetingTimeout: positiveIntegerEnv(
        "SMTP_GREETING_TIMEOUT_MS",
        process.env["SMTP_GREETING_TIMEOUT_MS"],
        10000,
      ),
      socketTimeout: positiveIntegerEnv("SMTP_SOCKET_TIMEOUT_MS", process.env["SMTP_SOCKET_TIMEOUT_MS"], 30000),
    };
  }

  assertConfigured() {
    this.configuration();
  }

  async sendPasswordSetup(email: string, name: string, token: string, expiresInSeconds: number) {
    const config = this.configuration();
    const link = new URL(
      `reset-password?token=${encodeURIComponent(token)}`,
      `${config.frontendUrl}/`,
    ).toString();
    const expiresInMinutes = Math.ceil(expiresInSeconds / 60);
    const transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
      ...(config.auth ? { auth: config.auth } : {}),
    });
    await transport.sendMail({
      from: config.from,
      to: email,
      subject: "Configura o restablece tu contraseña de ParametrIA",
      text: [
        `Hola ${name},`,
        "",
        "Recibimos una solicitud para configurar o restablecer la contraseña de tu cuenta de ParametrIA.",
        `Usa este enlace seguro antes de que venza (en ${expiresInMinutes} minutos):`,
        link,
        "",
        "Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá sin cambios.",
        "",
        "Equipo ParametrIA",
      ].join("\n"),
      html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Configura tu contraseña de ParametrIA</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f7;font-family:Arial,Helvetica,sans-serif;color:#172b3b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Configura tu acceso seguro a ParametrIA. Este enlace vence en ${expiresInMinutes} minutos.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f7;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 0 18px;text-align:center;">
                <span style="font-size:23px;font-weight:700;letter-spacing:-.5px;color:#15566d;">Parametr<span style="color:#08768b;">IA</span></span>
              </td>
            </tr>
            <tr>
              <td style="overflow:hidden;border:1px solid #e1e9ee;border-radius:16px;background-color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:6px;background-color:#08768b;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:36px 40px 16px;">
                      <p style="margin:0 0 10px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#08768b;">Acceso a tu cuenta</p>
                      <h1 style="margin:0;font-size:25px;line-height:1.3;color:#172b3b;">Configura tu contraseña</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 40px 8px;">
                      <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#344b5a;">Hola ${escapeHtml(name)},</p>
                      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#526777;">Recibimos una solicitud para configurar o restablecer la contraseña de tu cuenta. Usa el botón de abajo para continuar de forma segura.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:4px 40px 24px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:10px;background-color:#08768b;">
                            <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 26px;border:1px solid #08768b;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;">Configurar contraseña</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 40px 28px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dcebed;border-radius:10px;background-color:#f4fafb;">
                        <tr>
                          <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#526777;">
                            <strong style="color:#15566d;">Enlace de un solo uso.</strong> Por seguridad, vence en ${expiresInMinutes} minutos.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 40px 30px;">
                      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#607482;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                      <p style="margin:0;overflow-wrap:anywhere;font-size:12px;line-height:1.6;"><a href="${escapeHtml(link)}" style="color:#08768b;text-decoration:underline;">${escapeHtml(link)}</a></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #e8eef1;background-color:#fbfcfd;">
                      <p style="margin:0;font-size:13px;line-height:1.65;color:#607482;">Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá sin cambios.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 12px 0;text-align:center;">
                <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#526777;">Equipo ParametrIA</p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:#81919a;">Este mensaje fue enviado automáticamente. Por favor, no respondas a este correo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
