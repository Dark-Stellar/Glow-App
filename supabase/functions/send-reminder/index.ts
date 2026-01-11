import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderEmailRequest {
  email: string;
  type: 'morning' | 'evening' | 'test';
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send-reminder function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type }: ReminderEmailRequest = await req.json();
    
    console.log(`Processing ${type} reminder for email: ${email}`);

    if (!email) {
      console.error("No email provided");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let subject: string;
    let message: string;
    
    switch (type) {
      case 'morning':
        subject = 'Plan Your Day - Glow Reminder';
        message = 'Good morning! Time to plan your day. Set your tasks and weights for today.';
        break;
      case 'evening':
        subject = 'Log Your Progress - Glow Reminder';
        message = 'Good evening! Time to log your progress. Update your task completion for today.';
        break;
      case 'test':
        subject = 'Test Notification - Glow';
        message = 'This is a test notification from Glow. Your email notifications are working correctly!';
        break;
      default:
        subject = 'Glow Reminder';
        message = 'You have a reminder from Glow.';
    }

    console.log(`Sending email to ${email} with subject: ${subject}`);

    const emailResponse = await resend.emails.send({
      from: "Glow <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B5CF6; margin: 0; font-size: 32px;">Glow</h1>
            <p style="font-size: 14px; color: #6B7280; margin: 5px 0 0 0;">Measure. Grow. Glow.</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%); padding: 40px; border-radius: 16px; margin: 20px 0;">
            <h2 style="color: white; margin: 0 0 15px 0; font-size: 24px;">${subject}</h2>
            <p style="color: white; margin: 0; font-size: 16px; line-height: 1.6;">${message}</p>
          </div>
          
          ${type !== 'test' ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://eabsrzsexzphpsdbyiyq.lovable.app" 
               style="background-color: #8B5CF6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
              Open Glow
            </a>
          </div>
          ` : `
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #F3F4F6; border-radius: 8px;">
            <p style="color: #22C55E; font-weight: 600; margin: 0;">✓ Email notifications are working!</p>
            <p style="color: #6B7280; font-size: 14px; margin: 10px 0 0 0;">You will receive morning and evening reminders at your scheduled times.</p>
          </div>
          `}
          
          <div style="border-top: 1px solid #E5E7EB; margin-top: 30px; padding-top: 20px;">
            <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin: 0;">
              You're receiving this because you have notifications enabled in Glow.<br/>
              Track your daily productivity at <a href="https://eabsrzsexzphpsdbyiyq.lovable.app" style="color: #8B5CF6;">glow.lovable.app</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending reminder email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);