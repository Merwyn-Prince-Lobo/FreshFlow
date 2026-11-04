import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

// Example RBAC-protected handler: stock list, Admin + Staff, with search.
export async function GET(req) {
  const { error } = await requireRole(['Admin', 'Staff']);
  if (error) return error;

  const q = new URL(req.url).searchParams.get('q')?.trim();
  const like = q ? `%${q}%` : '%';
  const rows = await query(
    `SELECT Inventory_ID, Product_Name, Location_Name, Batch_Number,
            Quantity_On_Hand, Expiry_Date, Days_To_Expiry
       FROM v_stock_by_location
      WHERE Product_Name LIKE ? OR Batch_Number LIKE ?
      ORDER BY Days_To_Expiry ASC
      LIMIT 200`,
    [like, like]
  );
  return Response.json(rows);
}
