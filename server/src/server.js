require("dotenv").config();
const express=require("express"), http=require("http"), cors=require("cors"), helmet=require("helmet");
const rateLimit=require("express-rate-limit"), bcrypt=require("bcryptjs"), {Server}=require("socket.io");
const {z}=require("zod"), db=require("./db"), {sign,auth,roles}=require("./auth");
if(!process.env.JWT_SECRET||!process.env.DATABASE_URL){console.error("Missing DATABASE_URL or JWT_SECRET");process.exit(1);}
const app=express(), server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CORS_ORIGIN||"*",methods:["GET","POST"]}});
app.use(helmet({contentSecurityPolicy:false})); app.use(cors({origin:process.env.CORS_ORIGIN||"*"})); app.use(express.json({limit:"32kb"}));
app.use(rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}));
app.use(express.static(require("path").join(__dirname,"../public")));
const phone=z.string().min(6).max(24), coords=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
app.get("/health",(req,res)=>res.json({ok:true,service:"AXAS Driver API"}));
app.post("/api/setup/admin",wrap(async(req,res)=>{
 if(!process.env.ADMIN_SETUP_KEY||req.headers["x-setup-key"]!==process.env.ADMIN_SETUP_KEY)return res.status(403).json({error:"Setup key is invalid"});
 const b=z.object({name:z.string().min(2).max(80),phone,password:z.string().min(8).max(100)}).parse(req.body);
 if((await db.query("SELECT id FROM users WHERE role='admin' LIMIT 1")).rowCount)return res.status(409).json({error:"Admin already exists"});
 const hash=await bcrypt.hash(b.password,12),r=await db.query("INSERT INTO users(name,phone,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id,name,phone,role",[b.name,b.phone,hash]);
 res.status(201).json({user:r.rows[0],token:sign(r.rows[0])});
}));
app.post("/api/auth/register",wrap(async(req,res)=>{
 const b=z.object({name:z.string().min(2).max(80),phone,password:z.string().min(8).max(100),role:z.enum(["driver","passenger"]),car_model:z.string().max(80).optional(),plate_number:z.string().max(24).optional()}).parse(req.body);
 const hash=await bcrypt.hash(b.password,12),r=await db.query("INSERT INTO users(name,phone,password_hash,role,car_model,plate_number) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,phone,role,car_model,plate_number",[b.name,b.phone,hash,b.role,b.car_model||null,b.plate_number||null]);
 res.status(201).json({user:r.rows[0],token:sign(r.rows[0])});
}));
app.post("/api/auth/login",wrap(async(req,res)=>{
 const b=z.object({phone,password:z.string().min(1).max(100)}).parse(req.body),r=await db.query("SELECT * FROM users WHERE phone=$1",[b.phone]),u=r.rows[0];
 if(!u||!(await bcrypt.compare(b.password,u.password_hash)))return res.status(401).json({error:"Հեռախոսը կամ գաղտնաբառը սխալ է"});
 const user={id:u.id,name:u.name,phone:u.phone,role:u.role,car_model:u.car_model,plate_number:u.plate_number};res.json({user,token:sign(user)});
}));
app.get("/api/me",auth,wrap(async(req,res)=>{const r=await db.query("SELECT id,name,phone,role,car_model,plate_number,created_at FROM users WHERE id=$1",[req.user.sub]);if(!r.rowCount)return res.status(404).json({error:"User not found"});res.json({user:r.rows[0]});}));
app.patch("/api/drivers/availability",auth,roles("driver"),wrap(async(req,res)=>{const online=z.boolean().parse(req.body.online);await db.query("UPDATE users SET is_online=$1 WHERE id=$2",[online,req.user.sub]);io.emit("driver:availability",{driverId:req.user.sub,online});res.json({online});}));
app.post("/api/drivers/location",auth,roles("driver"),wrap(async(req,res)=>{const p=coords.parse(req.body);await db.query("INSERT INTO driver_locations(driver_id,lat,lng,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(driver_id) DO UPDATE SET lat=EXCLUDED.lat,lng=EXCLUDED.lng,updated_at=NOW()",[req.user.sub,p.lat,p.lng]);io.to("admins").emit("driver:location",{driverId:req.user.sub,...p});res.json({saved:true});}));
app.post("/api/orders",auth,roles("passenger","admin"),wrap(async(req,res)=>{
 const b=z.object({pickup_address:z.string().min(3).max(240),destination_address:z.string().min(3).max(240),pickup:coords,destination:coords,note:z.string().max(500).optional()}).parse(req.body);
 const r=await db.query("INSERT INTO orders(passenger_id,pickup_address,destination_address,pickup_lat,pickup_lng,dest_lat,dest_lng,note,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'searching') RETURNING *",[req.user.sub,b.pickup_address,b.destination_address,b.pickup.lat,b.pickup.lng,b.destination.lat,b.destination.lng,b.note||null]);
 io.to("drivers").emit("order:new",r.rows[0]);res.status(201).json({order:r.rows[0]});
}));
app.get("/api/orders/available",auth,roles("driver"),wrap(async(req,res)=>{const r=await db.query("SELECT o.*,u.name AS passenger_name,u.phone AS passenger_phone FROM orders o JOIN users u ON u.id=o.passenger_id WHERE o.status='searching' ORDER BY o.created_at DESC LIMIT 50");res.json({orders:r.rows});}));
app.post("/api/orders/:id/accept",auth,roles("driver"),wrap(async(req,res)=>{const r=await db.query("UPDATE orders SET driver_id=$1,status='accepted',accepted_at=NOW() WHERE id=$2 AND status='searching' RETURNING *",[req.user.sub,req.params.id]);if(!r.rowCount)return res.status(409).json({error:"Պատվերն արդեն վերցված է կամ հասանելի չէ"});io.emit("order:updated",r.rows[0]);res.json({order:r.rows[0]});}));
app.post("/api/orders/:id/status",auth,roles("driver"),wrap(async(req,res)=>{const status=z.enum(["arrived","started","completed","cancelled"]).parse(req.body.status);const r=await db.query("UPDATE orders SET status=$1,started_at=CASE WHEN $1='started' THEN NOW() ELSE started_at END,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END WHERE id=$2 AND driver_id=$3 AND status IN ('accepted','arrived','started') RETURNING *",[status,req.params.id,req.user.sub]);if(!r.rowCount)return res.status(409).json({error:"Հնարավոր չէ փոխել պատվերի վիճակը"});io.emit("order:updated",r.rows[0]);res.json({order:r.rows[0]});}));
app.get("/api/orders/mine",auth,wrap(async(req,res)=>{const col=req.user.role==="driver"?"driver_id":"passenger_id";const r=await db.query(`SELECT * FROM orders WHERE ${col}=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.sub]);res.json({orders:r.rows});}));
app.get("/api/admin/drivers",auth,roles("admin"),wrap(async(req,res)=>{const r=await db.query("SELECT u.id,u.name,u.phone,u.car_model,u.plate_number,u.is_online,l.lat,l.lng,l.updated_at FROM users u LEFT JOIN driver_locations l ON l.driver_id=u.id WHERE u.role='driver' ORDER BY u.created_at DESC");res.json({drivers:r.rows});}));

app.get("/api/admin/orders",auth,roles("admin"),wrap(async(req,res)=>{
 const r=await db.query("SELECT o.*,p.name AS passenger_name,p.phone AS passenger_phone,d.name AS driver_name,d.phone AS driver_phone FROM orders o JOIN users p ON p.id=o.passenger_id LEFT JOIN users d ON d.id=o.driver_id ORDER BY o.created_at DESC LIMIT 200");
 res.json({orders:r.rows});
}));
app.patch("/api/admin/orders/:id/assign",auth,roles("admin"),wrap(async(req,res)=>{
 const b=z.object({driver_id:z.string().uuid()}).parse(req.body);
 const r=await db.query("UPDATE orders SET driver_id=$1,status='accepted',accepted_at=NOW() WHERE id=$2 AND status='searching' AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='driver') RETURNING *",[b.driver_id,req.params.id]);
 if(!r.rowCount)return res.status(409).json({error:"Պատվերը հասանելի չէ կամ վարորդը չի գտնվել"});
 io.emit("order:updated",r.rows[0]);io.to("user:"+b.driver_id).emit("order:assigned",r.rows[0]);res.json({order:r.rows[0]});
}));
app.patch("/api/admin/orders/:id/status",auth,roles("admin"),wrap(async(req,res)=>{
 const status=z.enum(["cancelled","completed"]).parse(req.body.status);
 const r=await db.query("UPDATE orders SET status=$1,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END WHERE id=$2 AND status NOT IN ('completed','cancelled') RETURNING *",[status,req.params.id]);
 if(!r.rowCount)return res.status(409).json({error:"Պատվերի վիճակը հնարավոր չէ փոխել"});
 io.emit("order:updated",r.rows[0]);res.json({order:r.rows[0]});
}));
io.use((s,next)=>{try{s.user=require("jsonwebtoken").verify(s.handshake.auth?.token,process.env.JWT_SECRET);next();}catch{next(new Error("unauthorized"));}});
io.on("connection",s=>{if(s.user.role==="driver")s.join("drivers");if(s.user.role==="admin")s.join("admins");s.join("user:"+s.user.sub);});
app.use((err,req,res,next)=>{if(err instanceof z.ZodError)return res.status(400).json({error:"Տվյալները սխալ են",details:err.issues});if(err.code==="23505")return res.status(409).json({error:"Այս հեռախոսահամարն արդեն գրանցված է"});console.error(err);res.status(500).json({error:"Սերվերի ներքին սխալ"});});
async function start(){
 const fs=require("fs"),path=require("path");
 const schema=fs.readFileSync(path.join(__dirname,"../db/schema.sql"),"utf8");
 await db.query(schema);
 server.listen(Number(process.env.PORT||3000),"0.0.0.0",()=>console.log("TAXI LIDER API listening"));
}
start().catch(error=>{console.error("Database initialization failed",error);process.exit(1);});
