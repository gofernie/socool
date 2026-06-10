const listingId = process.argv[2];

if (!listingId) {
  console.error("Usage: npx tsx src/scripts/debug-repliers-listing.ts MLS_NUMBER");
  process.exit(1);
}

const apiKey = process.env.REPLIERS_API_KEY;

if (!apiKey) {
  console.error("Missing REPLIERS_API_KEY");
  process.exit(1);
}

const res = await fetch(`https://api.repliers.io/listings/${listingId}`, {
  headers: {
    "REPLIERS-API-KEY": apiKey,
    "Content-Type": "application/json",
  },
});

const json = await res.json();

console.log(JSON.stringify(json, null, 2));