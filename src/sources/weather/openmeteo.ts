/**
 * Open-Meteo weather alerts — extreme condition scanner
 * Uses the free Open-Meteo forecast API (no key required).
 * Checks 25 globally distributed cities for extreme weather conditions
 * and creates intelligence items only for notable readings.
 *
 * API: https://api.open-meteo.com/v1/forecast
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'windspeed_10m_max',
].join(',');

interface MonitoredCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const CITIES: MonitoredCity[] = [
  // Extreme heat / cold regions
  { name: 'Baghdad',        country: 'Iraq',         lat: 33.3152,  lon: 44.3661  },
  { name: 'Riyadh',         country: 'Saudi Arabia', lat: 24.7136,  lon: 46.6753  },
  { name: 'Dubai',          country: 'UAE',          lat: 25.2048,  lon: 55.2708  },
  { name: 'Karachi',        country: 'Pakistan',     lat: 24.8607,  lon: 67.0011  },
  { name: 'Jacobabad',      country: 'Pakistan',     lat: 28.2769,  lon: 68.4514  },
  { name: 'Ahvaz',          country: 'Iran',         lat: 31.3183,  lon: 48.6706  },
  { name: 'Yakutsk',        country: 'Russia',       lat: 62.0355,  lon: 129.6755 },
  { name: 'Oymyakon',       country: 'Russia',       lat: 63.4640,  lon: 142.7728 },
  { name: 'Verkhoyansk',    country: 'Russia',       lat: 67.5517,  lon: 133.3882 },
  { name: 'Ulaanbaatar',    country: 'Mongolia',     lat: 47.8864,  lon: 106.9057 },
  // Cyclone / typhoon prone
  { name: 'Manila',         country: 'Philippines',  lat: 14.5995,  lon: 120.9842 },
  { name: 'Dhaka',          country: 'Bangladesh',   lat: 23.8103,  lon: 90.4125  },
  { name: 'Mumbai',         country: 'India',        lat: 19.0760,  lon: 72.8777  },
  { name: 'Shanghai',       country: 'China',        lat: 31.2304,  lon: 121.4737 },
  { name: 'Tokyo',          country: 'Japan',        lat: 35.6762,  lon: 139.6503 },
  // Flood / precipitation extremes
  { name: 'Lagos',          country: 'Nigeria',      lat: 6.5244,   lon: 3.3792   },
  { name: 'Kinshasa',       country: 'DRC',          lat: -4.3217,  lon: 15.3222  },
  { name: 'Jakarta',        country: 'Indonesia',    lat: -6.2088,  lon: 106.8456 },
  { name: 'Colombo',        country: 'Sri Lanka',    lat: 6.9271,   lon: 79.8612  },
  // Storm / wind corridors
  { name: 'Wellington',     country: 'New Zealand',  lat: -41.2865, lon: 174.7762 },
  { name: 'Reykjavik',      country: 'Iceland',      lat: 64.1265,  lon: -21.8174 },
  { name: 'Buenos Aires',   country: 'Argentina',    lat: -34.6037, lon: -58.3816 },
  { name: 'Novosibirsk',    country: 'Russia',       lat: 54.9884,  lon: 82.9357  },
  { name: 'Nairobi',        country: 'Kenya',        lat: -1.2921,  lon: 36.8219  },
  { name: 'Sydney',         country: 'Australia',    lat: -33.8688, lon: 151.2093 },
];

interface OpenMeteoResponse {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    windspeed_10m_max: (number | null)[];
  };
}

interface ExtremeReading {
  type: 'heat' | 'cold' | 'wind' | 'precipitation';
  value: number;
  date: string;
  severity: Severity;
}

function evaluateDayExtremes(
  tempMax: number | null,
  tempMin: number | null,
  precipitation: number | null,
  wind: number | null,
): ExtremeReading[] {
  const extremes: ExtremeReading[] = [];

  // Currently no date context here — handled by caller; placeholder 'today' used
  const date = new Date().toISOString().split('T')[0];

  if (tempMax !== null && tempMax > 45) {
    extremes.push({ type: 'heat', value: tempMax, date, severity: 'high' });
  } else if (tempMax !== null && tempMax > 42) {
    extremes.push({ type: 'heat', value: tempMax, date, severity: 'medium' });
  }

  if (tempMin !== null && tempMin < -40) {
    extremes.push({ type: 'cold', value: tempMin, date, severity: 'high' });
  } else if (tempMin !== null && tempMin < -30) {
    extremes.push({ type: 'cold', value: tempMin, date, severity: 'medium' });
  }

  if (wind !== null && wind > 100) {
    extremes.push({ type: 'wind', value: wind, date, severity: 'high' });
  } else if (wind !== null && wind > 75) {
    extremes.push({ type: 'wind', value: wind, date, severity: 'medium' });
  }

  if (precipitation !== null && precipitation > 200) {
    extremes.push({ type: 'precipitation', value: precipitation, date, severity: 'high' });
  } else if (precipitation !== null && precipitation > 100) {
    extremes.push({ type: 'precipitation', value: precipitation, date, severity: 'medium' });
  }

  return extremes;
}

function buildTitle(city: MonitoredCity, reading: ExtremeReading): string {
  switch (reading.type) {
    case 'heat':
      return `Extreme heat in ${city.name}, ${city.country}: ${reading.value.toFixed(1)}°C`;
    case 'cold':
      return `Extreme cold in ${city.name}, ${city.country}: ${reading.value.toFixed(1)}°C`;
    case 'wind':
      return `High winds in ${city.name}, ${city.country}: ${reading.value.toFixed(0)} km/h`;
    case 'precipitation':
      return `Heavy precipitation in ${city.name}, ${city.country}: ${reading.value.toFixed(0)} mm`;
  }
}

function buildDescription(city: MonitoredCity, reading: ExtremeReading): string {
  switch (reading.type) {
    case 'heat':
      return (
        `Maximum temperature of ${reading.value.toFixed(1)}°C forecast in ${city.name}, ${city.country}. ` +
        `Dangerous heat conditions; risk of heat exhaustion and infrastructure stress.`
      );
    case 'cold':
      return (
        `Minimum temperature of ${reading.value.toFixed(1)}°C forecast in ${city.name}, ${city.country}. ` +
        `Extreme cold; risk of hypothermia and infrastructure disruption.`
      );
    case 'wind':
      return (
        `Maximum wind speed of ${reading.value.toFixed(0)} km/h forecast in ${city.name}, ${city.country}. ` +
        `Severe wind conditions; possible structural damage and transport disruption.`
      );
    case 'precipitation':
      return (
        `${reading.value.toFixed(0)} mm of precipitation forecast in ${city.name}, ${city.country}. ` +
        `Extreme rainfall; flood risk and potential infrastructure disruption.`
      );
  }
}

const source: DataSource = {
  id: 'open-meteo-weather',
  name: 'Open-Meteo Extreme Weather Scanner',
  category: 'weather',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const items: IntelligenceItem[] = [];

    await Promise.allSettled(
      CITIES.map(async (city) => {
        try {
          const url =
            `${BASE_URL}?latitude=${city.lat}&longitude=${city.lon}` +
            `&daily=${DAILY_VARS}&timezone=auto&forecast_days=3`;

          const res = await fetch(url, {
            signal: AbortSignal.timeout(10_000),
            headers: { 'Accept': 'application/json' },
          });

          if (!res.ok) {
            console.warn(`[open-meteo] ${city.name}: HTTP ${res.status}`);
            return;
          }

          const data = (await res.json()) as OpenMeteoResponse;
          const daily = data.daily;
          if (!daily) return;

          const days = daily.time.length;
          for (let i = 0; i < days; i++) {
            const extremes = evaluateDayExtremes(
              daily.temperature_2m_max[i] ?? null,
              daily.temperature_2m_min[i] ?? null,
              daily.precipitation_sum[i] ?? null,
              daily.windspeed_10m_max[i] ?? null,
            );

            for (const reading of extremes) {
              const dateStr = daily.time[i];
              const uniquePart = `${city.name}-${reading.type}-${dateStr}`;

              items.push({
                id: createId('open-meteo', uniquePart),
                source: 'open-meteo-weather',
                category: 'weather',
                title: buildTitle(city, reading),
                description: buildDescription(city, reading),
                timestamp: new Date(`${dateStr}T00:00:00Z`),
                location: {
                  lat: city.lat,
                  lon: city.lon,
                  name: city.name,
                  country: city.country,
                },
                severity: reading.severity,
                url: `https://open-meteo.com/en/docs#latitude=${city.lat}&longitude=${city.lon}`,
                tags: [
                  'weather',
                  'extreme',
                  reading.type,
                  city.country.toLowerCase().replace(/\s+/g, '-'),
                ],
                raw: { city, reading },
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[open-meteo] ${city.name}: ${msg}`);
        }
      }),
    );

    return items;
  },
};

registry.register(source);
export default source;
