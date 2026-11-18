import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { mongo, audit } from '@/lib/mongo';

function evaluate(temp, location) {
  return Number(temp) >= Number(location.Min_Temp_C) && Number(temp) <= Number(location.Max_Temp_C)
    ? 'Within range'
    : 'Out of range';
}

export async function GET() {
  const { error } = await requireRole(['Admin', 'Staff']);
  if (error) return error;
  try {
    const locations = await query('SELECT Location_ID,Location_Name,Location_Type,Min_Temp_C,Max_Temp_C FROM LOCATION ORDER BY Location_Name');
    const db = await mongo();
    const raw = await db.collection('temperature_readings').find({}).sort({ at: -1 }).limit(150).toArray();
    const byId = new Map(locations.map(l => [Number(l.Location_ID), l]));
    const readings = raw.map(r => {
      const l = byId.get(Number(r.locationId));
      return {
        _id: String(r._id),
        locationId: r.locationId,
        locationName: r.locationName || l?.Location_Name || 'Unknown location',
        temperature: r.temperature,
        at: r.at,
        status: l ? evaluate(r.temperature, l) : 'Not evaluated',
      };
    });
    return Response.json({ locations, readings });
  } catch (e) {
    console.error('Temperature GET', e);
    return Response.json({ error: 'Unable to load temperature records. Check MongoDB connection.' }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, error } = await requireRole(['Admin', 'Staff']);
  if (error) return error;
  try {
    const body = await req.json();
    const locationId = Number(body.locationId);
    const temperature = Number(body.temperature);
    if (!Number.isInteger(locationId) || locationId <= 0 || !Number.isFinite(temperature) || temperature < -80 || temperature > 100) {
      return Response.json({ error: 'Select a valid location and temperature between -80°C and 100°C.' }, { status: 400 });
    }
    const loc = (await query('SELECT Location_ID,Location_Name,Min_Temp_C,Max_Temp_C FROM LOCATION WHERE Location_ID=?', [locationId]))[0];
    if (!loc) return Response.json({ error: 'Location not found.' }, { status: 404 });
    const entry = {
      locationId,
      locationName: loc.Location_Name,
      temperature,
      at: new Date(),
      userId: Number(session.userId),
      status: evaluate(temperature, loc),
    };
    const db = await mongo();
    await db.collection('temperature_readings').insertOne(entry);
    try { await audit(session.userId, 'RECORD_TEMPERATURE', 'location', locationId, null, entry); } catch (auditError) { console.warn("Audit logging skipped:", auditError.message); }
    return Response.json({ success: true, message: entry.status === 'Within range' ? 'Temperature reading saved within configured range.' : 'Temperature saved — this reading is outside the location limits.' });
  } catch (e) {
    console.error('Temperature POST', e);
    return Response.json({ error: 'Unable to save temperature reading. Check MongoDB connection.' }, { status: 500 });
  }
}
