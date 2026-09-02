import { createClient } from "@supabase/supabase-js";
import { INITIAL_DELIVERY_AREAS } from "../src/deliveryData";

const dbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://dlinknypnlmcrhgbediu.supabase.co";
const dbKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_KkOjGDoE3yq7tKIKzIfajg_sIoyPlUT";

const supabase = createClient(dbUrl, dbKey);

async function importDeliveryAreas() {
  console.log("Checking existing records in delivery_areas_charges...");
  const { data: existingData, error: selectErr } = await supabase
    .from("delivery_areas_charges")
    .select("*");

  if (selectErr) {
    console.error("Error reading delivery_areas_charges:", selectErr.message);
  } else {
    console.log(`Current record count in delivery_areas_charges: ${existingData?.length || 0}`);
  }

  const existingCodes = new Set((existingData || []).map((r: any) => String(r.id || r.ID || "").trim().toUpperCase()));

  const recordsToInsert = INITIAL_DELIVERY_AREAS.filter((item) => !existingCodes.has(item.id.toUpperCase())).map((item) => ({
    "City": item.city,
    "Area/Neighborhood/Sector": item.area,
    "category": item.category
  }));

  console.log(`Attempting to import ${recordsToInsert.length} delivery area records into Supabase...`);

  let insertedCount = 0;
  for (let i = 0; i < recordsToInsert.length; i += 20) {
    const chunk = recordsToInsert.slice(i, i + 20);
    const { data, error } = await supabase.from("delivery_areas_charges").insert(chunk).select();
    if (error) {
      console.log(`Batch ${Math.floor(i / 20) + 1} insert note: ${error.message}`);
    } else if (data) {
      insertedCount += data.length;
    }
  }

  console.log(`Import task finished. Total new rows inserted into delivery_areas_charges: ${insertedCount}`);
}

importDeliveryAreas().catch(console.error);
