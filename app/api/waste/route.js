import { requireRole } from '@/lib/auth';
import { query, pool } from '@/lib/db';
import { audit } from '@/lib/mongo';
export async function GET(){
 const {error}=await requireRole(['Admin','Staff']);if(error)return error;
 try{return Response.json(await query(`SELECT w.Waste_ID,w.Reason,w.Disposal_Method,w.Remarks,m.Quantity,m.Moved_At,i.Batch_Number,i.Expiry_Date,p.Product_Name,l.Location_Name
 FROM WASTE w JOIN STOCK_MOVEMENT m ON m.Movement_ID=w.Movement_ID JOIN INVENTORY i ON i.Inventory_ID=w.Inventory_ID JOIN PRODUCT p ON p.Product_ID=i.Product_ID JOIN LOCATION l ON l.Location_ID=i.Location_ID ORDER BY m.Moved_At DESC LIMIT 200`));}
 catch(e){console.error('Waste GET',e);return Response.json({error:'Unable to load waste records.'},{status:500})}
}
export async function POST(req){
 const {session,error}=await requireRole(['Admin','Staff']);if(error)return error;
 try{const b=await req.json();const inventoryId=Number(b.inventoryId),quantity=Number(b.quantity);
 if(!Number.isInteger(inventoryId)||inventoryId<=0||!Number.isInteger(quantity)||quantity<=0||!['Expired','Damaged','Spoiled','Other'].includes(b.reason)||typeof b.method!=='string'||!b.method.trim()||b.method.length>60){return Response.json({error:'Provide a valid batch, positive quantity, reason, and disposal method.'},{status:400})}
 const before=await query('SELECT Inventory_ID,Quantity_On_Hand,Batch_Number FROM INVENTORY WHERE Inventory_ID=?',[inventoryId]);if(!before.length)return Response.json({error:'Selected inventory batch not found.'},{status:404});
 await pool.query('CALL sp_record_waste(?,?,?,?,?,?)',[inventoryId,quantity,b.reason,b.method.trim(),String(b.remarks||'').slice(0,255),session.userId]);
 const after=await query('SELECT Inventory_ID,Quantity_On_Hand,Batch_Number FROM INVENTORY WHERE Inventory_ID=?',[inventoryId]);try { await audit(session.userId,'RECORD_WASTE','inventory',inventoryId,before[0],after[0]); } catch (auditError) { console.warn("Audit logging skipped:", auditError.message); }
 return Response.json({success:true,message:'Waste entry recorded and stock quantity updated.'});
 }catch(e){console.error('Waste POST',e);return Response.json({error:e.sqlMessage||'Unable to record waste. Check the quantity and try again.'},{status:400})}
}
