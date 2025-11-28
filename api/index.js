import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.silodbconnection_SUPABASE_URL,
  process.env.silodbconnection_SUPABASE_SERVICE_ROLE_KEY
);

const apiKeyMiddleware = (req) => {
  const apiKey = req.headers['x-api-key'];
  return apiKey && apiKey === "demo123";
};

export default async function handler(req, res) {
  const { method } = req;

  try {
    if (!apiKeyMiddleware(req) && method === "POST") {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (method === "POST") {
      const { deviceId, temperature, humidity, mq_value, spoilageRisk, grainHealth, rssi } = req.body;
      if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

      const { data, error } = await supabase.from('sensor_data').insert([{
        deviceId, temperature, humidity, mq_value, spoilageRisk, grainHealth, rssi
      }]);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true, id: data[0].id });
    }

    if (method === "GET") {
      const { url } = req.query;

      if (url === "latest") {
        // Latest reading per device
        const { data, error } = await supabase.rpc('get_latest_readings');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
      }

      if (url === "devices") {
        const { data, error } = await supabase
          .from('sensor_data')
          .select('deviceId, MAX(timestamp) as lastSeen')
          .group('deviceId')
          .order('lastSeen', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
      }

      if (url === "stats") {
        const total = await supabase.from('sensor_data').select('*', { count: 'exact' });
        const latest = await supabase.from('sensor_data').select('timestamp').order('timestamp', { ascending: false }).limit(1);
        return res.status(200).json({ total: total.count, latest: latest.data[0]?.timestamp });
      }

      // Default: return last 50 entries
      const { data, error } = await supabase.from('sensor_data').select('*').order('timestamp', { ascending: false }).limit(50);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${method} Not Allowed`);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
