/**
 * Backfill lat/lng for SellerLocations missing coordinates.
 * Uses the Mapbox Geocoding API (same token as the app).
 *
 * Run with: npx tsx scripts/geocode-seller-locations.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function main() {
  if (!MAPBOX_TOKEN) {
    console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set in .env");
    process.exit(1);
  }

  const locations = await prisma.sellerLocation.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: {
      id: true,
      locationName: true,
      streetAddress: true,
      city: true,
      state: true,
      zip: true,
      affiliateId: true,
    },
  });

  console.log(`Found ${locations.length} location(s) missing lat/lng.\n`);

  let updated = 0;
  let failed = 0;

  for (const loc of locations) {
    const parts = [loc.streetAddress, loc.city, loc.state, loc.zip].filter(Boolean);
    if (parts.length === 0) {
      console.log(`  SKIP: ${loc.locationName || loc.id} — no address fields`);
      failed++;
      continue;
    }

    const address = parts.join(", ");
    const result = await geocodeAddress(address);

    if (result) {
      await prisma.sellerLocation.update({
        where: { id: loc.id },
        data: { latitude: result.lat, longitude: result.lng },
      });
      console.log(`  OK: ${loc.locationName || loc.id} → ${result.lat}, ${result.lng}`);
      updated++;
    } else {
      console.log(`  FAIL: ${loc.locationName || loc.id} — could not geocode "${address}"`);
      failed++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed/Skipped: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
