const express = require('express');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// ========== CONFIGURATION ==========
const SUPABASE_URL = 'https://pcvfwioshtxuctjcgkrr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmZ3aW9zaHR4dWN0amNna3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDE5NTgsImV4cCI6MjA5NDYxNzk1OH0.5OydO9ELHHwVWMp4gbSDSIXx-wAE4pB8F8H0ivDVXB4';

const VAPID_PUBLIC_KEY = 'BH4O1gp4MkNjuT-SnMa3rQ3n8kp67QHYvhpY0i94tSV-digb0FOptai4JGbvb4BiCvfTTDci0igHq0oFhBap_IA';
const VAPID_PRIVATE_KEY = 'FANF1ONABZfLHjruDm03zW1ichQJNJajwqyiuwCFHq0';

webpush.setVapidDetails(
    'mailto:post@infobaaten.no',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to determine arrow
function getArrow(changeCm) {
    if (!changeCm) return '●';
    if (changeCm.includes('+')) return '▲';
    if (changeCm.includes('-')) return '▼';
    return '●';
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'InfoBåten notification server running' });
});

// Send notification endpoint
app.post('/send', async (req, res) => {
    try {
        let { waterLevel, changeCm } = req.body;
        
        // Remove leading apostrophe from changeCm if present
        if (changeCm) {
            changeCm = changeCm.replace(/^'/, '');
        }
        
        let arrow = '●';
        if (changeCm && changeCm.includes('+')) arrow = '▲';
        else if (changeCm && changeCm.includes('-')) arrow = '▼';
        
        const payload = JSON.stringify({
            title: '🚤 InfoBåten',
            body: `📊 ${waterLevel} moh ${arrow} ${changeCm || '0 cm'}`,
            icon: '/app/icons/icon-192.png',
            badge: '/app/icons/icon-32.png'
        });
 
        
        // Get all subscriptions
        const { data: subscriptions, error } = await supabase
            .from('subscriptions')
            .select('*');
        
        if (error) throw error;
        
        if (!subscriptions || subscriptions.length === 0) {
            return res.json({ success: true, message: 'No subscribers', sent: 0 });
        }
        
        let sent = 0;
        let failed = 0;
        
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: sub.keys
                }, payload);
                sent++;
            } catch (err) {
                failed++;
                if (err.statusCode === 410) {
                    await supabase.from('subscriptions').delete().eq('id', sub.id);
                }
            }
        }
        
        res.json({ success: true, sent, failed, total: subscriptions.length });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Teaser endpoint (for testing)
app.post('/teaser', async (req, res) => {
    try {
        const payload = JSON.stringify({
            title: '🚤 InfoBåten',
            body: '📊 436.2 moh ▲ +12.4 cm',
            icon: 'https://vorenus70.github.io/infobaaten_development/app/icons/icon-192.png',
            badge: 'https://vorenus70.github.io/infobaaten_development/app/icons/icon-32.png'
        });
        
        const { data: subscriptions } = await supabase.from('subscriptions').select('*');
        
        for (const sub of subscriptions || []) {
            try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
            } catch (err) {
                if (err.statusCode === 410) {
                    await supabase.from('subscriptions').delete().eq('id', sub.id);
                }
            }
        }
        
        res.json({ success: true, sent: subscriptions?.length || 0 });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
