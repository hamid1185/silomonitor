import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Middleware
app.use(cors())
app.use(bodyParser.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, '..', 'public')))

// Supabase client using service role key for server-side access
const supabase = createClient(
  process.env.silodbconnection_SUPABASE_URL,
  process.env.silodbconnection_SUPABASE_SERVICE_ROLE_KEY
)

// API key middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  const validApiKey = process.env.API_KEY || 'demo123'
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}

// POST /api/data → receive sensor data
app.post('/api/data', apiKeyMiddleware, async (req, res) => {
  try {
    const {
      deviceId, nodeRole, grainType, temperature, humidity,
      mq_value, mq_ratio, mq_baseline, spoilageRisk, grainHealth,
      safeStorageDays, rssi, ip, freeHeap, status
    } = req.body

    const { data, error } = await supabase
      .from('sensor_data')
      .insert([{
        deviceId,
        nodeRole,
        grainType: grainType || 'wheat',
        temperature,
        humidity,
        mq_value,
        mq_ratio,
        mq_baseline,
        spoilageRisk,
        grainHealth,
        safeStorageDays,
        rssi,
        ip,
        freeHeap,
        status
      }])
      .select()

    if (error) throw error
    res.json({ success: true, id: data[0].id })
  } catch (err) {
    console.error('❌ Supabase insert error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/latest → latest reading per device
app.get('/api/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) throw error

    // Keep only latest per device
    const latest = Object.values(data.reduce((acc, row) => {
      if (!acc[row.deviceId]) acc[row.deviceId] = row
      return acc
    }, {}))

    res.json(latest)
  } catch (err) {
    console.error('❌ Supabase latest error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/devices → device list with status
app.get('/api/devices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) throw error

    const devices = Object.values(data.reduce((acc, row) => {
      if (!acc[row.deviceId]) acc[row.deviceId] = row
      return acc
    }, {}))

    const devicesWithStatus = devices.map(row => {
      const lastSeen = new Date(row.timestamp)
      const now = new Date()
      const diffMinutes = (now - lastSeen) / 60000
      let status = 'offline'
      if (diffMinutes <= 5) status = 'online'
      else if (diffMinutes <= 60) status = 'recent'
      return { ...row, lastSeen, status }
    })

    res.json(devicesWithStatus)
  } catch (err) {
    console.error('❌ Supabase devices error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/history → device history
app.get('/api/history', async (req, res) => {
  try {
    const { deviceId, limit = 100 } = req.query
    let query = supabase.from('sensor_data').select('*').order('timestamp', { ascending: false }).limit(parseInt(limit))
    if (deviceId && deviceId !== 'all') query = query.eq('deviceId', deviceId)

    const { data, error } = await query
    if (error) throw error
    res.json(data.reverse())
  } catch (err) {
    console.error('❌ Supabase history error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats → basic stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalReadings = await supabase.from('sensor_data').select('*', { count: 'exact' })
    const activeDevices = await supabase.from('sensor_data')
      .select('deviceId', { count: 'exact' })
      .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    const latestReading = await supabase.from('sensor_data').select('timestamp').order('timestamp', { ascending: false }).limit(1)

    res.json({
      totalReadings: totalReadings.count,
      activeDevices: activeDevices.count,
      latestReading: latestReading.data[0]?.timestamp || null
    })
  } catch (err) {
    console.error('❌ Supabase stats error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /health → health check
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('sensor_data').select('id').limit(1)
    if (error) throw error
    res.json({ status: 'healthy', timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message })
  }
})

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

// Export for Vercel serverless
export default app
