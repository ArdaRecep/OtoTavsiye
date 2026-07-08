require('dotenv').config({ path: '.env' });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.PROJECT_ID ? `https://${process.env.PROJECT_ID}.supabase.co` : process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SERVICE_ROLE_SECRET || process.env.SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('notifications').select('*');
  console.log("Notifications in DB:", data);
  console.log("Error:", error);
}

check();
