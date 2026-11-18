import { requireRole } from '@/lib/auth';
import { query, pool } from '@/lib/db';

export async function GET() {
  const { error } = await requireRole(['Admin', 'Staff']);
  if (error) return error;

  try {
    const rows = await query(`
      SELECT
        p.Product_ID,
        p.Product_Name,
        p.Unit_Of_Measure,
        l.Location_ID,
        l.Location_Name,
        COALESCE(SUM(
          CASE
            WHEN i.Expiry_Date >= CURDATE()
            THEN i.Quantity_On_Hand
            ELSE 0
          END
        ), 0) AS Available_Quantity
      FROM PRODUCT p
      CROSS JOIN LOCATION l
      LEFT JOIN INVENTORY i
        ON i.Product_ID = p.Product_ID
        AND i.Location_ID = l.Location_ID
      GROUP BY
        p.Product_ID, p.Product_Name, p.Unit_Of_Measure,
        l.Location_ID, l.Location_Name
      HAVING Available_Quantity > 0
      ORDER BY p.Product_Name, l.Location_Name
    `);

    return Response.json(rows);
  } catch (err) {
    console.error('Issue options error:', err);
    return Response.json(
      { error: 'Unable to load available stock.' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { session, error } = await requireRole(['Admin', 'Staff']);
  if (error) return error;

  try {
    const body = await req.json();

    const productId = Number(body.productId);
    const locationId = Number(body.locationId);
    const quantity = Number(body.quantity);

    if (
      !Number.isInteger(productId) || productId <= 0 ||
      !Number.isInteger(locationId) || locationId <= 0 ||
      !Number.isInteger(quantity) || quantity <= 0
    ) {
      return Response.json(
        { error: 'Select a valid product, location and positive whole-number quantity.' },
        { status: 400 }
      );
    }

    // The stored procedure applies FEFO and the database trigger
    // automatically updates Quantity_On_Hand.
    await pool.query(
      'CALL sp_issue_stock(?, ?, ?, ?)',
      [productId, locationId, quantity, session.userId]
    );

    return Response.json({
      success: true,
      message: `Successfully issued ${quantity} units using FEFO batch allocation.`
    });
  } catch (err) {
    console.error('Issue stock error:', err);

    const message = err.sqlMessage || err.message || 'Unable to issue stock.';
    return Response.json(
      { error: message },
      { status: 400 }
    );
  }
}
