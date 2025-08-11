
import express from 'express';
import { query } from '../config/db-client.js';
const router = express.Router();

router.get('/healthz', (req,res)=> res.json({ ok:true, time: new Date().toISOString() }));
router.get('/readyz', async (req,res)=>{
  try{
    await query('SELECT 1');
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false });
  }
});

export default router;
