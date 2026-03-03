import { supabase } from '@/integrations/supabase/client';

export async function scheduleNotifications(
  morningTime: string,
  eveningTime: string,
  notificationsEnabled: boolean
) {
  if (!notificationsEnabled) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Use email directly from Supabase Auth (secure source)
  const userEmail = user.email;
  if (!userEmail) return;

  const now = new Date();
  const [morningHour, morningMinute] = morningTime.split(':').map(Number);
  const [eveningHour, eveningMinute] = eveningTime.split(':').map(Number);

  const morningNotification = new Date();
  morningNotification.setHours(morningHour, morningMinute, 0, 0);

  const eveningNotification = new Date();
  eveningNotification.setHours(eveningHour, eveningMinute, 0, 0);

  // Schedule browser notifications
  const scheduleBrowserNotification = (time: Date, message: string, type: 'morning' | 'evening') => {
    const delay = time.getTime() - now.getTime();
    if (delay > 0) {
      setTimeout(async () => {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Glow Reminder', {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          });
        }

        // Send email notification via edge function
        try {
          const { error } = await supabase.functions.invoke('send-reminder', {
            body: { email: userEmail, type },
          });
          if (error) {
            console.error('Failed to send email reminder:', error);
          } else {
            console.log(`Email reminder sent successfully to ${userEmail}`);
          }
        } catch (error) {
          console.error('Failed to send email reminder:', error);
        }
      }, delay);
    }
  };

  if (morningNotification > now) {
    scheduleBrowserNotification(
      morningNotification,
      'Plan your day! Set your tasks and weights.',
      'morning'
    );
  }

  if (eveningNotification > now) {
    scheduleBrowserNotification(
      eveningNotification,
      'Log your progress! Update your task completion.',
      'evening'
    );
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not logged in' };
    }

    // Use email directly from Supabase Auth (secure source)
    const userEmail = user.email;
    if (!userEmail) {
      return { success: false, error: 'No email found for your account' };
    }

    console.log(`Sending test notification to: ${userEmail}`);

    const { data, error } = await supabase.functions.invoke('send-reminder', {
      body: { email: userEmail, type: 'test' },
    });

    if (error) {
      console.error('Test notification error:', error);
      return { success: false, error: error.message };
    }

    console.log('Test notification response:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Test notification error:', error);
    return { success: false, error: error.message };
  }
}