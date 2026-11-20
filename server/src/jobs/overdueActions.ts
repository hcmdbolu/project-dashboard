import cron from 'node-cron';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export async function syncOverdueLeadershipActions(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('leadership_actions')
    .update({ status: 'Overdue' })
    .in('status', ['Pending Decision', 'In Review'])
    .lt('due_date', today)
    .select('id');

  if (error) {
    throw new Error(`Failed syncing overdue leadership actions: ${error.message}`);
  }

  return data?.length ?? 0;
}

export function startOverdueActionsCron(): void {
  if (process.env.ENABLE_OVERDUE_CRON !== 'true') {
    return;
  }

  // Runs daily at 01:00 WAT (Africa/Lagos)
  cron.schedule(
    '0 1 * * *',
    async () => {
      try {
        const updatedCount = await syncOverdueLeadershipActions();
        console.log(`[cron] Overdue leadership actions synced: ${updatedCount} updated.`);
      } catch (err) {
        console.error('[cron] Error syncing overdue leadership actions:', err);
      }
    },
    { timezone: 'Africa/Lagos' }
  );
}

